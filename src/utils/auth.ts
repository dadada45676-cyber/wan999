// 用户认证工具函数

import { JWTPayload, User, SECURITY_CONFIG } from '../types/auth'

// JWT Token管理类
export class TokenManager {
  private static readonly TOKEN_KEY = 'sms_system_token'
  private static readonly REFRESH_KEY = 'sms_system_refresh'
  private static readonly USER_KEY = 'sms_system_user'

  // 保存Token到本地存储
  static saveToken(token: string, rememberMe: boolean = false): void {
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(this.TOKEN_KEY, token)
  }

  // 获取Token
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY)
  }

  // 移除Token
  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY)
    sessionStorage.removeItem(this.TOKEN_KEY)
    localStorage.removeItem(this.REFRESH_KEY)
    sessionStorage.removeItem(this.REFRESH_KEY)
    localStorage.removeItem(this.USER_KEY)
    sessionStorage.removeItem(this.USER_KEY)
  }

  // 保存用户信息
  static saveUser(user: User, rememberMe: boolean = false): void {
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(this.USER_KEY, JSON.stringify(user))
  }

  // 获取用户信息
  static getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY)
    if (!userStr) return null
    
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  }

  // 解析JWT Token（简化版，实际应用中应使用专业库）
  static parseToken(token: string): JWTPayload | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      
      const payload = JSON.parse(atob(parts[1]))
      return payload as JWTPayload
    } catch {
      return null
    }
  }

  // 检查Token是否过期
  static isTokenExpired(token: string): boolean {
    const payload = this.parseToken(token)
    if (!payload) return true
    
    const currentTime = Math.floor(Date.now() / 1000)
    return payload.exp < currentTime
  }

  // 检查Token是否即将过期（30分钟内）
  static isTokenExpiringSoon(token: string): boolean {
    const payload = this.parseToken(token)
    if (!payload) return true
    
    const currentTime = Math.floor(Date.now() / 1000)
    const thirtyMinutes = 30 * 60
    return payload.exp - currentTime < thirtyMinutes
  }
}

// 密码验证工具
export class PasswordValidator {
  // 验证密码强度
  static validate(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      errors.push(`密码长度至少${SECURITY_CONFIG.PASSWORD_MIN_LENGTH}位`)
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母')
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母')
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('密码必须包含数字')
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('密码必须包含特殊字符')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 验证密码强度（增强版）
  validatePassword(password: string): { 
    isValid: boolean; 
    score: number; 
    feedback: string[] 
  } {
    const feedback: string[] = []
    let score = 0

    // 长度检查
    if (password.length >= 8) score += 1
    else feedback.push('密码长度至少8位')

    if (password.length >= 12) score += 1

    // 字符类型检查
    if (/[a-z]/.test(password)) score += 1
    else feedback.push('需要包含小写字母')

    if (/[A-Z]/.test(password)) score += 1
    else feedback.push('需要包含大写字母')

    if (/\d/.test(password)) score += 1
    else feedback.push('需要包含数字')

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1
    else feedback.push('建议包含特殊字符')

    // 复杂度检查
    if (password.length >= 16) score += 1
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(password)) score += 1

    // 常见密码检查
    const commonPasswords = ['password', '123456', 'admin', 'qwerty', 'abc123']
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      score = Math.max(0, score - 2)
      feedback.push('避免使用常见密码')
    }

    // 重复字符检查
    if (/(.)\1{2,}/.test(password)) {
      score = Math.max(0, score - 1)
      feedback.push('避免连续重复字符')
    }

    return {
      isValid: score >= 4,
      score: Math.min(score, 4),
      feedback
    }
  }

  // 生成随机密码
  static generate(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*'
    
    let charset = lowercase + numbers
    let password = ''
    
    // 确保包含必需的字符类型
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE) {
      charset += uppercase
      password += uppercase[Math.floor(Math.random() * uppercase.length)]
    }
    
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE) {
      password += lowercase[Math.floor(Math.random() * lowercase.length)]
    }
    
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS) {
      password += numbers[Math.floor(Math.random() * numbers.length)]
    }
    
    if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL) {
      charset += special
      password += special[Math.floor(Math.random() * special.length)]
    }
    
    // 填充剩余长度
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)]
    }
    
    // 打乱密码字符顺序
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }
}

