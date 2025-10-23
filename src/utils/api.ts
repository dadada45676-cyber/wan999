// API工具类 - 统一错误处理、缓存和性能优化

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

interface RequestConfig {
  cache?: boolean
  cacheTTL?: number
  retries?: number
  timeout?: number
  operation?: string
}

interface APIError {
  code: string
  message: string
  details?: any
  timestamp?: number
  operation?: string
}

interface APIResponse<T> {
  success: boolean
  data?: T
  error?: APIError
}

// API缓存管理器
class APICache {
  private cache = new Map<string, CacheItem<any>>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5分钟

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    const now = Date.now()
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// 请求去重管理器
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>()

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // 如果已有相同请求在进行中，返回该请求的Promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!
    }

    // 创建新请求
    const promise = requestFn().finally(() => {
      // 请求完成后清理
      this.pendingRequests.delete(key)
    })

    this.pendingRequests.set(key, promise)
    return promise
  }

  clear(): void {
    this.pendingRequests.clear()
  }
}

// 性能监控器
class PerformanceMonitor {
  private metrics = new Map<string, number[]>()

  recordMetric(key: string, duration: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const values = this.metrics.get(key)!
    values.push(duration)
    
    // 保持最近100个记录
    if (values.length > 100) {
      values.shift()
    }
  }

  getStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {}
    
    for (const [key, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[key] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        }
      }
    }
    
    return result
  }

  getMetrics(key: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(key)
    if (!values || values.length === 0) return null
    
    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    }
  }
}

// API工具类
export class APIUtils {
  static cache = new APICache()
  static requestDeduplicator = new RequestDeduplicator()
  static performanceMonitor = new PerformanceMonitor()
  private static initialized = false

  static initialize(): void {
    if (this.initialized) return
    
    // 启动定期清理
    setInterval(() => {
      this.cache.cleanup()
    }, 10 * 60 * 1000) // 每10分钟清理一次过期缓存
    
    this.initialized = true
  }

  static async apiCall<T>(
    requestFn: () => Promise<T>,
    config: RequestConfig = {}
  ): Promise<APIResponse<T>> {
    const {
      cache = false,
      cacheTTL = 5 * 60 * 1000,
      retries = 2,
      timeout = 30000,
      operation = 'unknown'
    } = config

    const cacheKey = cache ? `${operation}_${JSON.stringify(config)}` : null
    const startTime = performance.now()

    try {
      // 检查缓存
      if (cache && cacheKey) {
        const cachedData = this.cache.get<T>(cacheKey)
        if (cachedData !== null) {
          return { success: true, data: cachedData }
        }
      }

      // 执行请求（带去重）
      const requestKey = `${operation}_${Date.now()}`
      const result = await this.requestDeduplicator.deduplicate(
        requestKey,
        () => this.executeWithRetry(requestFn, retries, timeout)
      )

      // 缓存结果
      if (cache && cacheKey) {
        this.cache.set(cacheKey, result, cacheTTL)
      }

      // 记录性能
      const duration = performance.now() - startTime
      this.performanceMonitor.recordMetric(operation, duration)

      return { success: true, data: result }
    } catch (error) {
      const duration = performance.now() - startTime
      this.performanceMonitor.recordMetric(`${operation}_error`, duration)
      
      return {
        success: false,
        error: this.normalizeError(error, operation)
      }
    }
  }

  private static async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    retries: number,
    timeout: number
  ): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.withTimeout(requestFn(), timeout)
      } catch (error) {
        lastError = error
        
        // 如果是最后一次尝试，直接抛出错误
        if (attempt === retries) {
          throw error
        }
        
        // 等待一段时间后重试（指数退避）
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  private static withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`请求超时 (${timeout}ms)`)), timeout)
      )
    ])
  }

  private static normalizeError(error: any, operation?: string): APIError {
    const timestamp = Date.now()
    
    if (error?.code && error?.message) {
      return {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp,
        operation
      }
    }

    if (error instanceof Error) {
      // 处理常见错误类型
      if (error.message.includes('网络')) {
        return {
          code: 'NETWORK_ERROR',
          message: '网络连接失败，请检查网络设置',
          details: error.message,
          timestamp,
          operation
        }
      }
      
      if (error.message.includes('超时')) {
        return {
          code: 'TIMEOUT_ERROR',
          message: '请求超时，请稍后重试',
          details: error.message,
          timestamp,
          operation
        }
      }
      
      if (error.message.includes('权限') || error.message.includes('认证')) {
        return {
          code: 'AUTH_ERROR',
          message: '认证失败，请重新登录',
          details: error.message,
          timestamp,
          operation
        }
      }

      return {
        code: 'UNKNOWN_ERROR',
        message: error.message || '未知错误',
        details: error.stack,
        timestamp,
        operation
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: '发生未知错误',
      details: String(error),
      timestamp,
      operation
    }
  }

  // 批量请求处理
  static async batchRequests<T>(
    requests: Array<{ key: string; requestFn: () => Promise<T>; config?: RequestConfig }>,
    concurrency: number = 5
  ): Promise<Array<APIResponse<T>>> {
    const results: Array<APIResponse<T>> = []
    
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency)
      const batchPromises = batch.map(({ requestFn, config }) =>
        this.apiCall(requestFn, config)
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }

  // 工具方法
  static clearCache(): void {
    this.cache.clear()
  }

  static getCacheStats() {
    return this.cache.getStats()
  }

  static getPerformanceStats() {
    return this.performanceMonitor.getStats()
  }
}

// 初始化API工具
APIUtils.initialize()