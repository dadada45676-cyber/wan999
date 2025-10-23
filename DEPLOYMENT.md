# 📦 SMS营销数据分析系统 - 部署指南

## 🎯 概述

本指南将帮助你将 SMS营销数据分析系统 部署到 Vercel 平台，支持预览和生产两种部署模式。

## 🏗️ 部署架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Repo   │───▶│   Vercel CDN    │───▶│   Supabase DB   │
│                 │    │                 │    │                 │
│ • 源代码管理     │    │ • 静态资源托管   │    │ • 数据库服务     │
│ • CI/CD 触发     │    │ • 全球加速      │    │ • 用户认证      │
│ • 版本控制      │    │ • 自动部署      │    │ • 文件存储      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 快速开始

### 方式一：自动化脚本（推荐）

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 运行自动配置脚本
node scripts/setup-vercel.js

# 3. 按照提示完成配置
```

### 方式二：手动配置

#### 步骤 1: 准备环境

```bash
# 确保已安装 Node.js 22+
node --version

# 安装项目依赖
npm install

# 安装 Vercel CLI
npm install -g vercel
```

#### 步骤 2: 配置环境变量

1. **复制环境变量模板**
   ```bash
   cp .env.example .env.local
   ```

2. **编辑 `.env.local` 文件**
   ```env
   # 必填项
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # 可选项
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   DATABASE_URL=your_database_connection_string
   ```

3. **获取 Supabase 配置**
   - 登录 [Supabase Dashboard](https://supabase.com/dashboard)
   - 选择你的项目
   - 进入 Settings → API
   - 复制 URL 和 anon key

#### 步骤 3: 本地测试

```bash
# 启动开发服务器
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 构建测试
npm run build
```

#### 步骤 4: 部署到 Vercel

```bash
# 登录 Vercel
vercel login

# 链接项目
vercel link

# 预览部署
npm run deploy:preview

# 生产部署
npm run deploy:production
```

## 🔧 部署模式详解

### 预览部署 (Preview)

**触发条件:**
- 推送到非主分支
- 创建 Pull Request
- 手动触发预览部署

**特点:**
- 独立的预览 URL
- 使用预览环境变量
- 适合功能测试和演示
- 不影响生产环境

**配置文件:** `.env.preview`

```bash
# 手动预览部署
vercel --env .env.preview

# 或使用 npm 脚本
npm run deploy:preview
```

### 生产部署 (Production)

**触发条件:**
- 推送到 main/master 分支
- 手动触发生产部署

**特点:**
- 绑定自定义域名
- 使用生产环境变量
- 高可用性和性能优化
- 正式对外服务

**配置文件:** `.env.local`

```bash
# 手动生产部署
vercel --prod

# 或使用 npm 脚本
npm run deploy:production
```

## ⚙️ 环境变量配置

### 必需环境变量

| 变量名 | 描述 | 示例值 |
|--------|------|--------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJhbGciOiJIUzI1NiIs...` |

### 可选环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色密钥 | - |
| `DATABASE_URL` | 数据库连接字符串 | - |
| `VITE_APP_URL` | 应用基础 URL | `http://localhost:5173` |
| `NODE_ENV` | 运行环境 | `development` |
| `VITE_DEBUG` | 调试模式 | `false` |

### 在 Vercel 中设置环境变量

