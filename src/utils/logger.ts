/**
 * 生产环境日志工具
 * 在开发环境输出日志，在生产环境静默或发送到监控系统
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel
  message: string
  data?: any
  timestamp: Date
  source?: string
}

class Logger {
  private isDevelopment = import.meta.env.DEV
  private minLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR
  private logs: LogEntry[] = []
  private maxLogs = 1000

  debug(message: string, data?: any, source?: string) {
    this.log(LogLevel.DEBUG, message, data, source)
  }

  info(message: string, data?: any, source?: string) {
    this.log(LogLevel.INFO, message, data, source)
  }

  warn(message: string, data?: any, source?: string) {
    this.log(LogLevel.WARN, message, data, source)
  }

  error(message: string, data?: any, source?: string) {
    this.log(LogLevel.ERROR, message, data, source)
  }

  private log(level: LogLevel, message: string, data?: any, source?: string) {
    if (level < this.minLevel) {
      return
    }

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      source
    }

    // 存储日志条目
    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // 在开发环境输出到控制台
    if (this.isDevelopment) {
      const prefix = source ? `[${source}]` : ''
      const timestamp = entry.timestamp.toISOString()
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(`${timestamp} ${prefix} ${message}`, data || '')
          break
        case LogLevel.INFO:
          console.info(`${timestamp} ${prefix} ${message}`, data || '')
          break
        case LogLevel.WARN:
          console.warn(`${timestamp} ${prefix} ${message}`, data || '')
          break
        case LogLevel.ERROR:
          console.error(`${timestamp} ${prefix} ${message}`, data || '')
          break
      }
    } else {
      // 生产环境：只处理错误级别的日志
      if (level === LogLevel.ERROR) {
        // 这里可以集成错误监控服务，如 Sentry
        this.sendToMonitoring(entry)
      }
    }
  }

  private sendToMonitoring(entry: LogEntry) {
    // 在生产环境中，可以将错误发送到监控服务
    // 例如：Sentry.captureException(new Error(entry.message))
    
    // 目前只在控制台输出错误
    console.error(`[${entry.timestamp.toISOString()}] ${entry.message}`, entry.data)
  }

  // 获取最近的日志条目
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count)
  }

  // 获取错误日志
  getErrorLogs(): LogEntry[] {
    return this.logs.filter(log => log.level === LogLevel.ERROR)
  }

  // 清理日志
  clearLogs() {
    this.logs = []
  }

  // 导出日志（用于调试）
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

// 创建全局日志实例
export const logger = new Logger()

// 便捷的日志函数
export const log = {
  debug: (message: string, data?: any, source?: string) => logger.debug(message, data, source),
  info: (message: string, data?: any, source?: string) => logger.info(message, data, source),
  warn: (message: string, data?: any, source?: string) => logger.warn(message, data, source),
  error: (message: string, data?: any, source?: string) => logger.error(message, data, source)
}