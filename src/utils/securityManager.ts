// 安全管理器 - 处理登录失败限制、IP保护等安全功能

import { SECURITY_CONFIG } from '../types/auth'

// 登录尝试记录接口
interface LoginAttempt {
  email: string
  ip: string
  timestamp: number
  success: boolean
  userAgent?: string
}

// IP锁定记录接口
interface IPLockout {
  ip: string
  attempts: number
  lockedUntil: number
  firstAttempt: number
}

// 用户锁定记录接口
interface UserLockout {
  email: string
  attempts: number
  lockedUntil: number
  lockoutCount: number // 锁定次数，用于渐进式锁定
}

// 安全管理器类
export class SecurityManager {
  private static readonly STORAGE_PREFIX = 'sms_security_'
  private static readonly LOGIN_ATTEMPTS_KEY = 'login_attempts'
  private static readonly IP_LOCKOUTS_KEY = 'ip_lockouts'
  private static readonly USER_LOCKOUTS_KEY = 'user_lockouts'

  // 记录登录尝试
  static recordLoginAttempt(email: string, ip: string, success: boolean, userAgent?: string): void {
    const attempts = this.getLoginAttempts()
    const attempt: LoginAttempt = {
      email,
      ip,
      timestamp: Date.now(),
      success,
      userAgent
    }

    attempts.push(attempt)

    // 保留最近1000条记录
    if (attempts.length > 1000) {
      attempts.splice(0, attempts.length - 1000)
    }

    this.saveLoginAttempts(attempts)

    // 如果登录失败，检查是否需要锁定
    if (!success) {
      this.checkAndApplyLockout(email, ip)
    }
  }

  // 检查并应用锁定策略
  private static checkAndApplyLockout(email: string, ip: string): void {
    const now = Date.now()

    // 检查用户锁定
    this.checkUserLockout(email, now)

    // 检查IP锁定
    if (SECURITY_CONFIG.ENABLE_IP_BLACKLIST) {
      this.checkIPLockout(ip, now)
    }
  }

  // 检查用户锁定
  private static checkUserLockout(email: string, now: number): void {
    const userLockouts = this.getUserLockouts()
    let userLockout = userLockouts.find(lockout => lockout.email === email)

    if (!userLockout) {
      userLockout = {
        email,
        attempts: 0,
        lockedUntil: 0,
        lockoutCount: 0
      }
      userLockouts.push(userLockout)
    }

    // 如果锁定已过期，重置计数
    if (userLockout.lockedUntil > 0 && now > userLockout.lockedUntil) {
      userLockout.attempts = 0
      userLockout.lockedUntil = 0
    }

    userLockout.attempts++

    // 检查是否需要锁定
    if (userLockout.attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      let lockoutDuration = SECURITY_CONFIG.LOCKOUT_DURATION

      // 渐进式锁定
      if (SECURITY_CONFIG.PROGRESSIVE_LOCKOUT) {
        lockoutDuration = Math.min(
          lockoutDuration * Math.pow(SECURITY_CONFIG.LOCKOUT_MULTIPLIER, userLockout.lockoutCount),
          SECURITY_CONFIG.MAX_LOCKOUT_DURATION
        )
      }

      userLockout.lockedUntil = now + lockoutDuration
      userLockout.lockoutCount++
      userLockout.attempts = 0 // 重置尝试次数
    }

    this.saveUserLockouts(userLockouts)
  }

  // 检查IP锁定
  private static checkIPLockout(ip: string, now: number): void {
    const ipLockouts = this.getIPLockouts()
    let ipLockout = ipLockouts.find(lockout => lockout.ip === ip)

    if (!ipLockout) {
      ipLockout = {
        ip,
        attempts: 0,
        lockedUntil: 0,
        firstAttempt: now
      }
      ipLockouts.push(ipLockout)
    }

    // 如果锁定已过期，重置计数
    if (ipLockout.lockedUntil > 0 && now > ipLockout.lockedUntil) {
      ipLockout.attempts = 0
      ipLockout.lockedUntil = 0
      ipLockout.firstAttempt = now
    }

    ipLockout.attempts++

    // 检查是否需要锁定IP
    if (ipLockout.attempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS_PER_IP) {
      ipLockout.lockedUntil = now + SECURITY_CONFIG.IP_LOCKOUT_DURATION
      ipLockout.attempts = 0 // 重置尝试次数
    }

    this.saveIPLockouts(ipLockouts)
  }

  // 检查用户是否被锁定
  static isUserLocked(email: string): { locked: boolean; remainingTime?: number } {
    const userLockouts = this.getUserLockouts()
    const userLockout = userLockouts.find(lockout => lockout.email === email)

    if (!userLockout || userLockout.lockedUntil === 0) {
      return { locked: false }
    }

    const now = Date.now()
    if (now > userLockout.lockedUntil) {
      // 锁定已过期，清除锁定状态
      userLockout.lockedUntil = 0
      userLockout.attempts = 0
      this.saveUserLockouts(userLockouts)
      return { locked: false }
    }

    return {
      locked: true,
      remainingTime: userLockout.lockedUntil - now
    }
  }

