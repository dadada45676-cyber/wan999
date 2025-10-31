/**
 * 项目常量定义
 * 统一管理项目中的常量，避免重复定义
 */

// 评级等级
export const RATING_GRADES = ['SS', 'S', 'A', 'B', 'C', 'D'] as const
export type RatingGrade = typeof RATING_GRADES[number]

// 包等级
export const PACKAGE_GRADES = ['A', 'B', 'C', 'D', 'E'] as const
export type PackageGrade = typeof PACKAGE_GRADES[number]

// 文件类型
export const ALLOWED_FILE_TYPES = {
  TEXT: ['text/plain', 'text/csv', 'application/csv'],
  IMAGE: ['image/jpeg', 'image/png', 'image/gif'],
  DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
} as const

// 文件扩展名
export const ALLOWED_FILE_EXTENSIONS = {
  TEXT: ['txt', 'csv'],
  IMAGE: ['jpg', 'jpeg', 'png', 'gif'],
  DOCUMENT: ['pdf', 'doc', 'docx']
} as const

// 用户状态
export const USER_STATUSES = ['active', 'inactive', 'suspended'] as const
export type UserStatus = typeof USER_STATUSES[number]

// 用户角色
export const USER_ROLES = ['admin', 'manager', 'operator'] as const
export type UserRole = typeof USER_ROLES[number]

// 包状态
export const PACKAGE_STATUSES = ['completed', 'processing', 'failed', 'pending'] as const
export type PackageStatus = typeof PACKAGE_STATUSES[number]

// 报告类型
export const REPORT_TYPES = ['daily', 'weekly', 'monthly', 'custom'] as const
export type ReportType = typeof REPORT_TYPES[number]

// 报告格式
export const REPORT_FORMATS = ['pdf', 'excel', 'csv'] as const
export type ReportFormat = typeof REPORT_FORMATS[number]

// 导出格式
export const EXPORT_FORMATS = ['csv', 'excel'] as const
export type ExportFormat = typeof EXPORT_FORMATS[number]

// 默认设置
export const DEFAULT_SETTINGS = {
  // 分页
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // 文件上传
  MAX_FILE_SIZE_MB: 50,
  MAX_BATCH_SIZE: 1000,
  
  // 密码要求
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  
  // 用户名要求
  MIN_USERNAME_LENGTH: 2,
  MAX_USERNAME_LENGTH: 20,
  
  // 会话超时（分钟）
  SESSION_TIMEOUT: 30,
  SESSION_WARNING_TIME: 5,
  
  // 数据刷新间隔（毫秒）
  REFRESH_INTERVAL: 30000,
  
  // 请求超时（毫秒）
  REQUEST_TIMEOUT: 10000,
  
  // 重试次数
  MAX_RETRY_COUNT: 3
} as const

// API 端点
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  USERS: '/api/users',
  PACKAGES: '/api/packages',
  PHONES: '/api/phones',
  REPORTS: '/api/reports',
  SETTINGS: '/api/settings'
} as const

// 本地存储键名
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
  LANGUAGE: 'language'
} as const

// 错误代码
export const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  SERVER_ERROR: 500
} as const

// 成功状态码
export const SUCCESS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204
} as const