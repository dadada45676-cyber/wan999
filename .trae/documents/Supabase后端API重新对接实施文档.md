# Supabase后端API重新对接实施文档

## 1. 项目概述

### 1.1 对接目标
将现有SMS营销数据分析系统从当前Supabase项目迁移到新的"wan888"项目，确保所有功能正常运行。

### 1.2 系统架构
- **前端**: React 18 + TypeScript + Vite
- **后端**: Supabase (PostgreSQL + Auth + Storage)
- **状态管理**: Zustand
- **UI框架**: Tailwind CSS

### 1.3 核心模块
- 用户认证系统 (AuthService)
- 套餐管理系统 (PackageService)  
- 报告管理系统 (ReportService)
- 系统设置管理 (SettingsService)

## 2. 新Supabase项目"wan888"配置步骤

### 2.1 项目创建与基础配置

#### 步骤1: 创建新项目
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击 "New Project"
3. 项目名称: `wan888`
4. 选择合适的区域 (建议: Asia Pacific - Singapore)
5. 设置数据库密码并记录

#### 步骤2: 获取项目配置信息
```bash
# 项目配置信息 (需要从Supabase Dashboard获取)
Project URL: https://[project-id].supabase.co
Anon Key: eyJ...
Service Role Key: eyJ...
```

#### 步骤3: 数据库连接配置
```sql
-- 数据库连接信息
Host: db.[project-id].supabase.co
Port: 5432
Database: postgres
Username: postgres
Password: [设置的密码]
```

### 2.2 API密钥权限配置

#### Anon Key权限
- 用于前端公开访问
- 受RLS (Row Level Security) 策略限制
- 仅允许已认证用户的基本操作

#### Service Role Key权限  
- 用于服务端操作
- 绕过RLS策略
- 仅在安全的服务端环境使用

## 3. 环境变量更新指南

### 3.1 环境变量文件结构
```
.env                 # 本地开发环境
.env.example         # 环境变量模板
.env.preview         # 预览环境
.env.production      # 生产环境
```

### 3.2 必须更新的Supabase配置项

#### 核心配置
```env
# Supabase配置 - 必须更新
VITE_SUPABASE_URL=https://[new-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[new-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[new-service-role-key]

# 数据库配置 - 必须更新
DATABASE_URL=postgresql://postgres:[password]@db.[new-project-id].supabase.co:5432/postgres
```

#### 应用配置 (保持不变)
```env
# 应用配置
VITE_APP_ENV=development
VITE_APP_BASE_URL=http://localhost:5173
VITE_API_URL=http://localhost:5173/api

# 安全配置
JWT_SECRET=[保持现有值或重新生成]
ENCRYPTION_KEY=[保持现有值或重新生成]
```

### 3.3 环境变量更新步骤

#### 步骤1: 备份现有配置
```bash
# 备份当前环境变量
cp .env .env.backup
cp .env.production .env.production.backup
```

#### 步骤2: 更新开发环境
```bash
# 更新 .env 文件
VITE_SUPABASE_URL=https://[new-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[new-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[new-service-role-key]
DATABASE_URL=postgresql://postgres:[password]@db.[new-project-id].supabase.co:5432/postgres
```

#### 步骤3: 更新生产环境
```bash
# 更新 .env.production 文件
VITE_SUPABASE_URL=https://[new-project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[new-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[new-service-role-key]
DATABASE_URL=postgresql://postgres:[password]@db.[new-project-id].supabase.co:5432/postgres
```

## 4. 数据库迁移执行计划

### 4.1 迁移文件清单
```
supabase/migrations/
├── 001_initial_schema.sql      # 基础表结构
├── 002_rls_policies.sql        # 行级安全策略
├── 003_initial_data.sql        # 初始数据
├── 004_storage_setup.sql       # 存储桶配置
├── 005_functions_triggers.sql  # 函数和触发器
└── 006_rename_users_table.sql  # 用户表重命名
```

### 4.2 迁移执行顺序

#### 阶段1: 基础结构 (高优先级)
```sql
-- 1. 执行基础表结构
-- 文件: 001_initial_schema.sql
-- 包含: users, phone_packages, reports, system_settings等核心表

-- 2. 设置行级安全策略  
-- 文件: 002_rls_policies.sql
-- 包含: 所有表的RLS策略和权限控制

-- 3. 插入初始数据
-- 文件: 003_initial_data.sql  
-- 包含: 系统设置、默认管理员账户等
```

#### 阶段2: 存储和函数 (中优先级)
```sql
-- 4. 配置存储桶
-- 文件: 004_storage_setup.sql
-- 包含: phone-packages, reports, documents存储桶

-- 5. 创建函数和触发器
-- 文件: 005_functions_triggers.sql
-- 包含: 统计函数、更新触发器等
```

#### 阶段3: 结构优化 (低优先级)
```sql
-- 6. 用户表重命名
-- 文件: 006_rename_users_table.sql
-- 包含: 表结构优化
```

### 4.3 迁移执行方法

