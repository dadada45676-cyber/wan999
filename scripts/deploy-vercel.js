#!/usr/bin/env node

/**
 * Vercel 部署脚本
 * 确保生产环境的正确构建和部署
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始 Vercel 部署流程...');

try {
  // 1. 清理构建目录
  console.log('📁 清理构建目录...');
  if (fs.existsSync('dist')) {
    execSync('rmdir /s /q dist', { stdio: 'inherit' });
  }

  // 2. 安装依赖
  console.log('📦 安装依赖...');
  execSync('npm ci', { stdio: 'inherit' });

  // 3. 生产环境构建
  console.log('🔨 生产环境构建...');
  execSync('npm run build', { 
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_ENV: 'production',
      VITE_APP_ENV: 'production'
    }
  });

  // 4. 验证构建结果
  console.log('✅ 验证构建结果...');
  const distPath = path.join(__dirname, '../dist');
  const indexPath = path.join(distPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    throw new Error('构建失败：找不到 index.html 文件');
  }

  // 检查关键文件
  const assetsPath = path.join(distPath, 'assets');
  if (!fs.existsSync(assetsPath)) {
    throw new Error('构建失败：找不到 assets 目录');
  }

  console.log('✨ 构建验证通过！');

  // 5. 部署到 Vercel
  console.log('🌐 部署到 Vercel...');
  execSync('vercel --prod', { stdio: 'inherit' });

  console.log('🎉 部署完成！');

} catch (error) {
  console.error('❌ 部署失败:', error.message);
  process.exit(1);
}