import { AuthService } from './auth'
import { PackageService } from './package'
import { ReportService } from './report'
import { SettingsService } from './settings'
import { APIUtils } from '../utils/api'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'
import { useAuthStore } from '../store/auth'
import { log } from '../utils/logger'
import type { SystemSettings } from '../types'

export interface ServiceHealthStatus {
  auth: boolean
  database: boolean
  storage: boolean
  overall: boolean
  lastCheck: Date
  errors: string[]
}

export interface InitializationResult {
  success: boolean
  errors: string[]
  warnings: string[]
  duration: number
}

export class APIService {
  // 初始化所有API服务
  static async initializeApp(): Promise<InitializationResult> {
    const startTime = Date.now()
    const result: InitializationResult = {
      success: false,
      errors: [],
      warnings: [],
      duration: 0
    }

    try {
      log.info('开始应用初始化', undefined, 'APIService')
      
      // 初始化 API 工具
      log.info('初始化 API 工具...', undefined, 'APIService')
      APIUtils.initialize()
      log.info('API 工具初始化完成', undefined, 'APIService')
      
      // 暂时跳过服务健康检查，直接进行初始化
      log.info('跳过服务健康检查，直接进行初始化...', undefined, 'APIService')
      
      // 初始化认证系统
      log.info('开始认证系统初始化...', undefined, 'APIService')
      const authResult = await this.initializeAuth()
      log.info(`认证初始化结果: ${JSON.stringify(authResult)}`, undefined, 'APIService')
      if (!authResult.success) {
        result.errors.push('认证系统初始化失败')
        result.errors.push(...authResult.errors)
        result.duration = Date.now() - startTime
        return result
      }
      if (authResult.warnings && authResult.warnings.length > 0) {
        result.warnings.push(...authResult.warnings)
      }
      
      // 4. 加载系统设置
      log.info('步骤4: 加载系统设置...', undefined, 'APIService')
      const settingsResult = await this.loadSystemSettings()
      log.info(`系统设置加载结果: ${JSON.stringify(settingsResult)}`, undefined, 'APIService')
      if (!settingsResult.success) {
        result.warnings.push('系统设置加载失败，使用默认设置')
        result.warnings.push(...settingsResult.errors)
      }
      
      // 5. 如果用户已登录，加载业务数据
      log.info('步骤5: 检查用户登录状态...', undefined, 'APIService')
      const authStore = useAuthStore.getState()
      if (authStore.isAuthenticated && authStore.user) {
        log.info('用户已登录，加载业务数据...', undefined, 'APIService')
        const businessDataResult = await this.loadBusinessData()
        if (!businessDataResult.success) {
          result.warnings.push('业务数据加载失败')
          result.warnings.push(...businessDataResult.errors)
        }
      } else {
        log.info('用户未登录，跳过业务数据加载', undefined, 'APIService')
      }
      
      result.success = true
      result.duration = Date.now() - startTime
      log.info(`应用API服务初始化完成，耗时: ${result.duration}ms`, undefined, 'APIService')
      
      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : '未知错误')
      result.duration = Date.now() - startTime
      log.error('应用API服务初始化失败', error, 'APIService')
      return result
    }
  }
  
  // 初始化认证系统
  private static async initializeAuth(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      errors: [],
      warnings: [],
      duration: 0
    }
    
    const startTime = Date.now()
    
    try {
      log.info('认证系统初始化...', undefined, 'APIService')
      
      // 使用认证store的初始化方法
      const success = await useAuthStore.getState().initializeSystem()
      
      if (success) {
        result.success = true
        log.info('认证系统初始化成功', undefined, 'APIService')
      } else {
        result.errors.push('认证系统初始化失败')
        log.error('认证系统初始化失败', undefined, 'APIService')
      }
      
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : '认证系统初始化异常')
      result.duration = Date.now() - startTime
      result.success = false
      log.error('认证系统初始化异常', error, 'APIService')
      return result
    }
  }
  
  // 加载系统设置
  private static async loadSystemSettings(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      errors: [],
      warnings: [],
      duration: 0
    }
    
    const startTime = Date.now()
    
    try {
      log.info('加载系统设置...', undefined, 'APIService')
      
      // 使用应用store加载设置
      const success = await useAppStore.getState().loadSystemSettings()
      
      if (success) {
        result.success = true
        log.info('系统设置加载成功', undefined, 'APIService')
      } else {
        result.errors.push('系统设置加载失败')
        result.warnings.push('将使用默认设置')
        log.warn('系统设置加载失败，使用默认设置', undefined, 'APIService')
      }
      
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : '系统设置加载异常')
      result.duration = Date.now() - startTime
      result.success = false
      log.error('系统设置加载异常', error, 'APIService')
      return result
    }
  }
  
  // 加载业务数据
  private static async loadBusinessData(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: true,
      errors: [],
      warnings: [],
      duration: 0
    }
    
    const startTime = Date.now()
    
    try {
      const appStore = useAppStore.getState()
      
      // 并行加载各种数据
      const loadPromises = [
        appStore.loadPackages(),
        appStore.loadPhoneScores(),
        appStore.loadReports()
      ]
      
      const results = await Promise.allSettled(loadPromises)
      const dataTypes = ['号码包', '号码评分', '报告']
      
      results.forEach((promiseResult, index) => {
        if (promiseResult.status === 'rejected') {
          const errorMsg = `${dataTypes[index]}数据加载失败: ${promiseResult.reason}`
          result.warnings.push(errorMsg)
          log.warn(errorMsg, undefined, 'APIService')
      } else {
        log.debug(`${dataTypes[index]}数据加载成功`, undefined, 'APIService')
        }
      })
      
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : '业务数据加载异常')
      result.duration = Date.now() - startTime
      return result
    }
  }
  
  // 用户登录后的数据初始化
  static async onUserLogin(): Promise<void> {
    try {
      log.info('用户登录，开始加载业务数据...', undefined, 'APIService')
      await this.loadBusinessData()
      log.info('用户业务数据加载完成', undefined, 'APIService')
    } catch (error) {
      log.error('用户登录后数据加载失败', error, 'APIService')
    }
  }
  
  // 用户登出后的数据清理
  static async onUserLogout(): Promise<void> {
    try {
      log.info('用户登出，清理业务数据...', undefined, 'APIService')
      const appStore = useAppStore.getState()
      
      // 清理业务数据
      appStore.setPackages([])
      appStore.setPhoneRatings([])
      appStore.setPhoneScores([])
      appStore.setReports([])
      
      // 重置UI状态
      appStore.setLoading(false)
      appStore.setSelectedPackageId(null)
      appStore.setUploadProgress(0)
      
      log.info('业务数据清理完成', undefined, 'APIService')
    } catch (error) {
      log.error('用户登出数据清理失败', error, 'APIService')
    }
  }
  
  // 检查API服务健康状态
  static async checkHealth(): Promise<ServiceHealthStatus> {
    const health: ServiceHealthStatus = {
      auth: false,
      database: false,
      storage: false,
      overall: false,
      lastCheck: new Date(),
      errors: []
    }
    
    try {
      // 检查认证服务 - 简化检查，只验证 Supabase 连接
      try {
        log.info('健康检查: 检查认证服务...', undefined, 'APIService')
        const authResult = await APIUtils.apiCall(async () => {
          // 简单的连接测试，不获取用户信息
          const { data, error } = await supabase.auth.getSession()
          if (error) {
            log.warn(`认证会话检查警告: ${error.message}`, undefined, 'APIService')
          }
          return { success: true }
        }, {
          operation: 'healthCheck:auth',
          timeout: 5000, // 减少到5秒
          retries: 1
        })
        health.auth = authResult.success
        log.info(`认证服务健康检查: ${health.auth ? '成功' : '失败'}`, undefined, 'APIService')
      } catch (error) {
        const errorMsg = `认证服务健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        health.errors.push(errorMsg)
        log.warn(errorMsg, undefined, 'APIService')
        health.auth = false // 确保设置为失败状态
      }
      
      // 检查数据库服务 - 简化检查，只验证基本连接
      try {
        log.info('健康检查: 检查数据库服务...', undefined, 'APIService')
        const dbResult = await APIUtils.apiCall(async () => {
          // 简单的数据库连接测试
          const { data, error } = await supabase
            .from('system_settings')
            .select('count')
            .limit(1)
          if (error) {
            log.warn(`数据库连接检查警告: ${error.message}`, undefined, 'APIService')
          }
          return { success: true }
        }, {
          operation: 'healthCheck:database',
          timeout: 5000, // 减少到5秒
          retries: 1
        })
        health.database = dbResult.success
        log.info(`数据库服务健康检查: ${health.database ? '成功' : '失败'}`, undefined, 'APIService')
      } catch (error) {
        const errorMsg = `数据库服务健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        health.errors.push(errorMsg)
        log.warn(errorMsg, undefined, 'APIService')
        health.database = false // 确保设置为失败状态
      }
      
      // 检查存储服务 - 简化检查
      try {
        log.info('健康检查: 检查存储服务...', undefined, 'APIService')
        const storageResult = await APIUtils.apiCall(async () => {
          // 简单的存储服务检查 - 尝试获取存储桶信息
          const { data, error } = await supabase.storage.listBuckets()
          if (error) {
            log.warn(`存储服务检查警告: ${error.message}`, undefined, 'APIService')
          }
          return { success: true }
        }, {
          operation: 'healthCheck:storage',
          timeout: 5000, // 减少到5秒
          retries: 1
        })
        health.storage = storageResult.success
        log.info(`存储服务健康检查: ${health.storage ? '成功' : '失败'}`, undefined, 'APIService')
      } catch (error) {
        const errorMsg = `存储服务健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`
        health.errors.push(errorMsg)
        log.warn(errorMsg, undefined, 'APIService')
        health.storage = false // 确保设置为失败状态
      }
      
      // 整体健康状态
      health.overall = health.auth && health.database && health.storage
      log.info(`整体健康状态: ${health.overall ? '健康' : '不健康'}`, undefined, 'APIService')
      
      // 记录性能监控
      APIUtils.performanceMonitor.recordMetric('healthCheck', Date.now() - health.lastCheck.getTime())
      
      return health
    } catch (error) {
      const errorMsg = `API服务健康检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      health.errors.push(errorMsg)
      log.error(errorMsg, error, 'APIService')
      return health
    }
  }
  
  // 重新连接所有服务
  static async reconnectServices(): Promise<InitializationResult> {
    const startTime = Date.now()
    const result: InitializationResult = {
      success: false,
      errors: [],
      warnings: [],
      duration: 0
    }

    try {
      log.info('重新连接API服务...', undefined, 'APIService')
      
      // 清理缓存和重置连接状态
      APIUtils.cache.clear()
      APIUtils.requestDeduplicator.clear()
      
      // 重新初始化认证
      const authStore = useAuthStore.getState()
      try {
        await authStore.checkAuth()
      } catch (error) {
        result.warnings.push(`认证重连失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
      
      // 重新加载系统设置
      const settingsResult = await this.loadSystemSettings()
      if (!settingsResult.success) {
        result.warnings.push('系统设置重新加载失败')
        result.warnings.push(...settingsResult.errors)
      }
      
      // 如果用户已登录，重新加载业务数据
      if (authStore.isAuthenticated) {
        const businessDataResult = await this.loadBusinessData()
        if (!businessDataResult.success) {
          result.warnings.push('业务数据重新加载失败')
          result.warnings.push(...businessDataResult.errors)
        }
      }
      
      // 执行健康检查验证重连结果
      const healthStatus = await this.checkHealth()
      if (!healthStatus.overall) {
        result.warnings.push('服务重连后健康检查仍有问题')
        result.warnings.push(...healthStatus.errors)
      }
      
      result.success = true
      result.duration = Date.now() - startTime
      log.info(`API服务重新连接完成，耗时: ${result.duration}ms`, undefined, 'APIService')
      
      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : '重连过程异常')
      result.duration = Date.now() - startTime
      log.error('API服务重新连接失败', error, 'APIService')
      return result
    }
  }

  // 获取API性能统计
  static getPerformanceStats() {
    return APIUtils.performanceMonitor.getStats()
  }

  // 清理API缓存
  static clearCache() {
    APIUtils.cache.clear()
    log.debug('API缓存已清理', undefined, 'APIService')
  }

  // 获取缓存统计
  static getCacheStats() {
    return APIUtils.cache.getStats()
  }
}