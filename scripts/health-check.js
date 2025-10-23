#!/usr/bin/env node

/**
 * 生产环境健康检查脚本
 * 检查部署后的应用是否正常运行
 */

const https = require('https')
const http = require('http')

// 配置
const HEALTH_CHECK_CONFIG = {
  timeout: 10000,
  retries: 3,
  retryDelay: 2000,
  endpoints: [
    {
      name: '主页',
      url: process.env.VERCEL_URL || 'https://your-app.vercel.app',
      expectedStatus: 200,
      expectedContent: ['<!DOCTYPE html>', '<title>']
    },
    {
      name: 'API健康检查',
      url: (process.env.VERCEL_URL || 'https://your-app.vercel.app') + '/api/health',
      expectedStatus: 200,
      expectedContent: ['status', 'ok']
    }
  ]
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

// HTTP请求函数
function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https')
    const client = isHttps ? https : http
    
    const req = client.get(url, { timeout }, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        })
      })
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    
    req.on('error', (err) => {
      reject(err)
    })
  })
}

// 检查单个端点
async function checkEndpoint(endpoint, retries = 0) {
  try {
    log(`🔍 检查 ${endpoint.name}: ${endpoint.url}`, 'cyan')
    
    const response = await makeRequest(endpoint.url, HEALTH_CHECK_CONFIG.timeout)
    
    // 检查状态码
    if (response.status !== endpoint.expectedStatus) {
      throw new Error(`状态码错误: 期望 ${endpoint.expectedStatus}, 实际 ${response.status}`)
    }
    
    // 检查内容
    if (endpoint.expectedContent) {
      for (const content of endpoint.expectedContent) {
        if (!response.body.includes(content)) {
          throw new Error(`内容检查失败: 未找到 "${content}"`)
        }
      }
    }
    
    log(`✅ ${endpoint.name} 检查通过`, 'green')
    return {
      success: true,
      endpoint: endpoint.name,
      status: response.status,
      responseTime: Date.now()
    }
    
  } catch (error) {
    if (retries < HEALTH_CHECK_CONFIG.retries) {
      log(`⚠️  ${endpoint.name} 检查失败，${HEALTH_CHECK_CONFIG.retryDelay/1000}秒后重试... (${retries + 1}/${HEALTH_CHECK_CONFIG.retries})`, 'yellow')
      await new Promise(resolve => setTimeout(resolve, HEALTH_CHECK_CONFIG.retryDelay))
      return checkEndpoint(endpoint, retries + 1)
    }
    
    log(`❌ ${endpoint.name} 检查失败: ${error.message}`, 'red')
    return {
      success: false,
      endpoint: endpoint.name,
      error: error.message
    }
  }
}

// 主函数
async function runHealthCheck() {
  log('🚀 开始生产环境健康检查...', 'blue')
  log('='.repeat(50), 'blue')
  
  const results = []
  let allPassed = true
  
  for (const endpoint of HEALTH_CHECK_CONFIG.endpoints) {
    const result = await checkEndpoint(endpoint)
    results.push(result)
    
    if (!result.success) {
      allPassed = false
    }
  }
  
  // 输出总结
  log('='.repeat(50), 'blue')
  log('📋 健康检查结果:', 'blue')
  
  for (const result of results) {
    if (result.success) {
      log(`✅ ${result.endpoint}: 正常`, 'green')
    } else {
      log(`❌ ${result.endpoint}: ${result.error}`, 'red')
    }
  }
  
  if (allPassed) {
    log('🎉 所有健康检查通过！应用运行正常', 'green')
    process.exit(0)
  } else {
    log('⚠️  部分健康检查失败，请检查应用状态', 'red')
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

// 运行健康检查
if (require.main === module) {
  runHealthCheck()
}

module.exports = { runHealthCheck, checkEndpoint }