#### 方法1: Supabase CLI (推荐)
```bash
# 安装Supabase CLI
npm install -g supabase

# 登录并链接项目
supabase login
supabase link --project-ref [new-project-id]

# 执行迁移
supabase db push
```

#### 方法2: 手动执行
```bash
# 在Supabase Dashboard的SQL Editor中按顺序执行每个文件
# 或使用psql连接数据库执行
```

### 4.4 迁移验证检查
```sql
-- 检查表是否创建成功
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- 检查RLS策略是否生效
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';

-- 检查存储桶是否创建
SELECT * FROM storage.buckets;

-- 检查函数是否创建
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public';
```

## 5. 各服务模块重新对接步骤

### 5.1 AuthService 重新对接

#### 当前实现位置
- 文件: `src/services/auth.ts`
- 状态管理: `src/store/auth.ts`
- 类型定义: `src/types/auth.ts`

#### 对接步骤
```typescript
// 1. 验证Supabase客户端连接
// 文件: src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 2. 测试认证功能
// 登录测试
// 用户注册测试  
// 密码重置测试
// 会话管理测试
```

#### 验证方法
```typescript
// 测试用户登录
const testLogin = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@example.com',
    password: 'admin123'
  })
  console.log('Login result:', { data, error })
}
```

### 5.2 PackageService 重新对接

#### 当前实现位置
- 文件: `src/services/package.ts`
- 页面组件: `src/pages/PackageManagement.tsx`
- 类型定义: `src/types/common.ts`

#### 对接步骤
```typescript
// 1. 验证套餐数据查询
const testPackageQuery = async () => {
  const { data, error } = await supabase
    .from('phone_packages')
    .select('*')
  console.log('Package query result:', { data, error })
}

// 2. 测试CRUD操作
// 创建套餐
// 更新套餐
// 删除套餐
// 批量操作
```

### 5.3 ReportService 重新对接

#### 当前实现位置
- 文件: `src/services/report.ts`
- 页面组件: `src/pages/ReportCenter.tsx`

#### 对接步骤
```typescript
// 1. 验证报告数据查询
const testReportQuery = async () => {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
  console.log('Report query result:', { data, error })
}

// 2. 测试文件上传下载
// 报告文件上传到storage
// 报告文件下载
// 文件权限验证
```

### 5.4 SettingsService 重新对接

#### 当前实现位置
- 文件: `src/services/settings.ts`
- 页面组件: `src/pages/SystemSettings.tsx`

#### 对接步骤
```typescript
// 1. 验证系统设置查询
const testSettingsQuery = async () => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
  console.log('Settings query result:', { data, error })
}

// 2. 测试设置更新
// 安全配置更新
// 系统参数更新
// 权限配置更新
```

## 6. 功能验证测试清单

### 6.1 认证功能测试

#### 基础认证
- [ ] 管理员登录 (admin@example.com / admin123)
- [ ] 操作员登录测试
- [ ] 错误密码处理
- [ ] 会话超时处理
- [ ] 登出功能

#### 权限控制
- [ ] 管理员权限验证
- [ ] 操作员权限验证
- [ ] 页面访问控制
- [ ] API权限控制

### 6.2 套餐管理测试

#### 数据操作
- [ ] 套餐列表查询
- [ ] 套餐详情查看
- [ ] 新增套餐
- [ ] 编辑套餐
- [ ] 删除套餐
- [ ] 批量操作

#### 业务逻辑
- [ ] 套餐评级计算
- [ ] 统计数据准确性
- [ ] 数据筛选排序
- [ ] 分页功能

### 6.3 报告管理测试

#### 文件操作
- [ ] 报告文件上传
- [ ] 报告文件下载
- [ ] 文件预览
- [ ] 文件删除

#### 数据管理
- [ ] 报告列表查询
- [ ] 报告搜索功能
- [ ] 报告分类管理
- [ ] 报告权限控制

### 6.4 系统设置测试

#### 配置管理
- [ ] 安全设置查看/修改
- [ ] 系统参数配置
- [ ] 用户管理功能
- [ ] 权限配置

#### 数据一致性
- [ ] 设置保存验证
- [ ] 配置生效验证
- [ ] 默认值恢复
- [ ] 配置导入导出

### 6.5 性能和稳定性测试

#### 性能指标
- [ ] 页面加载时间 < 3秒
- [ ] API响应时间 < 1秒
- [ ] 大数据量处理
- [ ] 并发用户测试

#### 错误处理
- [ ] 网络异常处理
- [ ] 数据库连接异常
- [ ] 权限异常处理
- [ ] 用户友好错误提示

## 7. 风险控制和回滚方案

### 7.1 主要风险识别

#### 高风险项
1. **数据丢失风险**
   - 迁移过程中数据损坏
   - 配置错误导致数据无法访问
   
2. **服务中断风险**
   - 迁移期间系统不可用
   - 新环境配置错误

3. **权限配置风险**
   - RLS策略配置错误
   - API密钥泄露