1. **通过 Dashboard**
   - 访问 [Vercel Dashboard](https://vercel.com/dashboard)
   - 选择项目 → Settings → Environment Variables
   - 添加变量并选择环境（Preview/Production）

2. **通过 CLI**
   ```bash
   # 添加预览环境变量
   vercel env add VITE_SUPABASE_URL preview
   
   # 添加生产环境变量
   vercel env add VITE_SUPABASE_URL production
   
   # 查看所有环境变量
   vercel env ls
   ```

## 🔄 CI/CD 自动化

### GitHub Actions 工作流

项目已配置 GitHub Actions，支持：

- **代码质量检查**: TypeScript 类型检查、ESLint 代码检查
- **自动构建测试**: 确保代码可以正常构建
- **预览部署**: PR 创建时自动部署预览环境
- **生产部署**: 主分支推送时自动部署生产环境
- **部署状态通知**: 在 PR 中评论预览链接

### 配置 GitHub Secrets

在 GitHub 仓库中设置以下 Secrets：

```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

**获取方式:**
1. `VERCEL_TOKEN`: Vercel Dashboard → Settings → Tokens
2. `VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID`: 运行 `vercel link` 后在 `.vercel/project.json` 中查看

## 📊 部署监控

### 查看部署状态

```bash
# 查看部署列表
vercel ls

# 查看部署日志
vercel logs

# 查看项目信息
vercel inspect
```

### 性能监控

Vercel 提供内置的性能监控：
- **Core Web Vitals**: 页面加载性能指标
- **Function Metrics**: 无服务器函数性能
- **Bandwidth Usage**: 带宽使用情况

访问 Vercel Dashboard → Analytics 查看详细数据。

## 🌐 域名配置

### 添加自定义域名

1. **通过 Dashboard**
   - Vercel Dashboard → 项目 → Settings → Domains
   - 添加域名并按提示配置 DNS

2. **通过 CLI**
   ```bash
   # 添加域名
   vercel domains add yourdomain.com
   
   # 查看域名列表
   vercel domains ls
   ```

### DNS 配置示例

```
# A 记录
@ → 76.76.19.61

# CNAME 记录
www → cname.vercel-dns.com
```

## 🔍 故障排除

### 常见问题

1. **构建失败**
   ```bash
   # 本地测试构建
   npm run build
   
   # 检查类型错误
   npm run type-check
   
   # 检查代码规范
   npm run lint
   ```

2. **环境变量未生效**
   ```bash
   # 检查环境变量
   vercel env ls
   
   # 重新部署
   vercel --prod --force
   ```

3. **Supabase 连接失败**
   - 检查 URL 格式是否正确
   - 确认 anon key 是否有效
   - 验证网络连接

### 调试技巧

1. **启用调试模式**
   ```env
   VITE_DEBUG=true
   LOG_LEVEL=debug
   ```

2. **查看详细日志**
   ```bash
   # 查看构建日志
   vercel logs --follow
   
   # 查看函数日志
   vercel logs --function
   ```

3. **本地模拟生产环境**
   ```bash
   # 构建并预览
   npm run build
   npm run preview:local
   ```

## 📚 最佳实践

### 部署前检查清单

- [ ] 所有环境变量已正确配置
- [ ] 本地构建测试通过
- [ ] 代码已推送到 Git 仓库
- [ ] Supabase 数据库已初始化
- [ ] 域名 DNS 已正确配置

### 安全建议

1. **环境变量安全**
   - 不要在代码中硬编码敏感信息
   - 使用不同的密钥区分环境
   - 定期轮换 API 密钥

2. **访问控制**
   - 配置 Supabase RLS 策略
   - 限制 CORS 域名
   - 启用 HTTPS 强制跳转

3. **监控告警**
   - 设置部署失败通知
   - 监控应用性能指标
   - 配置错误日志收集

## 🆘 获取帮助

### 官方文档

- [Vercel 文档](https://vercel.com/docs)
- [Supabase 文档](https://supabase.com/docs)
- [Vite 文档](https://vitejs.dev/guide/)

### 社区支持

- [Vercel Discord](https://vercel.com/discord)
- [Supabase Discord](https://discord.supabase.com/)
- [GitHub Issues](https://github.com/your-repo/issues)

### 联系方式

如果遇到部署问题，请：
1. 检查本指南的故障排除部分
2. 查看 GitHub Issues 中的已知问题
3. 创建新的 Issue 并提供详细信息

---

🎉 **恭喜！** 你已经成功配置了完整的部署环境。现在可以享受自动化部署带来的便利了！