// 权限检查工具
export class PermissionChecker {
  // 检查用户是否有指定权限
  static hasPermission(user: User | null, permission: string): boolean {
    if (!user || user.status !== 'active') return false
    return user.permissions.includes(permission)
  }

  // 检查用户是否有任一权限
  static hasAnyPermission(user: User | null, permissions: string[]): boolean {
    if (!user || user.status !== 'active') return false
    return permissions.some(permission => user.permissions.includes(permission))
  }

  // 检查用户是否有所有权限
  static hasAllPermissions(user: User | null, permissions: string[]): boolean {
    if (!user || user.status !== 'active') return false
    return permissions.every(permission => user.permissions.includes(permission))
  }

  // 检查是否为管理员
  static isAdmin(user: User | null): boolean {
    return user?.role === 'admin' && user.status === 'active'
  }

  // 检查是否为操作员
  static isOperator(user: User | null): boolean {
    return user?.role === 'operator' && user.status === 'active'
  }
}

// 会话管理工具
export class SessionManager {
  private static lastActivity: number = Date.now()
  private static timeoutId: NodeJS.Timeout | null = null
  private static warningTimeoutId: NodeJS.Timeout | null = null
  private static timeoutCallback: (() => void) | null = null
  private static warningCallback: ((timeLeft: number) => void) | null = null
  private static readonly WARNING_TIME = 5 * 60 * 1000 // 超时前5分钟警告

  // 更新最后活动时间
  static updateActivity(): void {
    this.lastActivity = Date.now()
    this.resetTimeout()
    
    // 保存活动时间到本地存储
    localStorage.setItem('sms_last_activity', this.lastActivity.toString())
  }

  // 检查会话是否超时
  static isSessionExpired(): boolean {
    const now = Date.now()
    const storedActivity = localStorage.getItem('sms_last_activity')
    const lastActivity = storedActivity ? parseInt(storedActivity) : this.lastActivity
    
    return now - lastActivity > SECURITY_CONFIG.SESSION_TIMEOUT
  }

  // 获取剩余会话时间
  static getRemainingTime(): number {
    const now = Date.now()
    const storedActivity = localStorage.getItem('sms_last_activity')
    const lastActivity = storedActivity ? parseInt(storedActivity) : this.lastActivity
    
    const elapsed = now - lastActivity
    return Math.max(0, SECURITY_CONFIG.SESSION_TIMEOUT - elapsed)
  }

  // 获取距离警告时间的剩余时间
  static getTimeUntilWarning(): number {
    const now = Date.now()
    const storedActivity = localStorage.getItem('sms_last_activity')
    const lastActivity = storedActivity ? parseInt(storedActivity) : this.lastActivity
    
    const elapsed = now - lastActivity
    const warningTime = SECURITY_CONFIG.SESSION_TIMEOUT - this.WARNING_TIME
    return Math.max(0, warningTime - elapsed)
  }

  // 获取距离会话过期的剩余时间
  static getTimeUntilExpiry(): number {
    return this.getRemainingTime()
  }

  // 设置会话超时回调
  static setTimeoutCallback(callback: () => void): void {
    this.timeoutCallback = callback
    this.resetTimeout()
  }

  // 设置会话警告回调
  static setWarningCallback(callback: (timeLeft: number) => void): void {
    this.warningCallback = callback
    this.resetTimeout()
  }