#### 中风险项
1. **兼容性问题**
   - 新旧环境API差异
   - 数据格式不兼容

2. **性能问题**
   - 新环境性能下降
   - 网络延迟增加

### 7.2 风险控制措施

#### 数据安全保障
```bash
# 1. 完整数据备份
# 备份当前Supabase项目数据
pg_dump [current-database-url] > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 配置文件备份
cp .env .env.backup_$(date +%Y%m%d_%H%M%S)
cp .env.production .env.production.backup_$(date +%Y%m%d_%H%M%S)
```

#### 分阶段迁移
```bash
# 阶段1: 开发环境迁移测试
# 阶段2: 预览环境迁移验证
# 阶段3: 生产环境迁移
```

#### 权限安全控制
```typescript
// 1. API密钥安全存储
// 使用环境变量，不提交到代码库
// 定期轮换密钥

// 2. RLS策略验证
// 测试各角色权限
// 验证数据访问控制
```

### 7.3 回滚方案

#### 快速回滚 (< 5分钟)
```bash
# 1. 恢复环境变量
cp .env.backup .env
cp .env.production.backup .env.production

# 2. 重启应用服务
npm run build
npm run preview
```

#### 完整回滚 (< 30分钟)
```bash
# 1. 恢复数据库
# 如果新环境有问题，切换回原Supabase项目

# 2. 恢复所有配置
# 恢复DNS配置
# 恢复CDN配置
# 恢复监控配置
```

#### 数据恢复方案
```sql
-- 1. 从备份恢复数据
psql [database-url] < backup_[timestamp].sql

-- 2. 验证数据完整性
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM phone_packages;
SELECT COUNT(*) FROM reports;
SELECT COUNT(*) FROM system_settings;
```

### 7.4 应急联系和处理流程

#### 应急联系
- 技术负责人: [联系方式]
- 运维负责人: [联系方式]
- 业务负责人: [联系方式]

#### 处理流程
1. **问题发现** (0-5分钟)
   - 监控告警
   - 用户反馈
   - 主动发现

2. **问题评估** (5-10分钟)
   - 影响范围评估
   - 严重程度判断
   - 回滚决策

3. **应急处理** (10-30分钟)
   - 执行回滚方案
   - 服务恢复验证
   - 用户通知

4. **问题修复** (30分钟-2小时)
   - 根因分析
   - 修复方案制定
   - 重新部署验证

## 8. 实施时间计划

### 8.1 总体时间安排
- **准备阶段**: 0.5小时 (环境准备、备份)
- **迁移阶段**: 2小时 (数据库迁移、配置更新)
- **测试阶段**: 1.5小时 (功能验证、性能测试)
- **上线阶段**: 0.5小时 (生产部署、监控)
- **总计**: 4.5小时

### 8.2 详细执行计划

#### 第1阶段: 准备工作 (30分钟)
- [ ] 创建新Supabase项目"wan888"
- [ ] 获取项目配置信息
- [ ] 备份当前环境和数据
- [ ] 准备迁移脚本

#### 第2阶段: 数据库迁移 (60分钟)
- [ ] 执行数据库迁移脚本
- [ ] 验证表结构和数据
- [ ] 配置RLS策略
- [ ] 设置存储桶权限

#### 第3阶段: 应用配置 (60分钟)
- [ ] 更新环境变量
- [ ] 重新构建应用
- [ ] 测试Supabase连接
- [ ] 验证API功能

#### 第4阶段: 功能测试 (90分钟)
- [ ] 认证功能测试
- [ ] 套餐管理测试
- [ ] 报告管理测试
- [ ] 系统设置测试
- [ ] 性能测试

#### 第5阶段: 生产部署 (30分钟)
- [ ] 生产环境配置
- [ ] 应用部署
- [ ] 监控配置
- [ ] 用户验收测试

## 9. 成功标准

### 9.1 技术指标
- [ ] 所有API接口正常响应
- [ ] 数据库连接稳定
- [ ] 认证功能正常
- [ ] 文件上传下载正常
- [ ] 页面加载时间 < 3秒

### 9.2 业务指标
- [ ] 用户可以正常登录
- [ ] 套餐管理功能完整
- [ ] 报告管理功能完整
- [ ] 系统设置功能正常
- [ ] 数据统计准确

### 9.3 安全指标
- [ ] 权限控制正确
- [ ] 数据访问安全
- [ ] API密钥安全
- [ ] 无敏感信息泄露

## 10. 后续优化建议

### 10.1 性能优化
- 实施数据库查询优化
- 添加缓存机制
- 优化前端资源加载
- 实施CDN加速

### 10.2 监控完善
- 添加应用性能监控
- 设置错误告警
- 实施日志分析
- 建立健康检查

### 10.3 安全加固
- 定期密钥轮换
- 实施API限流
- 加强权限审计
- 完善安全策略

---

**文档版本**: v1.0  
**创建日期**: 2024年12月  
**更新日期**: 2024年12月  
**负责人**: 技术团队