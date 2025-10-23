/**
 * 性能监控工具
 * Performance Monitoring Utilities
 */

// Web Vitals 类型定义
interface WebVitalsMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
}

// 性能指标阈值
const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTI: { good: 3800, poor: 7300 }
}

// 性能监控类
export class PerformanceMonitor {
  private metrics: Map<string, WebVitalsMetric> = new Map()
  private observers: PerformanceObserver[] = []

  constructor() {
    this.initializeObservers()
  }

  // 初始化性能观察器
  private initializeObservers(): void {
    if (typeof window === 'undefined') return

    // 观察 LCP (Largest Contentful Paint)
    this.observeLCP()
    
    // 观察 FID (First Input Delay)
    this.observeFID()
    
    // 观察 CLS (Cumulative Layout Shift)
    this.observeCLS()
    
    // 观察资源加载性能
    this.observeResourceTiming()
  }

  // 观察 LCP
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        
        if (lastEntry) {
          this.recordMetric('LCP', lastEntry.startTime)
        }
      })
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('LCP observation not supported:', error)
    }
  }

  // 观察 FID
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          if (entry.name === 'first-input') {
            this.recordMetric('FID', entry.processingStart - entry.startTime)
          }
        })
      })
      
      observer.observe({ entryTypes: ['first-input'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('FID observation not supported:', error)
    }
  }

  // 观察 CLS
  private observeCLS(): void {
    try {
      let clsValue = 0
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
            this.recordMetric('CLS', clsValue)
          }
        })
      })
      
      observer.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('CLS observation not supported:', error)
    }
  }

  // 观察资源加载性能
  private observeResourceTiming(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          this.analyzeResourceTiming(entry as PerformanceResourceTiming)
        })
      })
      
      observer.observe({ entryTypes: ['resource'] })
      this.observers.push(observer)
    } catch (error) {
      console.warn('Resource timing observation not supported:', error)
    }
  }

  // 分析资源加载时间
  private analyzeResourceTiming(entry: PerformanceResourceTiming): void {
    const { name, duration, transferSize } = entry
    
    // 检查慢资源
    if (duration > 1000) {
      console.warn(`Slow resource detected: ${name} (${duration.toFixed(2)}ms)`)
    }
    
    // 检查大文件
    if (transferSize && transferSize > 500000) { // 500KB
      console.warn(`Large resource detected: ${name} (${(transferSize / 1024).toFixed(2)}KB)`)
    }
  }

  // 记录性能指标
  private recordMetric(name: string, value: number): void {
    const threshold = PERFORMANCE_THRESHOLDS[name as keyof typeof PERFORMANCE_THRESHOLDS]
    let rating: 'good' | 'needs-improvement' | 'poor' = 'good'
    
    if (threshold) {
      if (value > threshold.poor) {
        rating = 'poor'
      } else if (value > threshold.good) {
        rating = 'needs-improvement'
      }
    }

    const metric: WebVitalsMetric = {
      name,
      value,
      rating,
      delta: value,
      id: `${name}-${Date.now()}`
    }

    this.metrics.set(name, metric)
    
    // 在开发环境下输出性能指标
    if (import.meta.env.DEV) {
      console.log(`Performance Metric - ${name}:`, {
        value: `${value.toFixed(2)}${name === 'CLS' ? '' : 'ms'}`,
        rating,
        threshold: threshold ? `Good: <${threshold.good}, Poor: >${threshold.poor}` : 'N/A'
      })
    }
  }

  // 获取所有性能指标
  public getMetrics(): Map<string, WebVitalsMetric> {
    return new Map(this.metrics)
  }

  // 获取性能报告
  public getPerformanceReport(): {
    metrics: Record<string, WebVitalsMetric>
    summary: {
      good: number
      needsImprovement: number
      poor: number
    }
  } {
    const metricsArray = Array.from(this.metrics.values())
    const summary = {
      good: metricsArray.filter(m => m.rating === 'good').length,
      needsImprovement: metricsArray.filter(m => m.rating === 'needs-improvement').length,
      poor: metricsArray.filter(m => m.rating === 'poor').length
    }

    const metricsObject = Object.fromEntries(this.metrics)

    return {
      metrics: metricsObject,
      summary
    }
  }

  // 清理观察器
  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.metrics.clear()
  }
}

// 性能工具函数
export const performanceUtils = {
  // 测量函数执行时间
  measureFunction: <T extends (...args: any[]) => any>(
    fn: T,
    name?: string
  ): T => {
    return ((...args: Parameters<T>) => {
      const start = performance.now()
      const result = fn(...args)
      const end = performance.now()
      
      if (import.meta.env.DEV) {
        console.log(`Function ${name || fn.name} took ${(end - start).toFixed(2)}ms`)
      }
      
      return result
    }) as T
  },

  // 测量异步函数执行时间
  measureAsyncFunction: <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name?: string
  ): T => {
    return (async (...args: Parameters<T>) => {
      const start = performance.now()
      const result = await fn(...args)
      const end = performance.now()
      
      if (import.meta.env.DEV) {
        console.log(`Async function ${name || fn.name} took ${(end - start).toFixed(2)}ms`)
      }
      
      return result
    }) as T
  },

  // 节流函数
  throttle: <T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): T => {
    let lastCall = 0
    return ((...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        return fn(...args)
      }
    }) as T
  },

  // 防抖函数
  debounce: <T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): T => {
    let timeoutId: NodeJS.Timeout
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => fn(...args), delay)
    }) as T
  },

  // 检查是否为慢设备
  isSlowDevice: (): boolean => {
    if (typeof navigator === 'undefined') return false
    
    // 检查设备内存
    const deviceMemory = (navigator as any).deviceMemory
    if (deviceMemory && deviceMemory < 4) return true
    
    // 检查网络连接
    const connection = (navigator as any).connection
    if (connection) {
      const slowConnections = ['slow-2g', '2g', '3g']
      if (slowConnections.includes(connection.effectiveType)) return true
    }
    
    // 检查硬件并发数
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true
    
    return false
  },

  // 预加载资源
  preloadResource: (url: string, type: 'script' | 'style' | 'image' | 'font' = 'script'): Promise<void> => {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = url
      
      switch (type) {
        case 'script':
          link.as = 'script'
          break
        case 'style':
          link.as = 'style'
          break
        case 'image':
          link.as = 'image'
          break
        case 'font':
          link.as = 'font'
          link.crossOrigin = 'anonymous'
          break
      }
      
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`Failed to preload ${url}`))
      
      document.head.appendChild(link)
    })
  }
}

// 创建全局性能监控实例
export const globalPerformanceMonitor = new PerformanceMonitor()

// 在页面卸载时清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    globalPerformanceMonitor.cleanup()
  })
}