// Supabase认证服务
import { supabase } from '../lib/supabase'
import { User, LoginForm, LoginResponse, CreateUserForm, EditUserForm } from '../types/auth'
import { AuthError, AuthResponse, User as SupabaseUser } from '@supabase/supabase-js'
import { APIUtils } from '../utils/api'
import { log } from '../utils/logger'

// 认证服务类
export class AuthService {
  
  // 登录
  static async login(form: LoginForm): Promise<LoginResponse> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password
        })

        if (error) {
          throw new Error(this.getErrorMessage(error))
        }

        if (!data.user) {
          throw new Error('登录失败，请重试')
        }

        // 获取用户详细信息
        const userProfile = await this.getUserProfile(data.user.id)
        
        return {
          success: true,
          token: data.session?.access_token,
          user: userProfile,
          message: '登录成功'
        }
      },
      { 
        operation: `auth:login:${form.email}`,
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      return response.data
    }

    return {
      success: false,
      message: response.error?.message || '登录失败，请重试'
    }
  }

  // 登出
  static async logout(): Promise<void> {
    const response = await APIUtils.apiCall(
      async () => {
        await supabase.auth.signOut()
        return true
      },
      { 
        operation: 'auth:logout',
        cache: false, 
        retries: 1 
      }
    )

    if (!response.success) {
      throw new Error(response.error?.message || '登出失败')
    }
  }

  // 获取当前用户
  static async getCurrentUser(): Promise<User | null> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          return null
        }

        return await this.getUserProfile(user.id)
      },
      { 
        operation: 'auth:current-user',
        cache: true, 
        cacheTTL: 2 * 60 * 1000 
      }
    )

    return response.success ? response.data : null
  }

  // 刷新会话
  static async refreshSession(): Promise<boolean> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase.auth.refreshSession()
        return !error && !!data.session
      },
      { 
        operation: 'auth:refresh-session',
        cache: false, 
        retries: 2 
      }
    )

    return response.success ? response.data || false : false
  }

  // 修改密码
  static async changePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        })

        if (error) {
          throw new Error(this.getErrorMessage(error))
        }

        return { success: true }
      },
      { 
        operation: 'auth:change-password',
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '密码修改失败，请重试'
    }
  }

  // 重置密码
  static async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })

        if (error) {
          throw new Error(this.getErrorMessage(error))
        }

        return { success: true }
      },
      { 
        operation: `auth:reset-password:${email}`,
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '密码重置失败，请重试'
    }
  }

  // 创建用户
  static async createUser(form: CreateUserForm): Promise<{ success: boolean; error?: string; user?: User }> {
    const response = await APIUtils.apiCall(
      async () => {
        // 获取当前用户的 session token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('用户未登录')
        }

        // 调用 Edge Function 创建用户
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: form.email,
            password: form.password,
            name: form.name,
            role: form.role,
            department: form.department,
            phone: form.phone,
            status: form.status || 'active'
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (error) {
          throw new Error(error.message || '用户创建失败')
        }

        if (data?.error) {
          throw new Error(data.error)
        }

        if (!data?.user) {
          throw new Error('用户创建失败，请重试')
        }

        const user = this.mapProfileToUser(data.user)
        return {
          success: true,
          user
        }
      },
      { 
        operation: `auth:create-user:${form.email}`,
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      // 清除用户列表缓存
      APIUtils.cache.delete('auth:users')
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '用户创建失败，请重试'
    }
  }

  // 更新用户
  static async updateUser(userId: string, form: EditUserForm): Promise<{ success: boolean; error?: string; user?: User }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('user_profiles')
          .update({
            name: form.name,
            email: form.email,
            role: form.role,
            department: form.department,
            phone: form.phone,
            status: form.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single()

        if (error) {
          throw new Error('用户更新失败，请重试')
        }

        const user = this.mapProfileToUser(data)
        return {
          success: true,
          user
        }
      },
      { cache: false, retries: 1 }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      APIUtils.cache.delete('auth:users')
      APIUtils.cache.delete('auth:current-user')
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '用户更新失败，请重试'
    }
  }

  // 获取所有用户
  static async getAllUsers(): Promise<User[]> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          throw new Error('获取用户列表失败')
        }

        return data?.map(this.mapProfileToUser) || []
      },
      { 
        operation: 'auth:users',
        cache: true, 
        cacheTTL: 5 * 60 * 1000 
      }
    )

    return response.success ? response.data || [] : []
  }

  // 删除用户
  static async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    const response = await APIUtils.apiCall(
      async () => {
        // 删除用户档案
        const { error: profileError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', userId)

        if (profileError) {
          throw new Error('删除用户档案失败')
        }

        // 删除认证用户
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)

        if (authError) {
          throw new Error('删除认证用户失败')
        }

        return { success: true }
      },
      { cache: false, retries: 1 }
    )

    if (response.success && response.data) {
      // 清除用户列表缓存
      APIUtils.cache.delete('auth:users')
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '删除用户失败，请重试'
    }
  }

  // 锁定用户
  static async lockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    return this.updateUserStatus(userId, 'locked')
  }

  // 解锁用户
  static async unlockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    return this.updateUserStatus(userId, 'active')
  }

  // 私有方法：获取用户档案
  private static async getUserProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        return null
      }

      return this.mapProfileToUser(data)
    } catch {
      return null
    }
  }

  // 私有方法：更新用户状态
  private static async updateUserStatus(userId: string, status: 'active' | 'locked'): Promise<{ success: boolean; error?: string }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { error } = await supabase
          .from('user_profiles')
          .update({ 
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) {
          throw new Error(`${status === 'locked' ? '锁定' : '解锁'}用户失败`)
        }

        return { success: true }
      },
      { cache: false, retries: 1 }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      APIUtils.cache.delete('auth:users')
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || `${status === 'locked' ? '锁定' : '解锁'}用户失败，请重试`
    }
  }

  // 私有方法：映射数据库记录到用户对象
  private static mapProfileToUser(profile: any): User {
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      status: profile.status,
      department: profile.department,
      phone: profile.phone,
      permissions: this.getRolePermissions(profile.role),
      lastLogin: profile.last_login,
      createdAt: profile.created_at,
      createdBy: profile.created_by,
      mustChangePassword: profile.must_change_password || false,
      loginAttempts: profile.login_attempts || 0,
      lockedUntil: profile.locked_until,
      loginCount: profile.login_count || 0
    }
  }

  // 私有方法：获取角色权限
  private static getRolePermissions(role: string): string[] {
    const ROLE_PERMISSIONS = {
      admin: [
        'page.package',
        'page.phone', 
        'page.user',
        'page.settings',
        'page.report',
        'page.analysis'
      ],
      operator: [
        'page.package',
        'page.phone',
        'page.report', 
        'page.analysis'
      ]
    }

    return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || []
  }

  // 私有方法：获取错误消息
  private static getErrorMessage(error: AuthError | null): string {
    if (!error) return '未知错误'

    // 检查是否为网络连接错误
    if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
      return this.getNetworkErrorMessage()
    }

    switch (error.message) {
      case 'Invalid login credentials':
        return '用户名或密码错误'
      case 'Email not confirmed':
        return '邮箱未验证，请检查邮件'
      case 'Too many requests':
        return '请求过于频繁，请稍后再试'
      case 'User not found':
        return '用户不存在'
      case 'Password should be at least 6 characters':
        return '密码至少需要6个字符'
      case 'NetworkError':
      case 'TypeError: Failed to fetch':
        return this.getNetworkErrorMessage()
      default:
        // 检查是否包含网络相关关键词
        if (error.message.toLowerCase().includes('network') || 
            error.message.toLowerCase().includes('connection') ||
            error.message.toLowerCase().includes('timeout')) {
          return this.getNetworkErrorMessage()
        }
        return error.message || '操作失败，请重试'
    }
  }

  // 获取网络错误详细信息
  private static getNetworkErrorMessage(): string {
    const isProduction = import.meta.env.PROD
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    let message = '网络连接失败，请检查以下项目：\n'
    message += '• 检查网络连接是否正常\n'
    message += '• 确认防火墙未阻止访问\n'
    
    if (isProduction) {
      message += '• 验证服务器配置是否正确\n'
      if (supabaseUrl) {
        message += `• 检查 Supabase 服务状态 (${supabaseUrl})\n`
      }
    } else {
      message += '• 检查开发环境配置\n'
    }
    
    message += '• 如问题持续，请联系技术支持'
    
    return message
  }

  // 网络连接诊断
  static async diagnoseNetworkConnection(): Promise<{
    success: boolean
    details: {
      internetConnection: boolean
      supabaseReachable: boolean
      dnsResolution: boolean
      corsIssue: boolean
    }
    message: string
  }> {
    const details = {
      internetConnection: false,
      supabaseReachable: false,
      dnsResolution: false,
      corsIssue: false
    }

    try {
      // 1. 检查基本网络连接
      try {
        const response = await fetch('https://www.google.com/favicon.ico', { 
          method: 'HEAD', 
          mode: 'no-cors',
          cache: 'no-cache'
        })
        details.internetConnection = true
      } catch {
        details.internetConnection = false
      }

      // 2. 检查 DNS 解析
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (supabaseUrl) {
        try {
          const url = new URL(supabaseUrl)
          const response = await fetch(`${url.origin}/health`, { 
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
          })
          details.dnsResolution = true
        } catch {
          details.dnsResolution = false
        }

        // 3. 检查 Supabase 可达性
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'HEAD',
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
            }
          })
          details.supabaseReachable = response.ok
          details.corsIssue = false
        } catch (error: any) {
          details.supabaseReachable = false
          // 检查是否为 CORS 错误
          if (error.message && error.message.includes('CORS')) {
            details.corsIssue = true
          }
        }
      }

      // 生成诊断消息
      let message = '网络诊断结果：\n'
      message += `• 互联网连接: ${details.internetConnection ? '✓ 正常' : '✗ 异常'}\n`
      message += `• DNS 解析: ${details.dnsResolution ? '✓ 正常' : '✗ 异常'}\n`
      message += `• Supabase 连接: ${details.supabaseReachable ? '✓ 正常' : '✗ 异常'}\n`
      
      if (details.corsIssue) {
        message += '• CORS 配置: ✗ 存在问题\n'
        message += '\n建议：检查 Supabase 项目的 CORS 设置'
      }

      const success = details.internetConnection && details.supabaseReachable
      
      if (!success) {
        message += '\n\n故障排除建议：\n'
        if (!details.internetConnection) {
          message += '• 检查网络连接\n'
        }
        if (!details.dnsResolution) {
          message += '• 检查 DNS 设置\n'
        }
        if (!details.supabaseReachable) {
          message += '• 检查 Supabase 服务状态\n'
          message += '• 验证 API 密钥配置\n'
        }
      }

      return { success, details, message }
    } catch (error) {
      return {
        success: false,
        details,
        message: `诊断过程出错: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }
}

// 认证状态监听器
export class AuthStateListener {
  private static listeners: Array<(user: User | null) => void> = []

  // 初始化监听器
  static init() {
    supabase.auth.onAuthStateChange(async (event, session) => {
      let user: User | null = null

      if (session?.user) {
        user = await AuthService.getCurrentUser()
      }

      // 通知所有监听器
      this.listeners.forEach(listener => listener(user))
    })
  }

  // 添加监听器
  static addListener(listener: (user: User | null) => void) {
    this.listeners.push(listener)
  }

  // 移除监听器
  static removeListener(listener: (user: User | null) => void) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }
}