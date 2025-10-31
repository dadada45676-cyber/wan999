/**
 * 配置热更新管理器
 * 整合配置监听器和批量重算服务，提供完整的配置热更新解决方案
 */

import { ConfigWatcher, type ConfigChangeEvent, type ConfigWatcherOptions } from './configWatcher'
import { BatchRecalculationService, type RecalculationOptions, type RecalculationTask } from './batchRecalculationService'
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

export interface HotReloadManagerOptions {
  watcher: Partial<ConfigWatcherOptions>
  recalculation: Partial<RecalculationOptions>
  enableAutoRecalculation: boolean
  enableNotifications: boolean
  maxConcurrentRecalculations: number
}

export interface HotReloadStatus {
  isActive: boolean
  watcherStatus: any
  activeRecalculations: RecalculationTask[]
  lastConfigChange?: Date
  totalConfigChanges: number
  totalRecalculations: number
}

/**
 * 配置热更新管理器
 * 统一管理配置监听、变更通知和自动重算
 */
export class ConfigHotReloadManager extends SimpleEventEmitter {
  private static instance: ConfigHotReloadManager
  private configWatcher: ConfigWatcher
  private recalculationService: BatchRecalculationService
  private configService: ConfigService
  private options: HotReloadManagerOptions
  private isActive = false
  private stats = {
    totalConfigChanges: 0,
    totalRecalculations: 0,
    lastConfigChange: undefined as Date | undefined
  }

  private constructor(options: Partial<HotReloadManagerOptions> = {}) {
    super()
    
    this.options = {
      watcher: {
        enableRealTimeUpdates: true,
        pollInterval: 5000,
        enableBatchRecalculation: true,
        maxRetries: 3
      },
      recalculation: {
        batchSize: 100,
        maxConcurrency: 3,
        retryAttempts: 3,
        retryDelay: 1000,
        enableProgressReporting: true
      },
      enableAutoRecalculation: true,
      enableNotifications: true,
      maxConcurrentRecalculations: 2,
      ...options
    }

    this.configService = ConfigService.getInstance()
    this.configWatcher = ConfigWatcher.getInstance(this.options.watcher)
    this.recalculationService = BatchRecalculationService.getInstance(this.options.recalculation)
    
    this.setupEventHandlers()
  }

  /**
   * 获取单例实例
   */
  static getInstance(options?: Partial<HotReloadManagerOptions>): ConfigHotReloadManager {
    if (!ConfigHotReloadManager.instance) {
      ConfigHotReloadManager.instance = new ConfigHotReloadManager(options)
    }
    return ConfigHotReloadManager.instance
  }

  /**
   * 启动配置热更新
   */
  async start(): Promise<void> {
    if (this.isActive) {
      return
    }

    try {
      // 启动配置监听器
      await this.configWatcher.startWatching()
      
      this.isActive = true
      this.emit('manager:started')
      
    } catch (error) {
      throw error
    }
  }

  /**
   * 停止配置热更新
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return
    }

    try {
      // 取消所有运行中的重算任务
      await this.cancelAllRecalculations()
      
      // 停止配置监听器
      await this.configWatcher.stopWatching()
      
      this.isActive = false
      this.emit('manager:stopped')
      
    } catch (error) {
      throw error
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听配置变更事件
    this.configWatcher.on('config:changed', this.handleConfigChanged.bind(this))
    this.configWatcher.on('config:validation_failed', this.handleValidationFailed.bind(this))
    this.configWatcher.on('config:recalculation_needed', this.handleRecalculationNeeded.bind(this))
    this.configWatcher.on('config:change_error', this.handleConfigChangeError.bind(this))
    
    // 监听重算任务事件
    this.recalculationService.on('task:progress', this.handleRecalculationProgress.bind(this))
    this.recalculationService.on('task:status_changed', this.handleRecalculationStatusChanged.bind(this))
    
    // 监听监听器状态事件
    this.configWatcher.on('watcher:started', () => {
      this.emit('watcher:started')
    })
    
    this.configWatcher.on('watcher:stopped', () => {
      this.emit('watcher:stopped')
    })
  }

  /**
   * 处理配置变更事件
   */
  private async handleConfigChanged(changeEvent: ConfigChangeEvent): Promise<void> {
    try {
      this.stats.totalConfigChanges++
      this.stats.lastConfigChange = changeEvent.timestamp
      
      if (this.options.enableNotifications) {
        this.emit('config:changed', changeEvent)
      }
      
    } catch (error) {
      this.emit('config:change_error', error)
    }
  }

  /**
   * 处理配置验证失败事件
   */
  private handleValidationFailed(validation: any): void {
    if (this.options.enableNotifications) {
      this.emit('config:validation_failed', validation)
    }
  }

