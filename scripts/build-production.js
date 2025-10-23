#!/usr/bin/env node

/**
 * 生产环境构建脚本
 * 确保生产构建的安全性和性能
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const PROJECT_ROOT = path.resolve(process.cwd())
const SRC_DIR = path.join(PROJECT_ROOT, 'src')
const DIST_DIR = path.join(PROJECT_ROOT, 'dist')

console.log('🚀 开始生产环境构建...')

// 1. 检查环境变量
function checkEnvironmentVariables() {
  console.log('📋 检查环境变量...')
  
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的环境变量:', missingVars.join(', '))
    process.exit(1)
  }
  
  console.log('✅ 环境变量检查通过')
}

// 2. 检查并移除调试代码
function checkForDebugCode() {
  console.log('🔍 检查调试代码...')
  
  const debugPatterns = [
    /console\.(log|debug|info|warn|error)/g,
    /debugger;?/g,
    /\/\*\s*DEBUG[\s\S]*?\*\//g,
    /\/\/\s*DEBUG.*/g,
    /\.only\(/g, // Jest/Vitest .only
    /\.skip\(/g  // Jest/Vitest .skip
  ]
  
  const excludePatterns = [
    /src\/utils\/logger\.ts/, // 排除日志工具文件
    /\.test\./,               // 排除测试文件
    /\.spec\./                // 排除规范文件
  ]
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir)
    const issues = []
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        issues.push(...scanDirectory(filePath))
      } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(file)) {
        // 检查是否应该排除此文件
        const relativePath = path.relative(PROJECT_ROOT, filePath)
        if (excludePatterns.some(pattern => pattern.test(relativePath))) {
          continue
        }
        
        const content = fs.readFileSync(filePath, 'utf8')
        
        debugPatterns.forEach((pattern, index) => {
          const matches = content.match(pattern)
          if (matches) {
            issues.push({
              file: relativePath,
              pattern: pattern.toString(),
              matches: matches.length
            })
          }
        })
      }
    }
    
    return issues
  }
  
  const issues = scanDirectory(SRC_DIR)
  
  if (issues.length > 0) {
    console.warn('⚠️  发现潜在的调试代码:')
    issues.forEach(issue => {
      console.warn(`   ${issue.file}: ${issue.matches} 个匹配 (${issue.pattern})`)
    })
    
    // 在生产环境构建时，这些应该被移除
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ 生产环境不允许包含调试代码')
      process.exit(1)
    }
  } else {
    console.log('✅ 未发现调试代码')
  }
}

// 3. 检查安全配置
function checkSecurityConfig() {
  console.log('🔒 检查安全配置...')
  
  // 检查是否有敏感信息硬编码
  const sensitivePatterns = [
    /password\s*[:=]\s*['"][^'"]+['"]/gi,
    /secret\s*[:=]\s*['"][^'"]+['"]/gi,
    /token\s*[:=]\s*['"][^'"]+['"]/gi,
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi
  ]
  
  function scanForSensitiveData(dir) {
    const files = fs.readdirSync(dir)
    const issues = []
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        issues.push(...scanForSensitiveData(filePath))
      } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(file)) {
        const content = fs.readFileSync(filePath, 'utf8')
        
        sensitivePatterns.forEach(pattern => {
          const matches = content.match(pattern)
          if (matches) {
            issues.push({
              file: path.relative(PROJECT_ROOT, filePath),
              matches: matches
            })
          }
        })
      }
    }
    
    return issues
  }
  
  const issues = scanForSensitiveData(SRC_DIR)
  
  if (issues.length > 0) {
    console.error('❌ 发现可能的敏感信息硬编码:')
    issues.forEach(issue => {
      console.error(`   ${issue.file}: ${issue.matches.join(', ')}`)
    })
    process.exit(1)
  }
  
  console.log('✅ 安全配置检查通过')
}

// 4. 优化构建配置
function optimizeBuildConfig() {
  console.log('⚡ 优化构建配置...')
  
  // 设置生产环境变量
  process.env.NODE_ENV = 'production'
  process.env.VITE_APP_ENV = 'production'
  
  console.log('✅ 构建配置优化完成')
}

// 5. 执行构建
function runBuild() {
  console.log('🔨 执行构建...')
  
  try {
    // 清理旧的构建文件
    if (fs.existsSync(DIST_DIR)) {
      execSync(`rm -rf ${DIST_DIR}`, { stdio: 'inherit' })
    }
    
    // 执行构建
    execSync('npm run build', { stdio: 'inherit' })
    
    console.log('✅ 构建完成')
  } catch (error) {
    console.error('❌ 构建失败:', error.message)
    process.exit(1)
  }
}

// 6. 构建后检查
function postBuildCheck() {
  console.log('🔍 构建后检查...')
  
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ 构建目录不存在')
    process.exit(1)
  }
  
  // 检查关键文件
  const criticalFiles = ['index.html']
  for (const file of criticalFiles) {
    if (!fs.existsSync(path.join(DIST_DIR, file))) {
      console.error(`❌ 关键文件缺失: ${file}`)
      process.exit(1)
    }
  }
  
  // 检查构建大小
  const stats = fs.statSync(DIST_DIR)
  console.log(`📦 构建目录大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  
  console.log('✅ 构建后检查通过')
}

// 主流程
async function main() {
  try {
    checkEnvironmentVariables()
    checkForDebugCode()
    checkSecurityConfig()
    optimizeBuildConfig()
    runBuild()
    postBuildCheck()
    
    console.log('🎉 生产环境构建成功完成!')
  } catch (error) {
    console.error('❌ 构建过程中发生错误:', error.message)
    process.exit(1)
  }
}

main()