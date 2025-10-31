/**
 * 配置变更监听服务
 * 实现配置热更新机制，监听配置变更并触发相应的更新操作
 */

import { supabase } from '../lib/supabase'
import { ConfigService } from './configService'

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
          // 静默处理事件监听器错误
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

export interface ConfigChangeEvent {
  type: 'package_grade_thresholds' | 'rating_score_map' | 'final_grade_config' | 'anti_false_positive_config' | 'scoring_algorithm_config'
  oldValue: any
  newValue: any
  timestamp: Date
  userId?: string
}

export interface ConfigWatcherOptions {
  enableRealTimeUpdates: boolean
  pollInterval: number // 轮询间隔（毫秒）
  enableBatchRecalculation: boolean
  maxRetries: number
}

/**
 * 配置变更监听器
 * 负责监听配置变更、发送通知、触发重算
 */
export class ConfigWatcher extends SimpleEventEmitter {
  private static instance: ConfigWatcher
  private isWatching = false
  private pollTimer?: NodeJS.Timeout
  private lastConfigHash: string = ''
  private configService: ConfigService
  private options: ConfigWatcherOptions

  private constructor(options: Partial<ConfigWatcherOptions> = {}) {
    super()
    this.configService = ConfigService.getInstance()
    this.options = {
      enableRealTimeUpdates: true,
      pollInterval: 5000, // 5秒轮询
      enableBatchRecalculation: true,
      maxRetries: 3,
      ...options
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(options?: Partial<ConfigWatcherOptions>): ConfigWatcher {
    if (!ConfigWatcher.instance) {
      ConfigWatcher.instance = new ConfigWatcher(options)
    }
    return ConfigWatcher.instance
  }

  /**
   * 开始监听配置变更
   */
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      return
    }

    try {
      // 初始化配置哈希
      await this.updateConfigHash()
      
      // 启动实时监听
      if (this.options.enableRealTimeUpdates) {
        await this.setupRealtimeSubscription()
      }
      
      // 启动轮询监听（作为备用机制）
      this.startPolling()
      
      this.isWatching = true
      this.emit('watcher:started')
      
    } catch (error) {
      throw error
    }
  }

  /**
   * 停止监听配置变更
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching) {
      return
    }
    
    // 停止轮询
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
    
    // 停止实时订阅
    await this.teardownRealtimeSubscription()
    
    this.isWatching = false
    this.emit('watcher:stopped')
  }

  /**
   * 设置实时订阅
   */
  private async setupRealtimeSubscription(): Promise<void> {
    try {
      // 监听系统设置表的变更
      supabase
        .channel('config-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'system_settings'
          },
          (payload) => {
            this.handleConfigChange(payload)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // 实时配置监听已启用
          } else if (status === 'CHANNEL_ERROR') {
            // 降级到轮询模式
            this.startPolling()
          }
        })
        
    } catch (error) {
      // 降级到轮询模式
      this.startPolling()
    }
  }

  /**
   * 停止实时订阅
   */
  private async teardownRealtimeSubscription(): Promise<void> {
    try {
      await supabase.removeAllChannels()
      // 实时订阅已停止
    } catch (error) {
      // 停止实时订阅失败，静默处理
    }
  }

  /**
   * 启动轮询监听
   */
  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
    }

    this.pollTimer = setInterval(async () => {
      try {
        await this.checkConfigChanges()
      } catch (error) {
        // 静默处理轮询检查错误
      }
    }, this.options.pollInterval)
  }

  /**
   * 检查配置变更
   */
  private async checkConfigChanges(): Promise<void> {
    try {
      const currentHash = await this.calculateConfigHash()
      
      if (currentHash !== this.lastConfigHash && this.lastConfigHash !== '') {
        await this.handleConfigChangeDetected()
      }
      
      this.lastConfigHash = currentHash
      
    } catch (error) {
      // 静默处理检查配置变更错误
    }
  }

  /**
   * 处理配置变更事件
   */
  private async handleConfigChange(payload: any): Promise<void> {
    try {
      // 延迟一点时间确保数据库事务完成
      setTimeout(async () => {
        await this.handleConfigChangeDetected()
      }, 1000)
      
    } catch (error) {
      // 静默处理配置变更事件错误
    }
  }

  /**
   * 处理检测到的配置变更
   */
  private async handleConfigChangeDetected(): Promise<void> {
    try {
      // 清除配置缓存
      await this.configService.clearCache()
      
      // 重新加载配置
      await this.configService.reloadConfigs()
      
      // 验证新配置
      const validation = await this.configService.validateAllConfigs()
      if (!validation.overall.isValid) {
        this.emit('config:validation_failed', validation)
        return
      }
      
      // 触发配置变更事件
      const changeEvent: ConfigChangeEvent = {
        type: 'package_grade_thresholds', // 这里需要根据实际变更类型确定
        oldValue: null,
        newValue: null,
        timestamp: new Date()
      }
      
      this.emit('config:changed', changeEvent)
      
      // 触发批量重算（如果启用）
      if (this.options.enableBatchRecalculation) {
        this.emit('config:recalculation_needed', changeEvent)
      }
      
      // 更新配置哈希
      await this.updateConfigHash()
      
    } catch (error) {
      this.emit('config:change_error', error)
    }
  }

  /**
   * 计算配置哈希值
   */
  private async calculateConfigHash(): Promise<string> {
    try {
      const configs = await Promise.all([
        this.configService.getPackageGradeThresholds(),
        this.configService.getRatingScoreMap(),
        this.configService.getFinalGradeConfig(),
        this.configService.getAntiFalsePositiveConfig(),
        this.configService.getScoringAlgorithmConfig()
      ])
      
      const configString = JSON.stringify(configs)
      
      // 简单哈希算法
      let hash = 0
      for (let i = 0; i < configString.length; i++) {
        const char = configString.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // 转换为32位整数
      }
      
      return hash.toString()
      
    } catch (error) {
      // 计算配置哈希失败，静默处理
      return ''
    }
  }

  /**
   * 更新配置哈希
   */
  private async updateConfigHash(): Promise<void> {
    this.lastConfigHash = await this.calculateConfigHash()
  }

  /**
   * 获取监听状态
   */
  getWatchingStatus(): {
    isWatching: boolean
    options: ConfigWatcherOptions
    lastConfigHash: string
  } {
    return {
      isWatching: this.isWatching,
      options: this.options,
      lastConfigHash: this.lastConfigHash
    }
  }

  /**
   * 手动触发配置检查
   */
  async triggerConfigCheck(): Promise<void> {
    // 手动触发配置检查
    await this.checkConfigChanges()
  }

  /**
   * 更新监听选项
   */
  updateOptions(newOptions: Partial<ConfigWatcherOptions>): void {
    this.options = { ...this.options, ...newOptions }
    // 监听选项已更新
    
    // 如果正在监听，重启以应用新选项
    if (this.isWatching) {
      this.stopWatching().then(() => {
        this.startWatching()
      })
    }
  }
}

export default ConfigWatcher