  /**
   * 处理重算需求事件
   */
  private async handleRecalculationNeeded(changeEvent: ConfigChangeEvent): Promise<void> {
    if (!this.options.enableAutoRecalculation) {
      return
    }

    try {
      // 检查当前并发重算数量
      const activeTasks = this.recalculationService.getActiveTasks()
      const runningTasks = activeTasks.filter(task => task.status === 'running')
      
      if (runningTasks.length >= this.options.maxConcurrentRecalculations) {
        // 可以实现队列机制
        return
      }
      
      const taskIds = await this.recalculationService.handleConfigChange(changeEvent)
      
      this.stats.totalRecalculations += taskIds.length
      
      if (this.options.enableNotifications) {
        this.emit('recalculation:started', { taskIds, changeEvent })
      }
      
    } catch (error) {
      this.emit('recalculation:error', error)
    }
  }

  /**
   * 处理配置变更错误事件
   */
  private handleConfigChangeError(error: any): void {
    if (this.options.enableNotifications) {
      this.emit('config:error', error)
    }
  }

  /**
   * 处理重算进度事件
   */
  private handleRecalculationProgress(task: RecalculationTask): void {
    if (this.options.enableNotifications) {
      this.emit('recalculation:progress', task)
    }
  }

  /**
   * 处理重算状态变更事件
   */
  private handleRecalculationStatusChanged(task: RecalculationTask): void {
    if (this.options.enableNotifications) {
      this.emit('recalculation:status_changed', task)
    }
    
    // 如果任务完成，清理资源
    if (task.status === 'completed' || task.status === 'failed') {
      setTimeout(() => {
        this.recalculationService.cleanupCompletedTasks()
      }, 60000) // 1分钟后清理
    }
  }

  /**
   * 手动触发配置检查
   */
  async triggerConfigCheck(): Promise<void> {
    await this.configWatcher.triggerConfigCheck()
  }

  /**
   * 手动启动重算
   */
  async triggerRecalculation(type: RecalculationTask['type']): Promise<string> {
    const taskId = await this.recalculationService.startRecalculation(type)
    
    this.stats.totalRecalculations++
    
    if (this.options.enableNotifications) {
      this.emit('recalculation:manual_started', { taskId, type })
    }
    
    return taskId
  }

  /**
   * 获取热更新状态
   */
  getStatus(): HotReloadStatus {
    return {
      isActive: this.isActive,
      watcherStatus: this.configWatcher.getWatchingStatus(),
      activeRecalculations: this.recalculationService.getActiveTasks(),
      lastConfigChange: this.stats.lastConfigChange,
      totalConfigChanges: this.stats.totalConfigChanges,
      totalRecalculations: this.stats.totalRecalculations
    }
  }

  /**
   * 获取重算任务状态
   */
  getRecalculationStatus(taskId: string): RecalculationTask | undefined {
    return this.recalculationService.getTaskStatus(taskId)
  }

  /**
   * 取消重算任务
   */
  async cancelRecalculation(taskId: string): Promise<boolean> {
    const result = await this.recalculationService.cancelTask(taskId)
    
    if (result && this.options.enableNotifications) {
      this.emit('recalculation:cancelled', { taskId })
    }
    
    return result
  }

  /**
   * 取消所有重算任务
   */
  private async cancelAllRecalculations(): Promise<void> {
    const activeTasks = this.recalculationService.getActiveTasks()
    const runningTasks = activeTasks.filter(task => task.status === 'running')
    
    console.log(`🛑 取消 ${runningTasks.length} 个运行中的重算任务...`)
    
    const cancelPromises = runningTasks.map(task => 
      this.recalculationService.cancelTask(task.id)
    )
    
    await Promise.all(cancelPromises)
    console.log('✅ 所有重算任务已取消')
  }

  /**
   * 更新配置选项
   */
  updateOptions(newOptions: Partial<HotReloadManagerOptions>): void {
    this.options = { ...this.options, ...newOptions }
    
    // 更新子服务的选项
    if (newOptions.watcher) {
      this.configWatcher.updateOptions(newOptions.watcher)
    }
    
    if (newOptions.recalculation) {
      this.recalculationService.updateOptions(newOptions.recalculation)
    }
    
    console.log('✅ 热更新管理器选项已更新:', this.options)
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalConfigChanges: 0,
      totalRecalculations: 0,
      lastConfigChange: undefined
    }
    console.log('✅ 统计信息已重置')
  }

  /**
   * 获取统计信息
   */
  getStats(): typeof this.stats {
    return { ...this.stats }
  }
}

export default ConfigHotReloadManager