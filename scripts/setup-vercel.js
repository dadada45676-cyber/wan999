#!/usr/bin/env node

/**
 * SMS营销数据分析系统 - Vercel 项目配置脚本
 * 
 * 此脚本帮助自动化配置 Vercel 项目和环境变量
 * 使用方法: node scripts/setup-vercel.js
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n📋 步骤 ${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 检查命令是否存在
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 执行命令并返回输出
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
    return output?.trim();
  } catch (error) {
    if (!options.silent) {
      logError(`命令执行失败: ${command}`);
      logError(error.message);
    }
    throw error;
  }
}

// 读取环境变量文件
function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  
  const content = readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

// 主要配置流程
async function setupVercel() {
  log('🚀 SMS营销数据分析系统 - Vercel 配置向导', 'bright');
  log('=' .repeat(50), 'blue');

  // 步骤 1: 检查依赖
  logStep(1, '检查必要依赖');
  
  if (!commandExists('vercel')) {
    logError('Vercel CLI 未安装');
    log('请运行: npm install -g vercel', 'yellow');
    process.exit(1);
  }
  logSuccess('Vercel CLI 已安装');

  if (!commandExists('git')) {
    logWarning('Git 未安装，建议安装以获得更好的部署体验');
  } else {
    logSuccess('Git 已安装');
  }

  // 步骤 2: 登录 Vercel
  logStep(2, '检查 Vercel 登录状态');
  
  try {
    const whoami = runCommand('vercel whoami', { silent: true });
    logSuccess(`已登录 Vercel，用户: ${whoami}`);
  } catch {
    log('请先登录 Vercel:', 'yellow');
    runCommand('vercel login');
  }

  // 步骤 3: 初始化项目
  logStep(3, '初始化 Vercel 项目');
  
  try {
    // 检查是否已经链接项目
    if (existsSync('.vercel/project.json')) {
      logSuccess('项目已链接到 Vercel');
    } else {
      log('正在链接项目到 Vercel...', 'yellow');
      runCommand('vercel link');
      logSuccess('项目已成功链接到 Vercel');
    }
  } catch (error) {
    logError('项目链接失败');
    throw error;
  }

  // 步骤 4: 配置环境变量
  logStep(4, '配置环境变量');
  
  const envFiles = ['.env.local', '.env.example'];
  let envVars = {};
  
  for (const file of envFiles) {
    if (existsSync(file)) {
      const vars = readEnvFile(file);
      envVars = { ...envVars, ...vars };
      logSuccess(`读取环境变量文件: ${file}`);
    }
  }

  // 关键环境变量列表
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];

  const optionalVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'VITE_APP_URL',
    'VITE_GA_TRACKING_ID'
  ];

  // 设置预览环境变量
  log('\n🔧 配置预览环境变量...', 'cyan');
  for (const varName of [...requiredVars, ...optionalVars]) {
    if (envVars[varName] && !envVars[varName].includes('your_') && !envVars[varName].includes('example')) {
      try {
        runCommand(`vercel env add ${varName} preview`, { 
          input: envVars[varName],
          silent: true 
        });
        logSuccess(`✓ ${varName} (预览环境)`);
      } catch {
        logWarning(`跳过 ${varName} (可能已存在)`);
      }
    }
  }

  // 设置生产环境变量
  log('\n🔧 配置生产环境变量...', 'cyan');
  for (const varName of [...requiredVars, ...optionalVars]) {
    if (envVars[varName] && !envVars[varName].includes('your_') && !envVars[varName].includes('example')) {
      try {
        runCommand(`vercel env add ${varName} production`, { 
          input: envVars[varName],
          silent: true 
        });
        logSuccess(`✓ ${varName} (生产环境)`);
      } catch {
        logWarning(`跳过 ${varName} (可能已存在)`);
      }
    }
  }

  // 步骤 5: 测试部署
  logStep(5, '测试部署配置');
  
  try {
    log('正在进行测试构建...', 'yellow');
    runCommand('npm run build');
    logSuccess('构建测试通过');
  } catch (error) {
    logError('构建测试失败，请检查代码');
    throw error;
  }

  // 步骤 6: 完成配置
  logStep(6, '配置完成');
  
  log('\n🎉 Vercel 配置完成！', 'green');
  log('=' .repeat(50), 'blue');
  
  log('\n📝 接下来你可以:', 'bright');
  log('1. 推送代码到 GitHub 触发自动部署', 'cyan');
  log('2. 运行 npm run deploy:preview 进行预览部署', 'cyan');
  log('3. 运行 npm run deploy:production 进行生产部署', 'cyan');
  log('4. 访问 https://vercel.com/dashboard 查看部署状态', 'cyan');
  
  log('\n🔗 有用的命令:', 'bright');
  log('- vercel --help                 查看帮助', 'yellow');
  log('- vercel env ls                 查看环境变量', 'yellow');
  log('- vercel logs                   查看部署日志', 'yellow');
  log('- vercel domains                管理域名', 'yellow');
  
  log('\n✨ 配置完成，祝你部署愉快！', 'magenta');
}

// 错误处理
process.on('uncaughtException', (error) => {
  logError(`未捕获的异常: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError(`未处理的 Promise 拒绝: ${reason}`);
  process.exit(1);
});

// 运行配置
if (import.meta.url === `file://${process.argv[1]}`) {
  setupVercel().catch((error) => {
    logError(`配置失败: ${error.message}`);
    process.exit(1);
  });
}