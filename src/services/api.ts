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

  // 用户登出后的清理
  static async onUserLogout(): Promise<void> {
    try {
      log.info('用户登出，清理数据...', undefined, 'APIService')
      
      // 清理应用状态
      const appStore = useAppStore.getState()
      appStore.clearData()
      
      log.info('用户数据清理完成', undefined, 'APIService')
    } catch (error) {
      log.error('用户登出清理失败', error, 'APIService')
    }
  }

  // 加载业务数据
  private static async loadBusinessData(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      errors: [],
      warnings: [],
      duration: 0
    }
    
    const startTime = Date.now()
    
    try {
      const appStore = useAppStore.getState()
      
      // 并行加载各种数据
      const loadPromises = [
        appStore.loadPackages().catch(error => {
          result.warnings.push(`包数据加载失败: ${error.message}`)
          return false
        }),
        appStore.loadPhoneScores().catch(error => {
          result.warnings.push(`手机评分数据加载失败: ${error.message}`)
          return false
        }),
        appStore.loadSystemSettings().catch(error => {
          result.warnings.push(`系统设置加载失败: ${error.message}`)
          return false
        })
      ]
      
      const results = await Promise.all(loadPromises)
      const successCount = results.filter(Boolean).length
      
      if (successCount > 0) {
        result.success = true
        log.info(`业务数据加载完成，成功加载 ${successCount}/${results.length} 项`, undefined, 'APIService')
      } else {
        result.errors.push('所有业务数据加载失败')
        log.error('所有业务数据加载失败', undefined, 'APIService')
      }
      
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : '业务数据加载异常')
      result.duration = Date.now() - startTime
      result.success = false
      log.error('业务数据加载异常', error, 'APIService')
      return result
    }
  }

  // 健康检查
  static async checkHealth(): Promise<ServiceHealthStatus> {
    const status: ServiceHealthStatus = {
      auth: false,
      database: false,
      storage: false,
      overall: false,
      lastCheck: new Date(),
      errors: []
    }

    try {
      // 检查认证服务
      try {
        const { data, error } = await supabase.auth.getSession()
        status.auth = !error
        if (error) status.errors.push(`认证服务: ${error.message}`)
      } catch (error) {
        status.auth = false
        status.errors.push(`认证服务: ${error instanceof Error ? error.message : '未知错误'}`)
      }

      // 检查数据库连接
      try {
        const { error } = await supabase.from('system_settings').select('count').limit(1)
        status.database = !error
        if (error) status.errors.push(`数据库: ${error.message}`)
      } catch (error) {
        status.database = false
        status.errors.push(`数据库: ${error instanceof Error ? error.message : '未知错误'}`)
      }

      // 检查存储服务
      try {
        const { data, error } = await supabase.storage.listBuckets()
        status.storage = !error
        if (error) status.errors.push(`存储服务: ${error.message}`)
      } catch (error) {
        status.storage = false
        status.errors.push(`存储服务: ${error instanceof Error ? error.message : '未知错误'}`)
      }

      // 整体状态
      status.overall = status.auth && status.database && status.storage

      log.info('服务健康检查完成', {
        auth: status.auth,
        database: status.database,
        storage: status.storage,
        overall: status.overall,
        errors: status.errors
      }, 'APIService')

      return status
    } catch (error) {
      status.errors.push(`健康检查异常: ${error instanceof Error ? error.message : '未知错误'}`)
      log.error('服务健康检查异常', error, 'APIService')
      return status
    }
  }

  // 重连服务
  static async reconnectServices(): Promise<InitializationResult> {
    const result: InitializationResult = {
      success: false,
      errors: [],
      warnings: [],
      duration: 0
    }
    
    const startTime = Date.now()
    
    try {
      log.info('开始重连服务...', undefined, 'APIService')
      
      // 重新初始化 API 工具
      APIUtils.initialize()
      
      // 检查服务健康状态
      const healthStatus = await this.checkHealth()
      
      if (healthStatus.overall) {
        result.success = true
        log.info('服务重连成功', undefined, 'APIService')
      } else {
        result.errors.push('服务重连失败')
        result.errors.push(...healthStatus.errors)
        log.error('服务重连失败', healthStatus.errors, 'APIService')
      }
      
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : '服务重连异常')
      result.duration = Date.now() - startTime
      result.success = false
      log.error('服务重连异常', error, 'APIService')
      return result
    }
  }

  // 获取性能统计
  static getPerformanceStats() {
    return APIUtils.getPerformanceStats()
  }

  // 清理缓存
  static clearCache() {
    APIUtils.clearCache()
  }

  // 获取缓存统计
  static getCacheStats() {
    return APIUtils.getCacheStats()
  }
}