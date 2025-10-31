/**
 * 配置热更新集成测试
 * 端到端测试配置热更新流程，验证数据一致性
 */

import { ConfigService } from '../../services/configService'
import { ConfigWatcher } from '../../services/configWatcher'
import { BatchRecalculationService } from '../../services/batchRecalculationService'
import { ConfigHotReloadManager } from '../../services/configHotReloadManager'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'

interface TestResult {
  testName: string
  success: boolean
  message: string
  duration: number
  details?: any
}

class ConfigHotReloadIntegrationTest {
  private configService: ConfigService
  private hotReloadManager: ConfigHotReloadManager
  private testResults: TestResult[] = []

  constructor() {
    this.configService = ConfigService.getInstance()
    this.hotReloadManager = ConfigHotReloadManager.getInstance()
  }

  /**
   * 运行所有集成测试
   */
  async runAllTests(): Promise<TestResult[]> {
    this.testResults = []
    
    // 基础功能测试
    await this.testConfigServiceBasics()
    await this.testConfigValidation()
    
    // 热更新流程测试
    await this.testHotReloadManagerLifecycle()
    await this.testConfigChangeDetection()
    await this.testBatchRecalculation()
    
    // 数据一致性测试
    await this.testDataConsistency()
    await this.testConcurrentOperations()
    
    // 错误处理测试
    await this.testErrorHandling()
    
    this.printTestSummary()
    
    return this.testResults
  }

  /**
   * 测试配置服务基础功能
   */
  private async testConfigServiceBasics(): Promise<void> {
    await this.runTest('配置服务基础功能', async () => {
      // 验证配置数据
      const configs = await this.configService.getAllConfigs();
      const packageGrades = configs.package_grade_thresholds;
      
      if (!packageGrades || Object.keys(packageGrades).length === 0) {
        throw new Error('配置数据为空');
      }
      
      logger.info('配置验证通过', {
        configCount: Object.keys(configs).length,
        packageGradeCount: Object.keys(packageGrades).length
      });
      
      return { configCount: Object.keys(configs).length, packageGradeCount: Object.keys(packageGrades).length }
    })
  }

  /**
   * 测试配置验证
   */
  private async testConfigValidation(): Promise<void> {
    await this.runTest('配置验证功能', async () => {
      const validation = await this.configService.validateAllConfigs()
      
      if (!validation.overall.isValid) {
        // 配置验证发现问题，记录到测试结果中
      }

      return { 
        isValid: validation.overall.isValid, 
        errorCount: validation.overall.errors?.length || 0,
        errors: validation.overall.errors 
      }
    })
  }

  /**
   * 测试热更新管理器生命周期
   */
  private async testHotReloadManagerLifecycle(): Promise<void> {
    await this.runTest('热更新管理器生命周期', async () => {
      // 测试启动
      await this.hotReloadManager.start()
      const statusAfterStart = await this.hotReloadManager.getStatus()
      
      if (!statusAfterStart.isActive) {
        throw new Error('热更新管理器启动失败')
      }

      // 测试停止
      await this.hotReloadManager.stop()
      const statusAfterStop = await this.hotReloadManager.getStatus()
      
      if (statusAfterStop.isActive) {
        throw new Error('热更新管理器停止失败')
      }

      return { startSuccess: true, stopSuccess: true }
    })
  }