  // 重置超时计时器
  private static resetTimeout(): void {
    // 清除现有计时器
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId)
    }

    // 设置警告计时器
    if (this.warningCallback) {
      const warningTime = SECURITY_CONFIG.SESSION_TIMEOUT - this.WARNING_TIME
      this.warningTimeoutId = setTimeout(() => {
        const remainingTime = this.WARNING_TIME
        this.warningCallback?.(remainingTime)
      }, warningTime)
    }

    // 设置超时计时器
    if (this.timeoutCallback) {
      this.timeoutId = setTimeout(() => {
        this.timeoutCallback?.()
      }, SECURITY_CONFIG.SESSION_TIMEOUT)
    }
  }

  // 延长会话
  static extendSession(): void {
    this.updateActivity()
  }

  // 清除会话
  static clearSession(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId)
      this.warningTimeoutId = null
    }
    
    localStorage.removeItem('sms_last_activity')
    TokenManager.removeToken()
  }

  // 初始化会话监控
  static initializeSessionMonitoring(): void {
    // 监听用户活动
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const activityHandler = () => {
      this.updateActivity()
    }

    events.forEach(event => {
      document.addEventListener(event, activityHandler, true)
    })

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // 页面重新可见时检查会话状态
        if (this.isSessionExpired() && this.timeoutCallback) {
          this.timeoutCallback()
        } else {
          this.updateActivity()
        }
      }
    })

    // 监听存储变化（多标签页同步）
    window.addEventListener('storage', (e) => {
      if (e.key === 'sms_last_activity' && e.newValue) {
        this.lastActivity = parseInt(e.newValue)
        this.resetTimeout()
      }
    })
  }
}

// 安全工具
export class SecurityUtils {
  // 生成随机字符串
  static generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // 生成会话ID
  static generateSessionId(): string {
    return this.generateRandomString(32)
  }

  // 掩码邮箱地址
  static maskEmail(email: string): string {
    const [username, domain] = email.split('@')
    if (username.length <= 2) return email
    
    const maskedUsername = username[0] + '*'.repeat(username.length - 2) + username[username.length - 1]
    return `${maskedUsername}@${domain}`
  }

  // 掩码手机号
  static maskPhone(phone: string): string {
    if (phone.length <= 4) return phone
    return phone.slice(0, 3) + '*'.repeat(phone.length - 6) + phone.slice(-3)
  }

  // 获取客户端信息
  static getClientInfo(): { userAgent: string; platform: string } {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform
    }
  }

  // 简单的IP地址获取（实际应用中应从服务器获取）
  static async getClientIP(): Promise<string> {
    try {
      // 这里应该调用后端API获取真实IP
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }
}

// 审计日志工具
export class AuditLogger {
  // 记录用户操作
  static async logUserAction(
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    const user = TokenManager.getUser()
    if (!user) return

    const clientInfo = SecurityUtils.getClientInfo()
    const ipAddress = await SecurityUtils.getClientIP()

    const logEntry = {
      id: SecurityUtils.generateRandomString(16),
      userId: user.id,
      userEmail: user.email,
      action,
      resource,
      resourceId,
      details: details || {},
      ipAddress,
      userAgent: clientInfo.userAgent,
      timestamp: new Date().toISOString(),
      result: 'success' as const
    }

    // 这里应该发送到后端API保存
    // TODO: 发送到后端API保存审计日志
  }

  // 记录登录事件
  static async logLogin(email: string, success: boolean, errorMessage?: string): Promise<void> {
    const clientInfo = SecurityUtils.getClientInfo()
    const ipAddress = await SecurityUtils.getClientIP()

    const logEntry = {
      id: SecurityUtils.generateRandomString(16),
      userId: success ? TokenManager.getUser()?.id || 'unknown' : 'unknown',
      userEmail: email,
      action: 'user.login',
      resource: 'auth',
      details: {
        platform: clientInfo.platform,
        timestamp: new Date().toISOString()
      },
      ipAddress,
      userAgent: clientInfo.userAgent,
      timestamp: new Date().toISOString(),
      result: success ? 'success' as const : 'failure' as const,
      errorMessage
    }

    // 这里应该发送到后端API保存
    // TODO: 发送到后端API保存登录审计日志
  }
}