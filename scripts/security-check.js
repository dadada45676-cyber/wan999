#!/usr/bin/env node

/**
 * 安全检查脚本
 * 检查代码中的安全问题和敏感信息
 */

import fs from 'fs'
import path from 'path'

const PROJECT_ROOT = path.resolve(process.cwd())
const SRC_DIR = path.join(PROJECT_ROOT, 'src')

console.log('🔒 开始安全检查...')

// 敏感信息模式
const SENSITIVE_PATTERNS = [
  {
    name: '硬编码密码',
    pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/gi, // 只检查8位以上的密码
    severity: 'high',
    exclude: [
      /请输入.*密码/,
      /密码.*不一致/,
      /密码.*相同/,
      /密码长度/,
      /placeholder.*password/i
    ]
  },
  {
    name: '硬编码密钥',
    pattern: /secret\s*[:=]\s*['"][^'"]{10,}['"]/gi,
    severity: 'high'
  },
  {
    name: '硬编码Token',
    pattern: /token\s*[:=]\s*['"][^'"]{10,}['"]/gi,
    severity: 'high'
  },
  {
    name: '硬编码API密钥',
    pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{10,}['"]/gi,
    severity: 'high'
  },
  {
    name: 'Supabase密钥',
    pattern: /eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    severity: 'high'
  },
  {
    name: '数据库连接字符串',
    pattern: /(postgres|mysql|mongodb):\/\/[^\s'"]+/gi,
    severity: 'high'
  }
]

// 安全问题模式
const SECURITY_PATTERNS = [
  {
    name: 'eval使用',
    pattern: /\beval\s*\(/g,
    severity: 'high'
  },
  {
    name: 'innerHTML使用',
    pattern: /\.innerHTML\s*=/g,
    severity: 'medium'
  },
  {
    name: 'document.write使用',
    pattern: /document\.write\s*\(/g,
    severity: 'medium'
  },
  {
    name: 'localStorage敏感数据',
    pattern: /localStorage\.setItem\s*\(\s*['"][^'"]*(?:password|token|secret|key)[^'"]*['"][^)]*\)/gi,
    severity: 'medium'
  },
  {
    name: 'sessionStorage敏感数据',
    pattern: /sessionStorage\.setItem\s*\(\s*['"][^'"]*(?:password|token|secret|key)[^'"]*['"][^)]*\)/gi,
    severity: 'medium'
  }
]

// 调试代码模式
const DEBUG_PATTERNS = [
  {
    name: 'console.log',
    pattern: /console\.log\s*\(/g,
    severity: 'low'
  },
  {
    name: 'console.debug',
    pattern: /console\.debug\s*\(/g,
    severity: 'low'
  },
  {
    name: 'debugger语句',
    pattern: /\bdebugger\b/g,
    severity: 'medium'
  },
  {
    name: 'alert使用',
    pattern: /\balert\s*\(/g,
    severity: 'low'
  }
]

// 排除的文件模式
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /coverage/,
  /\.test\./,
  /\.spec\./,
  /scripts\/.*\.js$/,
  /src\/utils\/logger\.ts$/ // 排除日志工具文件
]

function shouldExcludeFile(filePath) {
  const relativePath = path.relative(PROJECT_ROOT, filePath)
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(relativePath))
}

function scanFile(filePath) {
  if (shouldExcludeFile(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const relativePath = path.relative(PROJECT_ROOT, filePath)
  const issues = []

  // 检查敏感信息
  SENSITIVE_PATTERNS.forEach(({ name, pattern, severity, exclude = [] }) => {
    const matches = [...content.matchAll(pattern)]
    matches.forEach(match => {
      // 检查是否应该排除这个匹配
      const shouldExclude = exclude.some(excludePattern => 
        excludePattern.test(match[0])
      )
      
      if (!shouldExclude) {
        issues.push({
          file: relativePath,
          type: 'sensitive',
          name,
          severity,
          line: content.substring(0, match.index).split('\n').length,
          match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : '')
        })
      }
    })
  })

  // 检查安全问题
  SECURITY_PATTERNS.forEach(({ name, pattern, severity }) => {
    const matches = [...content.matchAll(pattern)]
    matches.forEach(match => {
      issues.push({
        file: relativePath,
        type: 'security',
        name,
        severity,
        line: content.substring(0, match.index).split('\n').length,
        match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : '')
      })
    })
  })

  // 检查调试代码
  DEBUG_PATTERNS.forEach(({ name, pattern, severity }) => {
    const matches = [...content.matchAll(pattern)]
    matches.forEach(match => {
      issues.push({
        file: relativePath,
        type: 'debug',
        name,
        severity,
        line: content.substring(0, match.index).split('\n').length,
        match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : '')
      })
    })
  })

  return issues
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir)
  let allIssues = []

  for (const file of files) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      allIssues = allIssues.concat(scanDirectory(filePath))
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx|vue)$/.test(file)) {
      allIssues = allIssues.concat(scanFile(filePath))
    }
  }

  return allIssues
}

function generateReport(issues) {
  const groupedIssues = {
    high: issues.filter(issue => issue.severity === 'high'),
    medium: issues.filter(issue => issue.severity === 'medium'),
    low: issues.filter(issue => issue.severity === 'low')
  }

  console.log('\n📊 安全检查报告')
  console.log('=' .repeat(50))

  if (groupedIssues.high.length > 0) {
    console.log('\n🚨 高风险问题:')
    groupedIssues.high.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line} - ${issue.name}`)
      console.log(`      ${issue.match}`)
    })
  }

  if (groupedIssues.medium.length > 0) {
    console.log('\n⚠️  中风险问题:')
    groupedIssues.medium.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line} - ${issue.name}`)
      console.log(`      ${issue.match}`)
    })
  }

  if (groupedIssues.low.length > 0) {
    console.log('\n💡 低风险问题:')
    groupedIssues.low.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line} - ${issue.name}`)
    })
  }

  console.log('\n📈 统计信息:')
  console.log(`   高风险: ${groupedIssues.high.length}`)
  console.log(`   中风险: ${groupedIssues.medium.length}`)
  console.log(`   低风险: ${groupedIssues.low.length}`)
  console.log(`   总计: ${issues.length}`)

  return groupedIssues
}

function main() {
  try {
    const issues = scanDirectory(SRC_DIR)
    const groupedIssues = generateReport(issues)

    // 检查环境变量文件
    const envFiles = ['.env', '.env.local', '.env.production']
    envFiles.forEach(envFile => {
      const envPath = path.join(PROJECT_ROOT, envFile)
      if (fs.existsSync(envPath)) {
        console.log(`\n🔍 检查环境变量文件: ${envFile}`)
        const envContent = fs.readFileSync(envPath, 'utf8')
        
        // 检查是否有明文密码或密钥
        const sensitiveInEnv = SENSITIVE_PATTERNS.some(({ pattern }) => 
          pattern.test(envContent)
        )
        
        if (sensitiveInEnv) {
          console.log(`   ⚠️  ${envFile} 可能包含敏感信息`)
        } else {
          console.log(`   ✅ ${envFile} 检查通过`)
        }
      }
    })

    // 根据风险级别决定退出码
    if (groupedIssues.high.length > 0) {
      console.log('\n❌ 发现高风险安全问题，构建应该被阻止')
      process.exit(1)
    } else if (groupedIssues.medium.length > 0) {
      console.log('\n⚠️  发现中风险问题，建议修复后再部署')
      if (process.env.NODE_ENV === 'production') {
        process.exit(1)
      }
    } else if (groupedIssues.low.length > 0) {
      console.log('\n💡 发现低风险问题，建议清理')
    } else {
      console.log('\n✅ 未发现安全问题')
    }

    console.log('\n🎉 安全检查完成')
  } catch (error) {
    console.error('❌ 安全检查失败:', error.message)
    process.exit(1)
  }
}

main()