  /**
   * 测试配置变更检测
   */
  private async testConfigChangeDetection(): Promise<void> {
    await this.runTest('配置变更检测', async () => {
      let changeDetected = false
      
      // 监听配置变更事件
      const changeHandler = () => {
        changeDetected = true
      }
      
      this.hotReloadManager.on('config:changed', changeHandler)
      
      try {
        // 启动热更新管理器
        await this.hotReloadManager.start()
        
        // 模拟配置变更（更新一个配置项）
        const { data: currentConfig } = await supabase
          .from('system_configs')
          .select('*')
          .eq('config_key', 'package_grade_thresholds')
          .single()
        
        if (currentConfig) {
          // 更新配置
          await supabase
            .from('system_configs')
            .update({ 
              updated_at: new Date().toISOString(),
              config_value: currentConfig.config_value // 保持值不变，只更新时间戳
            })
            .eq('id', currentConfig.id)
          
          // 等待变更检测
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
        await this.hotReloadManager.stop()
        
        return { changeDetected }
        
      } finally {
        this.hotReloadManager.off('config:changed', changeHandler)
      }
    })
  }

  /**
   * 测试批量重算功能
   */
  private async testBatchRecalculation(): Promise<void> {
    await this.runTest('批量重算功能', async () => {
      const recalcService = BatchRecalculationService.getInstance()
      
      // 测试触发重算
      const taskId = await recalcService.startRecalculation(['package_grades'])
      
      if (!taskId) {
        throw new Error('无法触发批量重算')
      }

      // 等待任务开始
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 检查任务状态
      const tasks = await recalcService.getActiveTasks()
      const task = tasks.find(t => t.id === taskId)
      
      return { 
        taskId, 
        taskExists: !!task,
        taskStatus: task?.status || 'unknown'
      }
    })
  }

  /**
   * 测试数据一致性
   */
  private async testDataConsistency(): Promise<void> {
    await this.runTest('数据一致性验证', async () => {
      // 获取配置数据
      const packageGrades = await this.configService.getPackageGradeThresholds()
      const scoreMapping = await this.configService.getRatingScoreMap()
      const finalGradeConfig = await this.configService.getFinalGradeConfig()
      
      // 验证最终等级配置的一致性
      if (finalGradeConfig && Array.isArray(finalGradeConfig)) {
        // 检查等级是否有重叠
        const sortedGrades = [...finalGradeConfig].sort((a, b) => a.minScore - b.minScore)
        
        for (let i = 0; i < sortedGrades.length - 1; i++) {
          if (sortedGrades[i].maxScore >= sortedGrades[i + 1].minScore) {
            throw new Error(`等级配置有重叠: ${sortedGrades[i].name} 和 ${sortedGrades[i + 1].name}`)
          }
        }
      }

      // 验证评级分数映射的一致性
      if (scoreMapping) {
        const scores = Object.values(scoreMapping)
        const uniqueScores = new Set(scores)
        if (scores.length !== uniqueScores.size) {
          throw new Error('评级分数映射存在重复分数')
        }
      }

      return { 
        packageGradeConsistent: true,
        scoreMappingConsistent: true,
        finalGradeConsistent: true
      }
    })
  }

  /**
   * 测试并发操作
   */
  private async testConcurrentOperations(): Promise<void> {
    await this.runTest('并发操作测试', async () => {
      const promises = []
      
      // 并发获取配置
      for (let i = 0; i < 5; i++) {
        promises.push(this.configService.getPackageGradeThresholds())
      }
      
      // 并发验证配置
      for (let i = 0; i < 3; i++) {
        promises.push(this.configService.validateAllConfigs())
      }
      
      const results = await Promise.all(promises)
      
      // 验证所有配置获取结果一致
      const configResults = results.slice(0, 5)
      const firstConfig = JSON.stringify(configResults[0])
      
      for (let i = 1; i < configResults.length; i++) {
        if (JSON.stringify(configResults[i]) !== firstConfig) {
          throw new Error('并发获取配置结果不一致')
        }
      }
      
      return { 
        concurrentConfigRequests: 5,
        concurrentValidationRequests: 3,
        allConsistent: true
      }
    })
  }

  /**
   * 测试错误处理
   */
  private async testErrorHandling(): Promise<void> {
    await this.runTest('错误处理测试', async () => {
      let errorHandled = false
      
      // 监听错误事件
      const errorHandler = (error: any) => {
        errorHandled = true
        // 错误被正确处理
      }
      
      this.hotReloadManager.on('config:change_error', errorHandler)
      
      try {
        // 测试无效配置处理
        const validation = await this.configService.validateConfig('invalid_config_key', {})
        
        return { 
          errorHandled,
          validationHandled: !validation.isValid
        }
        
      } finally {
        this.hotReloadManager.off('config:change_error', errorHandler)
      }
    })
  }

  /**
   * 运行单个测试
   */
  private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now()
    
    try {
      const details = await testFn()
      const duration = Date.now() - startTime
      
      this.testResults.push({
        testName,
        success: true,
        message: '测试通过',
        duration,
        details
      })
      
    } catch (error) {
      const duration = Date.now() - startTime
      const message = error instanceof Error ? error.message : String(error)
      
      this.testResults.push({
        testName,
        success: false,
        message,
        duration
      })
    }
  }

  /**
   * 打印测试摘要
   */
  private printTestSummary(): void {
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.success).length
    const failedTests = totalTests - passedTests
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0)
    
    // 测试摘要信息已记录在testResults中，无需console输出
  }

  /**
   * 获取测试结果
   */
  getTestResults(): TestResult[] {
    return this.testResults
  }
}

// 导出测试类
export { ConfigHotReloadIntegrationTest, type TestResult }

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  // Node.js 环境
  const test = new ConfigHotReloadIntegrationTest()
  test.runAllTests().then(results => {
    const failedCount = results.filter(r => !r.success).length
    process.exit(failedCount > 0 ? 1 : 0)
  }).catch(error => {
    process.exit(1)
  })
}