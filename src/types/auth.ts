// 用户认证相关类型定义

// 用户角色类型
export type UserRole = 'admin' | 'operator'

// 用户状态类型
export type UserStatus = 'active' | 'inactive' | 'locked'

// 用户接口
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  department?: string
  phone?: string
  permissions: string[]
  lastLogin?: string
  createdAt: string
  createdBy?: string
  mustChangePassword?: boolean
  isFirstLogin?: boolean
  loginAttempts?: number
  lockedUntil?: string
  loginCount?: number
}

// 登录表单接口
export interface LoginForm {
  email: string
  password: string
  rememberMe?: boolean
  captcha?: string
}

// 登录响应接口
export interface LoginResponse {
  success: boolean
  token?: string
  user?: User
  message?: string
  requiresCaptcha?: boolean
}

// JWT Token载荷接口
export interface JWTPayload {
  userId: string
  email: string
  role: UserRole
  permissions: string[]
  iat: number
  exp: number
  sessionId: string
}

// 会话信息接口
export interface SessionInfo {
  id: string
  userId: string
  token: string
  expiresAt: string
  lastActivity: string
  ipAddress?: string
  userAgent?: string
}

// 密码重置表单接口
export interface PasswordResetForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  isFirstLogin?: boolean
  targetUserId?: string
}

// 用户创建表单接口
export interface CreateUserForm {
  email: string
  password: string
  name: string
  role: UserRole
  department: string
  phone: string
  status: UserStatus
  sendWelcomeEmail: boolean
}

// 用户编辑表单接口
export interface EditUserForm {
  name: string
  email: string
  role: UserRole
  department: string
  phone: string
  status: UserStatus
}

// 审计日志接口
export interface AuditLog {
  id: string
  userId: string
  userEmail: string
  action: string
  resource: string
  resourceId?: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: string
  result: 'success' | 'failure'
  errorMessage?: string
}

// 页面级权限定义
export const PERMISSIONS = {
  // 页面访问权限
  PAGE_PACKAGE: 'page.package',     // 号码包管理页面全部功能
  PAGE_PHONE: 'page.phone',         // 号码管理页面全部功能
  PAGE_USER: 'page.user',           // 用户管理页面全部功能
  PAGE_SETTINGS: 'page.settings',   // 系统设置页面全部功能
  PAGE_ANALYSIS: 'page.analysis'    // 数据分析页面全部功能
} as const

// 角色权限映射
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    PERMISSIONS.PAGE_PACKAGE,   // 号码包管理
    PERMISSIONS.PAGE_PHONE,     // 号码管理
    PERMISSIONS.PAGE_USER,      // 用户管理
    PERMISSIONS.PAGE_SETTINGS,  // 系统设置
    PERMISSIONS.PAGE_ANALYSIS   // 数据分析
  ],
  operator: [
    PERMISSIONS.PAGE_PACKAGE,   // 号码包管理
    PERMISSIONS.PAGE_PHONE,     // 号码管理
    PERMISSIONS.PAGE_ANALYSIS   // 数据分析
    // 注意：操作员没有用户管理和系统设置权限
  ]
}

// 默认管理员账号配置
export const DEFAULT_ADMIN = {
  email: import.meta.env.VITE_DEFAULT_ADMIN_EMAIL || 'admin@sms-system.com',
  password: import.meta.env.VITE_DEFAULT_ADMIN_PASSWORD || 'Admin123!',
  name: '系统管理员',
  role: 'admin' as UserRole,
  status: 'active' as UserStatus,
  mustChangePassword: true
}

// 安全配置
export const SECURITY_CONFIG = {
  // 密码策略
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SPECIAL: true,
  PASSWORD_HISTORY_COUNT: 5, // 记住最近5个密码
  PASSWORD_EXPIRY_DAYS: 90, // 密码90天过期
  
  // 登录安全
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30 * 60 * 1000, // 30分钟
  PROGRESSIVE_LOCKOUT: true, // 渐进式锁定
  LOCKOUT_MULTIPLIER: 2, // 每次锁定时间翻倍
  MAX_LOCKOUT_DURATION: 24 * 60 * 60 * 1000, // 最大锁定24小时
  
  // 会话管理
  TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24小时
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30分钟无操作超时
  SESSION_WARNING_TIME: 5 * 60 * 1000, // 超时前5分钟警告
  MAX_CONCURRENT_SESSIONS: 3,
  FORCE_LOGOUT_ON_PASSWORD_CHANGE: true,
  
  // 验证码
  CAPTCHA_THRESHOLD: 3, // 失败3次后启用验证码
  CAPTCHA_EXPIRY: 5 * 60 * 1000, // 验证码5分钟过期
  
  // 管理员限制
  MAX_ADMIN_COUNT: 3,
  MIN_ADMIN_COUNT: 1,
  
  // 审计日志
  AUDIT_LOG_RETENTION_DAYS: 365, // 审计日志保留1年
  AUDIT_LOG_MAX_SIZE: 10000, // 最大日志条数
  
  // IP安全
  ENABLE_IP_WHITELIST: false,
  IP_WHITELIST: [] as string[],
  ENABLE_IP_BLACKLIST: true,
  MAX_FAILED_ATTEMPTS_PER_IP: 10,
  IP_LOCKOUT_DURATION: 60 * 60 * 1000, // IP锁定1小时
  
  // 设备管理
  ENABLE_DEVICE_TRACKING: true,
  MAX_TRUSTED_DEVICES: 5,
  DEVICE_TRUST_DURATION: 30 * 24 * 60 * 60 * 1000, // 设备信任30天
  
  // 安全通知
  NOTIFY_ON_NEW_LOGIN: true,
  NOTIFY_ON_PASSWORD_CHANGE: true,
  NOTIFY_ON_ACCOUNT_LOCKOUT: true,
  
  // 数据保护
  ENABLE_DATA_ENCRYPTION: true,
  ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  
  // 其他安全设置
  ENABLE_BRUTE_FORCE_PROTECTION: true,
  ENABLE_RATE_LIMITING: true,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15分钟窗口
  RATE_LIMIT_MAX_REQUESTS: 100, // 每窗口最大请求数
}