/**
 * 批量重算服务
 * 配置变更后自动重新计算相关评级数据
 */

import { supabase } from '../lib/supabase'
import { ConfigService } from './configService'
import type { ConfigChangeEvent } from './configWatcher'

// 简单的事件发射器实现（浏览器兼容）
class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {}

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)
  }

  emit(event: string, ...args: any[]): void {
    if (this.events[event]) {
      this.events[event].forEach(listener => {
        try {
          listener(...args)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  off(event: string, listener: Function): void {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener)
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event]
    } else {
      this.events = {}
    }
  }
}

export interface RecalculationTask {
  id: string
  type: 'package_grades' | 'phone_ratings' | 'final_grades' | 'all'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  totalItems: number
  processedItems: number
  startTime?: Date
  endTime?: Date
  error?: string
  configChangeId?: string
}

export interface RecalculationOptions {
  batchSize: number
  maxConcurrency: number
  retryAttempts: number
  retryDelay: number
  enableProgressReporting: boolean
}

/**
 * 批量重算服务
 * 负责在配置变更后重新计算相关的评级数据
 */
export class BatchRecalculationService extends SimpleEventEmitter {
  private static instance: BatchRecalculationService
  private configService: ConfigService
  private activeTasks: Map<string, RecalculationTask> = new Map()
  private options: RecalculationOptions

  private constructor(options: Partial<RecalculationOptions> = {}) {
    super()
    this.configService = ConfigService.getInstance()
    this.options = {
      batchSize: 100,
      maxConcurrency: 3,
      retryAttempts: 3,
      retryDelay: 1000,
      enableProgressReporting: true,
      ...options
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(options?: Partial<RecalculationOptions>): BatchRecalculationService {
    if (!BatchRecalculationService.instance) {
      BatchRecalculationService.instance = new BatchRecalculationService(options)
    }
    return BatchRecalculationService.instance
  }

  /**
   * 处理配置变更触发的重算
   */
  async handleConfigChange(changeEvent: ConfigChangeEvent): Promise<string[]> {
    const taskIds: string[] = []
    
    try {
      switch (changeEvent.type) {
        case 'package_grade_thresholds':
          // 重算号码包评级
          taskIds.push(await this.startRecalculation('package_grades', changeEvent))
          break
          
        case 'rating_score_map':
          // 重算手机号评级分数
          taskIds.push(await this.startRecalculation('phone_ratings', changeEvent))
          break
          
        case 'final_grade_config':
          // 重算最终等级
          taskIds.push(await this.startRecalculation('final_grades', changeEvent))
          break
          
        case 'anti_false_positive_config':
        case 'scoring_algorithm_config':
          // 重算所有相关数据
          taskIds.push(await this.startRecalculation('all', changeEvent))
          break
          
        default:
          console.warn('⚠️ 未知的配置变更类型:', changeEvent.type)
      }
      
      return taskIds
      
    } catch (error) {
      console.error('❌ 处理配置变更重算失败:', error)
      throw error
    }
  }

  /**
   * 启动重算任务
   */
  async startRecalculation(
    types: string[] | RecalculationTask['type'], 
    configChangeEvent?: ConfigChangeEvent
  ): Promise<string> {
    // 如果传入的是数组，处理第一个类型
    const type = Array.isArray(types) ? types[0] as RecalculationTask['type'] : types
    
    const taskId = this.generateTaskId()
    
    const task: RecalculationTask = {
      id: taskId,
      type,
      status: 'pending',
      progress: 0,
      totalItems: 0,
      processedItems: 0,
      configChangeId: configChangeEvent?.timestamp.toISOString()
    }
    
    this.activeTasks.set(taskId, task)
    
    // 异步执行重算
    this.executeRecalculation(task).catch(error => {
      console.error(`❌ 重算任务 ${taskId} 执行失败:`, error)
      this.updateTaskStatus(taskId, 'failed', error.message)
    })
    
    return taskId
  }

  /**
   * 执行重算任务
   */
  private async executeRecalculation(task: RecalculationTask): Promise<void> {
    try {
      this.updateTaskStatus(task.id, 'running')
      task.startTime = new Date()
      
      switch (task.type) {
        case 'package_grades':
          await this.recalculatePackageGrades(task)
          break
          
        case 'phone_ratings':
          await this.recalculatePhoneRatings(task)
          break
          
        case 'final_grades':
          await this.recalculateFinalGrades(task)
          break
          
        case 'all':
          await this.recalculateAll(task)
          break
          
        default:
          throw new Error(`未支持的重算类型: ${task.type}`)
      }
      
      task.endTime = new Date()
      this.updateTaskStatus(task.id, 'completed')
      
    } catch (error) {
      console.error(`❌ 重算任务 ${task.id} 失败:`, error)
      this.updateTaskStatus(task.id, 'failed', error.message)
      throw error
    }
  }

  /**
   * 重算号码包评级
   */
  private async recalculatePackageGrades(task: RecalculationTask): Promise<void> {
    try {
      // 获取所有需要重算的号码包
      const { data: packages, error } = await supabase
        .from('phone_packages')
        .select('id, first_charge_count, phone_count')
      
      if (error) throw error
      if (!packages) return
      
      task.totalItems = packages.length
      
      // 获取最新的评级阈值配置
      const thresholds = await this.configService.getPackageGradeThresholds()
      
      // 批量处理
      for (let i = 0; i < packages.length; i += this.options.batchSize) {
        const batch = packages.slice(i, i + this.options.batchSize)
        
        const updates = batch.map(pkg => {
          const conversionRate = pkg.phone_count > 0 ? (pkg.first_charge_count / pkg.phone_count) * 100 : 0
          const grade = this.calculatePackageGrade(conversionRate, thresholds)
          
          return {
            id: pkg.id,
            conversion_rate: conversionRate,
            grade: grade,
            updated_at: new Date().toISOString()
          }
        })
        
        // 批量更新数据库
        const { error: updateError } = await supabase
          .from('phone_packages')
          .upsert(updates)
        
        if (updateError) throw updateError
        
        task.processedItems += batch.length
        task.progress = (task.processedItems / task.totalItems) * 100
        
        if (this.options.enableProgressReporting) {
          this.emit('task:progress', task)
        }
      }
      
    } catch (error) {
      console.error('❌ 号码包评级重算失败:', error)
      throw error
    }
  }

  /**
   * 重算手机号评级
   */
  private async recalculatePhoneRatings(task: RecalculationTask): Promise<void> {
    try {
      // 获取所有需要重算的手机号评级
      const { data: ratings, error } = await supabase
        .from('phone_ratings')
        .select('id, rating')
      
      if (error) throw error
      if (!ratings) return
      
      task.totalItems = ratings.length
      
      // 获取最新的分数映射配置
      const scoreMap = await this.configService.getRatingScoreMap()
      
      // 批量处理
      for (let i = 0; i < ratings.length; i += this.options.batchSize) {
        const batch = ratings.slice(i, i + this.options.batchSize)
        
        const updates = batch.map(rating => ({
          id: rating.id,
          score: scoreMap[rating.rating] || 0,
          updated_at: new Date().toISOString()
        }))
        
        // 批量更新数据库
        const { error: updateError } = await supabase
          .from('phone_ratings')
          .upsert(updates)
        
        if (updateError) throw updateError
        
        task.processedItems += batch.length
        task.progress = (task.processedItems / task.totalItems) * 100
        
        if (this.options.enableProgressReporting) {
          this.emit('task:progress', task)
        }
      }
      
      console.log('✅ 手机号评级重算完成')
      
    } catch (error) {
      console.error('❌ 手机号评级重算失败:', error)
      throw error
    }
  }

  /**
   * 重算最终等级
   */
  private async recalculateFinalGrades(task: RecalculationTask): Promise<void> {
    console.log('🏆 开始重算最终等级...')
    
    try {
      // 获取所有需要重算的手机号（按号码包分组）
      const { data: phoneData, error } = await supabase
        .from('phone_ratings')
        .select(`
          phone_number,
          package_id,
          score,
          phone_packages!inner(id)
        `)
      
      if (error) throw error
      if (!phoneData) return
      
      // 按号码包分组计算平均分
      const packageScores = new Map<string, { scores: number[], phones: string[] }>()
      
      phoneData.forEach(phone => {
        if (!packageScores.has(phone.package_id)) {
          packageScores.set(phone.package_id, { scores: [], phones: [] })
        }
        const packageData = packageScores.get(phone.package_id)!
        packageData.scores.push(phone.score || 0)
        packageData.phones.push(phone.phone_number)
      })
      
      task.totalItems = packageScores.size
      
      // 获取最新的等级配置
      const gradeConfig = await this.configService.getFinalGradeConfig()
      
      let processedCount = 0
      
      // 批量处理每个号码包
      for (const [packageId, data] of packageScores) {
        const averageScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length
        const finalGrade = this.calculateFinalGrade(averageScore, gradeConfig)
        
        // 更新号码包的最终等级
        const { error: updateError } = await supabase
          .from('phone_packages')
          .update({
            average_score: averageScore,
            final_grade: finalGrade,
            updated_at: new Date().toISOString()
          })
          .eq('id', packageId)
        
        if (updateError) throw updateError
        
        processedCount++
        task.processedItems = processedCount
        task.progress = (processedCount / task.totalItems) * 100
        
        if (this.options.enableProgressReporting) {
          this.emit('task:progress', task)
        }
        
        console.log(`🏆 最终等级重算进度: ${processedCount}/${task.totalItems} (${task.progress.toFixed(1)}%)`)
      }
      
      console.log('✅ 最终等级重算完成')
      
    } catch (error) {
      console.error('❌ 最终等级重算失败:', error)
      throw error
    }
  }

  /**
   * 重算所有数据
   */
  private async recalculateAll(task: RecalculationTask): Promise<void> {
    console.log('🔄 开始重算所有数据...')
    
    try {
      // 分步骤执行，每个步骤占总进度的1/3
      const steps = [
        { name: '号码包评级', fn: () => this.recalculatePackageGrades(task) },
        { name: '手机号评级', fn: () => this.recalculatePhoneRatings(task) },
        { name: '最终等级', fn: () => this.recalculateFinalGrades(task) }
      ]
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        console.log(`🔄 执行步骤 ${i + 1}/3: ${step.name}`)
        
        // 重置任务进度用于当前步骤
        const stepTask = { ...task }
        stepTask.processedItems = 0
        stepTask.totalItems = 0
        
        await step.fn()
        
        // 更新总体进度
        task.progress = ((i + 1) / steps.length) * 100
        
        if (this.options.enableProgressReporting) {
          this.emit('task:progress', task)
        }
        
        console.log(`✅ 步骤 ${i + 1}/3 完成: ${step.name}`)
      }
      
      console.log('✅ 所有数据重算完成')
      
    } catch (error) {
      console.error('❌ 重算所有数据失败:', error)
      throw error
    }
  }

  /**
   * 计算号码包评级
   */
  private calculatePackageGrade(conversionRate: number, thresholds: any): string {
    for (const [grade, threshold] of Object.entries(thresholds)) {
      const t = threshold as { min: number; max: number }
      if (conversionRate >= t.min && conversionRate <= t.max) {
        return grade
      }
    }
    return 'E' // 默认等级
  }

  /**
   * 计算最终等级
   */
  private calculateFinalGrade(averageScore: number, gradeConfig: any[]): string {
    for (const config of gradeConfig) {
      if (averageScore >= config.minScore && averageScore <= config.maxScore) {
        return config.name
      }
    }
    return 'E' // 默认等级
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(taskId: string, status: RecalculationTask['status'], error?: string): void {
    const task = this.activeTasks.get(taskId)
    if (task) {
      task.status = status
      if (error) {
        task.error = error
      }
      this.emit('task:status_changed', task)
    }
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `recalc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): RecalculationTask | undefined {
    return this.activeTasks.get(taskId)
  }

  /**
   * 获取所有活动任务
   */
  getActiveTasks(): RecalculationTask[] {
    return Array.from(this.activeTasks.values())
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId)
    if (task && task.status === 'running') {
      // 这里可以实现任务取消逻辑
      this.updateTaskStatus(taskId, 'failed', '任务已取消')
      this.activeTasks.delete(taskId)
      console.log(`🛑 任务 ${taskId} 已取消`)
      return true
    }
    return false
  }

  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(): void {
    const completedTasks = Array.from(this.activeTasks.entries())
      .filter(([_, task]) => task.status === 'completed' || task.status === 'failed')
    
    completedTasks.forEach(([taskId, _]) => {
      this.activeTasks.delete(taskId)
    })
    
    console.log(`🧹 已清理 ${completedTasks.length} 个已完成的任务`)
  }

  /**
   * 更新重算选项
   */
  updateOptions(newOptions: Partial<RecalculationOptions>): void {
    this.options = { ...this.options, ...newOptions }
    console.log('✅ 重算选项已更新:', this.options)
  }
}

export default BatchRecalculationService