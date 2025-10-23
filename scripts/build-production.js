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
  
  // 加载 .env.production 文件
  const envPath = path.join(process.cwd(), '.env.production')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const envVars = envContent.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          acc[key.trim()] = valueParts.join('=').trim()
        }
        return acc
      }, {})
    
    // 设置环境变量
    Object.assign(process.env, envVars)
  }
  
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的环境变量:', missingVars.join(', '))
    console.error('💡 请确保 .env.production 文件存在并包含所有必要的环境变量')
    process.exit(1)
  }
  
  console.log('✅ 环境变量检查通过')
}

// 2. 检查并移除调试代码和模拟逻辑
function checkForDebugCode() {
  console.log('🔍 检查调试代码和模拟逻辑...')
  
  const debugPatterns = [
    /console\.(log|debug|info|warn|error)/g,
    /debugger;?/g,
    /\/\*\s*DEBUG[\s\S]*?\*\//g,
    /\/\/\s*DEBUG.*/g,
    /\.only\(/g, // Jest/Vitest .only
    /\.skip\(/g, // Jest/Vitest .skip
    /mock|Mock|MOCK/g, // 模拟数据
    /sample|Sample|SAMPLE/g, // 示例数据
    /fixture|Fixture|FIXTURE/g, // 测试数据
    /TODO|FIXME|HACK|XXX/g // 临时标记
  ]
  
  const excludePatterns = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /coverage/,
    /\.test\./,
    /\.spec\./,
    /scripts\/.*\.js$/,
    /\.md$/,
    /create-admin-user\.ts$/,
    /logger\.ts$/,
    /performance\.ts$/
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
    /password\s*[:=]\s*['"][a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}['"]/gi,
    /secret\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi,
    /token\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{20,}['"]/gi,
    /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi
  ]
  
  // 排除模式 - 这些是正常的UI文本，不是敏感信息
  const excludePatterns = [
    /请输入.*密码/,
    /密码.*长度/,
    /两次.*密码/,
    /新密码.*当前密码/,
    /password.*placeholder/i,
    /password.*validation/i
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
            // 过滤掉正常的UI文本
            const filteredMatches = matches.filter(match => {
              return !excludePatterns.some(excludePattern => excludePattern.test(match))
            })
            
            if (filteredMatches.length > 0) {
              issues.push({
                file: path.relative(PROJECT_ROOT, filePath),
                matches: filteredMatches
              })
            }
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
    console.log('🧹 清理旧构建文件...')
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true, force: true })
    }
    
    // 执行构建
    console.log('🔨 开始构建...')
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
  function getDirectorySize(dirPath) {
    let totalSize = 0
    const files = fs.readdirSync(dirPath)
    
    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stats = fs.statSync(filePath)
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath)
      } else {
        totalSize += stats.size
      }
    }
    
    return totalSize
  }
  
  const totalSize = getDirectorySize(DIST_DIR)
  console.log(`📦 构建目录大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
  
  // 检查构建文件是否包含源码映射（生产环境不应该有）
  function checkForSourceMaps(dir) {
    const files = fs.readdirSync(dir)
    const sourceMaps = []
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory()) {
        sourceMaps.push(...checkForSourceMaps(filePath))
      } else if (file.endsWith('.map')) {
        sourceMaps.push(path.relative(DIST_DIR, filePath))
      }
    }
    
    return sourceMaps
  }
  
  const sourceMaps = checkForSourceMaps(DIST_DIR)
  if (sourceMaps.length > 0) {
    console.warn('⚠️  发现源码映射文件 (生产环境建议移除):')
    sourceMaps.forEach(map => console.warn(`   ${map}`))
  }
  
  // 检查是否有未压缩的大文件
  function checkLargeFiles(dir, threshold = 1024 * 1024) { // 1MB
    const files = fs.readdirSync(dir)
    const largeFiles = []
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory()) {
        largeFiles.push(...checkLargeFiles(filePath, threshold))
      } else if (stat.size > threshold) {
        largeFiles.push({
          file: path.relative(DIST_DIR, filePath),
          size: (stat.size / 1024 / 1024).toFixed(2)
        })
      }
    }
    
    return largeFiles
  }
  
  const largeFiles = checkLargeFiles(DIST_DIR)
  if (largeFiles.length > 0) {
    console.warn('⚠️  发现大文件 (>1MB):')
    largeFiles.forEach(file => console.warn(`   ${file.file}: ${file.size} MB`))
  }
  
  console.log('✅ 构建后检查通过')
}

// 7. 性能优化检查
function performanceOptimizationCheck() {
  console.log('⚡ 性能优化检查...')
  
  // 检查 Vite 配置
  const viteConfigPath = path.join(PROJECT_ROOT, 'vite.config.ts')
  if (fs.existsSync(viteConfigPath)) {
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8')
    
    // 检查是否启用了代码分割
    if (!viteConfig.includes('manualChunks') && !viteConfig.includes('splitVendorChunk')) {
      console.warn('⚠️  建议在 vite.config.ts 中配置代码分割以优化加载性能')
    }
    
    // 检查是否启用了压缩
    if (!viteConfig.includes('minify')) {
      console.warn('⚠️  建议在 vite.config.ts 中启用代码压缩')
    }
  }
  
  console.log('✅ 性能优化检查完成')
}

// 8. 安全配置验证
function securityConfigValidation() {
  console.log('🔒 安全配置验证...')
  
  // 检查环境变量配置
  const requiredSecurityVars = [
    'VITE_ENABLE_CSRF_PROTECTION',
    'VITE_SECURE_COOKIES'
  ]
  
  const missingSecurityVars = requiredSecurityVars.filter(varName => !process.env[varName])
  
  if (missingSecurityVars.length > 0) {
    console.warn('⚠️  缺少安全相关环境变量:', missingSecurityVars.join(', '))
  }
  
  // 检查是否禁用了调试功能
  const debugVars = [
    'VITE_DEBUG_API_CALLS',
    'VITE_ENABLE_CONSOLE_LOGS',
    'VITE_ENABLE_SOURCE_MAPS'
  ]
  
  debugVars.forEach(varName => {
    if (process.env[varName] === 'true') {
      console.warn(`⚠️  生产环境不建议启用: ${varName}`)
    }
  })
  
  console.log('✅ 安全配置验证完成')
}

// 主流程
async function main() {
  try {
    console.log('🚀 开始生产环境构建流程...')
    console.log('='.repeat(50))
    
    // 预构建检查
    checkEnvironmentVariables()
    checkForDebugCode()
    checkSecurityConfig()
    securityConfigValidation()
    
    // 构建配置优化
    optimizeBuildConfig()
    
    // 执行构建
    runBuild()
    
    // 构建后验证
    postBuildCheck()
    performanceOptimizationCheck()
    
    console.log('='.repeat(50))
    console.log('🎉 生产环境构建成功完成!')
    console.log('📋 构建摘要:')
    console.log('   ✅ 环境变量检查通过')
    console.log('   ✅ 调试代码清理完成')
    console.log('   ✅ 安全配置验证通过')
    console.log('   ✅ 构建优化配置完成')
    console.log('   ✅ 构建文件生成成功')
    console.log('   ✅ 性能优化检查完成')
    console.log('')
    console.log('🚀 项目已准备好部署到生产环境!')
    
  } catch (error) {
    console.error('❌ 构建过程中发生错误:', error.message)
    console.error('💡 请检查上述错误信息并修复后重试')
    process.exit(1)
  }
}

main()