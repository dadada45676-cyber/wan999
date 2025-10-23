#!/usr/bin/env node

/**
 * 生产环境性能测试脚本
 * 测试应用的性能指标
 */

const https = require('https')
const http = require('http')

// 配置
const PERFORMANCE_CONFIG = {
  testDuration: 30000, // 30秒
  concurrentUsers: 10,
  requestInterval: 1000, // 1秒
  endpoints: [
    {
      name: '主页',
      url: process.env.VERCEL_URL || 'https://your-app.vercel.app',
      weight: 0.4
    },
    {
      name: '登录页面',
      url: (process.env.VERCEL_URL || 'https://your-app.vercel.app') + '/login',
      weight: 0.3
    },
    {
      name: 'API健康检查',
      url: (process.env.VERCEL_URL || 'https://your-app.vercel.app') + '/api/health',
      weight: 0.3
    }
  ],
  thresholds: {
    averageResponseTime: 2000, // 2秒
    p95ResponseTime: 5000, // 5秒
    errorRate: 0.05, // 5%
    throughput: 10 // 每秒请求数
  }
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 性能统计
class PerformanceStats {
  constructor() {
    this.requests = []
    this.errors = []
    this.startTime = Date.now()
  }

  addRequest(responseTime, success, endpoint) {
    this.requests.push({
      responseTime,
      success,
      endpoint,
      timestamp: Date.now()
    })

    if (!success) {
      this.errors.push({
        endpoint,
        timestamp: Date.now()
      })
    }
  }

  getStats() {
    const totalRequests = this.requests.length
    const successfulRequests = this.requests.filter(r => r.success).length
    const errorRate = totalRequests > 0 ? (totalRequests - successfulRequests) / totalRequests : 0
    
    const responseTimes = this.requests
      .filter(r => r.success)
      .map(r => r.responseTime)
      .sort((a, b) => a - b)

    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0

    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p95ResponseTime = responseTimes.length > 0 ? responseTimes[p95Index] || 0 : 0

    const duration = (Date.now() - this.startTime) / 1000
    const throughput = totalRequests / duration

    return {
      totalRequests,
      successfulRequests,
      errorRate,
      averageResponseTime,
      p95ResponseTime,
      throughput,
      duration
    }
  }
}

// HTTP请求函数
function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const isHttps = url.startsWith('https')
    const client = isHttps ? https : http
    
    const req = client.get(url, { timeout }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime
        resolve({
          status: res.statusCode,
          responseTime,
          success: res.statusCode >= 200 && res.statusCode < 400
        })
      })
    })
    
    req.on('timeout', () => {
      req.destroy()
      const responseTime = Date.now() - startTime
      reject(new Error(`Request timeout after ${responseTime}ms`))
    })
    
    req.on('error', (err) => {
      const responseTime = Date.now() - startTime
      reject({ ...err, responseTime })
    })
  })
}

// 单个用户模拟
async function simulateUser(userId, stats) {
  const endTime = Date.now() + PERFORMANCE_CONFIG.testDuration
  
  while (Date.now() < endTime) {
    // 随机选择端点
    const randomEndpoint = PERFORMANCE_CONFIG.endpoints[
      Math.floor(Math.random() * PERFORMANCE_CONFIG.endpoints.length)
    ]
    
    try {
      const result = await makeRequest(randomEndpoint.url)
      stats.addRequest(result.responseTime, result.success, randomEndpoint.name)
      
      if (result.success) {
        log(`👤 用户${userId}: ${randomEndpoint.name} - ${result.responseTime}ms`, 'cyan')
      } else {
        log(`👤 用户${userId}: ${randomEndpoint.name} - 失败 (${result.status})`, 'yellow')
      }
    } catch (error) {
      stats.addRequest(error.responseTime || 0, false, randomEndpoint.name)
      log(`👤 用户${userId}: ${randomEndpoint.name} - 错误: ${error.message}`, 'red')
    }
    
    // 等待间隔
    await new Promise(resolve => setTimeout(resolve, PERFORMANCE_CONFIG.requestInterval))
  }
}

// 主函数
async function runPerformanceTest() {
  log('🚀 开始生产环境性能测试...', 'blue')
  log(`📊 配置: ${PERFORMANCE_CONFIG.concurrentUsers}个并发用户, ${PERFORMANCE_CONFIG.testDuration/1000}秒`, 'blue')
  log('='.repeat(60), 'blue')
  
  const stats = new PerformanceStats()
  
  // 启动并发用户
  const userPromises = []
  for (let i = 1; i <= PERFORMANCE_CONFIG.concurrentUsers; i++) {
    userPromises.push(simulateUser(i, stats))
  }
  
  // 等待所有用户完成
  await Promise.all(userPromises)
  
  // 分析结果
  const results = stats.getStats()
  
  log('='.repeat(60), 'blue')
  log('📋 性能测试结果:', 'blue')
  log(`📈 总请求数: ${results.totalRequests}`, 'cyan')
  log(`✅ 成功请求: ${results.successfulRequests}`, 'green')
  log(`❌ 错误率: ${(results.errorRate * 100).toFixed(2)}%`, results.errorRate > PERFORMANCE_CONFIG.thresholds.errorRate ? 'red' : 'green')
  log(`⏱️  平均响应时间: ${results.averageResponseTime.toFixed(2)}ms`, results.averageResponseTime > PERFORMANCE_CONFIG.thresholds.averageResponseTime ? 'red' : 'green')
  log(`📊 95%响应时间: ${results.p95ResponseTime.toFixed(2)}ms`, results.p95ResponseTime > PERFORMANCE_CONFIG.thresholds.p95ResponseTime ? 'red' : 'green')
  log(`🚀 吞吐量: ${results.throughput.toFixed(2)} 请求/秒`, results.throughput < PERFORMANCE_CONFIG.thresholds.throughput ? 'red' : 'green')
  log(`⏰ 测试时长: ${results.duration.toFixed(2)}秒`, 'cyan')
  
  // 检查是否通过阈值
  const passed = 
    results.errorRate <= PERFORMANCE_CONFIG.thresholds.errorRate &&
    results.averageResponseTime <= PERFORMANCE_CONFIG.thresholds.averageResponseTime &&
    results.p95ResponseTime <= PERFORMANCE_CONFIG.thresholds.p95ResponseTime &&
    results.throughput >= PERFORMANCE_CONFIG.thresholds.throughput
  
  if (passed) {
    log('🎉 性能测试通过！应用性能良好', 'green')
    process.exit(0)
  } else {
    log('⚠️  性能测试未通过，请优化应用性能', 'red')
    process.exit(1)
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  log(`❌ 未捕获的异常: ${error.message}`, 'red')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ 未处理的Promise拒绝: ${reason}`, 'red')
  process.exit(1)
})

// 运行性能测试
if (require.main === module) {
  runPerformanceTest()
}

module.exports = { runPerformanceTest, PerformanceStats }