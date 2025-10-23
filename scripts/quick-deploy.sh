#!/bin/bash

# SMS营销数据分析系统 - 快速部署脚本
# 使用方法: ./scripts/quick-deploy.sh [preview|production]

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}📋 步骤 $1: $2${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查文件是否存在
file_exists() {
    [ -f "$1" ]
}

# 获取部署类型
DEPLOY_TYPE=${1:-preview}

if [ "$DEPLOY_TYPE" != "preview" ] && [ "$DEPLOY_TYPE" != "production" ]; then
    log_error "无效的部署类型: $DEPLOY_TYPE"
    echo "使用方法: $0 [preview|production]"
    exit 1
fi

echo -e "${CYAN}🚀 SMS营销数据分析系统 - 快速部署脚本${NC}"
echo -e "${CYAN}================================================${NC}"
echo -e "${BLUE}部署类型: ${DEPLOY_TYPE}${NC}"
echo ""

# 步骤 1: 环境检查
log_step 1 "环境检查"

# 检查 Node.js
if ! command_exists node; then
    log_error "Node.js 未安装"
    exit 1
fi
NODE_VERSION=$(node --version)
log_success "Node.js 已安装: $NODE_VERSION"

# 检查 npm
if ! command_exists npm; then
    log_error "npm 未安装"
    exit 1
fi
NPM_VERSION=$(npm --version)
log_success "npm 已安装: $NPM_VERSION"

# 检查 Vercel CLI
if ! command_exists vercel; then
    log_warning "Vercel CLI 未安装，正在安装..."
    npm install -g vercel
    log_success "Vercel CLI 安装完成"
else
    VERCEL_VERSION=$(vercel --version)
    log_success "Vercel CLI 已安装: $VERCEL_VERSION"
fi

# 步骤 2: 项目检查
log_step 2 "项目检查"

# 检查 package.json
if ! file_exists "package.json"; then
    log_error "package.json 不存在，请确保在项目根目录运行此脚本"
    exit 1
fi
log_success "package.json 存在"

# 检查 vercel.json
if ! file_exists "vercel.json"; then
    log_error "vercel.json 不存在，请先配置 Vercel 项目"
    exit 1
fi
log_success "vercel.json 存在"

# 检查环境变量文件
if [ "$DEPLOY_TYPE" = "preview" ]; then
    ENV_FILE=".env.preview"
else
    ENV_FILE=".env.local"
fi

if ! file_exists "$ENV_FILE"; then
    log_warning "$ENV_FILE 不存在，将使用默认配置"
else
    log_success "$ENV_FILE 存在"
fi

# 步骤 3: 依赖安装
log_step 3 "安装依赖"

if [ ! -d "node_modules" ]; then
    log_info "正在安装项目依赖..."
    npm install
    log_success "依赖安装完成"
else
    log_info "检查依赖更新..."
    npm ci
    log_success "依赖检查完成"
fi

# 步骤 4: 代码质量检查
log_step 4 "代码质量检查"

log_info "正在进行类型检查..."
if npm run type-check; then
    log_success "类型检查通过"
else
    log_error "类型检查失败"
    exit 1
fi

log_info "正在进行代码检查..."
if npm run lint; then
    log_success "代码检查通过"
else
    log_warning "代码检查有警告，继续部署..."
fi

# 步骤 5: 构建测试
log_step 5 "构建测试"

log_info "正在进行构建测试..."
if [ "$DEPLOY_TYPE" = "preview" ]; then
    BUILD_COMMAND="npm run build:preview"
else
    BUILD_COMMAND="npm run build:production"
fi

if $BUILD_COMMAND; then
    log_success "构建测试通过"
else
    log_error "构建测试失败"
    exit 1
fi

# 步骤 6: Vercel 登录检查
log_step 6 "Vercel 登录检查"

if vercel whoami >/dev/null 2>&1; then
    VERCEL_USER=$(vercel whoami)
    log_success "已登录 Vercel: $VERCEL_USER"
else
    log_info "请登录 Vercel..."
    vercel login
    log_success "Vercel 登录完成"
fi

# 步骤 7: 项目链接检查
log_step 7 "项目链接检查"

if [ -f ".vercel/project.json" ]; then
    log_success "项目已链接到 Vercel"
else
    log_info "正在链接项目到 Vercel..."
    vercel link
    log_success "项目链接完成"
fi

# 步骤 8: 部署
log_step 8 "开始部署"

if [ "$DEPLOY_TYPE" = "preview" ]; then
    log_info "正在部署到预览环境..."
    DEPLOY_URL=$(vercel --confirm)
    log_success "预览部署完成"
    echo -e "${GREEN}🌐 预览链接: $DEPLOY_URL${NC}"
else
    log_info "正在部署到生产环境..."
    DEPLOY_URL=$(vercel --prod --confirm)
    log_success "生产部署完成"
    echo -e "${GREEN}🌐 生产链接: $DEPLOY_URL${NC}"
fi

# 步骤 9: 部署验证
log_step 9 "部署验证"

log_info "等待部署完成..."
sleep 10

log_info "验证部署状态..."
if curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL" | grep -q "200"; then
    log_success "部署验证通过，网站可正常访问"
else
    log_warning "部署验证失败，请手动检查网站状态"
fi

# 完成
echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo ""
echo -e "${BLUE}📊 部署信息:${NC}"
echo -e "  • 部署类型: ${DEPLOY_TYPE}"
echo -e "  • 部署链接: ${DEPLOY_URL}"
echo -e "  • 部署时间: $(date)"
echo ""
echo -e "${BLUE}🔗 有用的命令:${NC}"
echo -e "  • vercel logs           查看部署日志"
echo -e "  • vercel ls             查看部署列表"
echo -e "  • vercel domains        管理域名"
echo -e "  • vercel env ls         查看环境变量"
echo ""
echo -e "${PURPLE}✨ 部署成功，祝你使用愉快！${NC}"