  // 检查IP是否被锁定
  static isIPLocked(ip: string): { locked: boolean; remainingTime?: number } {
    if (!SECURITY_CONFIG.ENABLE_IP_BLACKLIST) {
      return { locked: false }
    }

    const ipLockouts = this.getIPLockouts()
    const ipLockout = ipLockouts.find(lockout => lockout.ip === ip)

    if (!ipLockout || ipLockout.lockedUntil === 0) {
      return { locked: false }
    }

    const now = Date.now()
    if (now > ipLockout.lockedUntil) {
      // 锁定已过期，清除锁定状态
      ipLockout.lockedUntil = 0
      ipLockout.attempts = 0
      this.saveIPLockouts(ipLockouts)
      return { locked: false }
    }

    return {
      locked: true,
      remainingTime: ipLockout.lockedUntil - now
    }
  }

  // 获取用户剩余登录尝试次数
  static getRemainingAttempts(email: string): number {
    const userLockouts = this.getUserLockouts()
    const userLockout = userLockouts.find(lockout => lockout.email === email)

    if (!userLockout) {
      return SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS
    }

    // 如果已锁定，返回0
    if (userLockout.lockedUntil > Date.now()) {
      return 0
    }

    return Math.max(0, SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - userLockout.attempts)
  }

  // 检查是否需要验证码
  static requiresCaptcha(email: string): boolean {
    const userLockouts = this.getUserLockouts()
    const userLockout = userLockouts.find(lockout => lockout.email === email)

    if (!userLockout) {
      return false
    }

    return userLockout.attempts >= SECURITY_CONFIG.CAPTCHA_THRESHOLD
  }

  // 清除用户锁定状态（管理员操作）
  static clearUserLockout(email: string): void {
    const userLockouts = this.getUserLockouts()
    const index = userLockouts.findIndex(lockout => lockout.email === email)

    if (index !== -1) {
      userLockouts.splice(index, 1)
      this.saveUserLockouts(userLockouts)
    }
  }

  // 清除IP锁定状态（管理员操作）
  static clearIPLockout(ip: string): void {
    const ipLockouts = this.getIPLockouts()
    const index = ipLockouts.findIndex(lockout => lockout.ip === ip)

    if (index !== -1) {
      ipLockouts.splice(index, 1)
      this.saveIPLockouts(ipLockouts)
    }
  }

  // 获取安全统计信息
  static getSecurityStats(): {
    totalAttempts: number
    failedAttempts: number
    successfulAttempts: number
    lockedUsers: number
    lockedIPs: number
    recentAttempts: LoginAttempt[]
  } {
    const attempts = this.getLoginAttempts()
    const userLockouts = this.getUserLockouts()
    const ipLockouts = this.getIPLockouts()
    const now = Date.now()

    // 最近24小时的尝试
    const recentAttempts = attempts.filter(attempt => 
      now - attempt.timestamp < 24 * 60 * 60 * 1000
    )

    return {
      totalAttempts: recentAttempts.length,
      failedAttempts: recentAttempts.filter(a => !a.success).length,
      successfulAttempts: recentAttempts.filter(a => a.success).length,
      lockedUsers: userLockouts.filter(u => u.lockedUntil > now).length,
      lockedIPs: ipLockouts.filter(ip => ip.lockedUntil > now).length,
      recentAttempts: recentAttempts.slice(-50) // 最近50次尝试
    }
  }

  // 清理过期数据
  static cleanupExpiredData(): void {
    const now = Date.now()
    const retentionTime = 30 * 24 * 60 * 60 * 1000 // 30天

    // 清理过期的登录尝试记录
    const attempts = this.getLoginAttempts()
    const validAttempts = attempts.filter(attempt => 
      now - attempt.timestamp < retentionTime
    )
    this.saveLoginAttempts(validAttempts)

    // 清理过期的用户锁定记录
    const userLockouts = this.getUserLockouts()
    const validUserLockouts = userLockouts.filter(lockout => 
      lockout.lockedUntil > now || (now - lockout.lockedUntil < retentionTime)
    )
    this.saveUserLockouts(validUserLockouts)

    // 清理过期的IP锁定记录
    const ipLockouts = this.getIPLockouts()
    const validIPLockouts = ipLockouts.filter(lockout => 
      lockout.lockedUntil > now || (now - lockout.lockedUntil < retentionTime)
    )
    this.saveIPLockouts(validIPLockouts)
  }

  // 存储操作
  private static getLoginAttempts(): LoginAttempt[] {
    const data = localStorage.getItem(this.STORAGE_PREFIX + this.LOGIN_ATTEMPTS_KEY)
    return data ? JSON.parse(data) : []
  }

  private static saveLoginAttempts(attempts: LoginAttempt[]): void {
    localStorage.setItem(
      this.STORAGE_PREFIX + this.LOGIN_ATTEMPTS_KEY,
      JSON.stringify(attempts)
    )
  }

  private static getUserLockouts(): UserLockout[] {
    const data = localStorage.getItem(this.STORAGE_PREFIX + this.USER_LOCKOUTS_KEY)
    return data ? JSON.parse(data) : []
  }

  private static saveUserLockouts(lockouts: UserLockout[]): void {
    localStorage.setItem(
      this.STORAGE_PREFIX + this.USER_LOCKOUTS_KEY,
      JSON.stringify(lockouts)
    )
  }

  private static getIPLockouts(): IPLockout[] {
    const data = localStorage.getItem(this.STORAGE_PREFIX + this.IP_LOCKOUTS_KEY)
    return data ? JSON.parse(data) : []
  }

  private static saveIPLockouts(lockouts: IPLockout[]): void {
    localStorage.setItem(
      this.STORAGE_PREFIX + this.IP_LOCKOUTS_KEY,
      JSON.stringify(lockouts)
    )
  }
}