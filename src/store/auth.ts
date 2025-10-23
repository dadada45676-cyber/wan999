// 用户认证状态管理

import { create } from 'zustand'
import { AuthService, AuthStateListener } from '../services/auth'
import { log } from '../utils/logger'
import { 
  User, 
  LoginForm, 
  LoginResponse, 
  AuditLog, 
  CreateUserForm, 
  EditUserForm,
  PasswordResetForm
} from '../types/auth'
import { AuditLogger } from '../utils/auth'

// 权限检查器
class PermissionChecker {
  static hasPermission(user: User | null, permission: string): boolean {
    if (!user || !user.permissions) return false
    return user.permissions.includes(permission)
  }

  static hasAnyPermission(user: User | null, permissions: string[]): boolean {
    if (!user || !user.permissions) return false
    return permissions.some(permission => user.permissions.includes(permission))
  }

  static hasAllPermissions(user: User | null, permissions: string[]): boolean {
    if (!user || !user.permissions) return false
    return permissions.every(permission => user.permissions.includes(permission))
  }

  static isAdmin(user: User | null): boolean {
    return user?.role === 'admin'
  }

  static isOperator(user: User | null): boolean {
    return user?.role === 'operator'
  }
}

// 认证状态接口
interface AuthState {
  // 认证状态
  isAuthenticated: boolean
  user: User | null
  token: string | null
  isLoading: boolean
  
  // 登录状态
  loginAttempts: number
  isLocked: boolean
  lockoutEndTime: number | null
  requiresCaptcha: boolean
  
  // 用户管理
  users: User[]
  isInitialized: boolean
  
  // 审计日志
  auditLogs: AuditLog[]
  
  // 错误状态
  error: string | null
  
  // 认证操作
  login: (form: LoginForm) => Promise<LoginResponse>
  logout: () => void
  refreshToken: () => Promise<boolean>
  checkAuth: () => Promise<boolean>
  
  // 密码管理
  changePassword: (form: PasswordResetForm) => Promise<{ success: boolean; error?: string }>
  resetPassword: (email: string) => Promise<boolean>
  
  // 用户管理操作
  createUser: (form: CreateUserForm) => Promise<boolean>
  updateUser: (userId: string, form: EditUserForm) => Promise<boolean>
  deleteUser: (userId: string) => Promise<boolean>
  lockUser: (userId: string) => Promise<boolean>
  unlockUser: (userId: string) => Promise<boolean>
  
  // 系统初始化
  initializeSystem: () => Promise<boolean>
  isSystemInitialized: () => boolean
  
  // 权限检查
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  isAdmin: () => boolean
  isOperator: () => boolean
  
  // 审计日志
  getAuditLogs: (filters?: any) => AuditLog[]
  addAuditLog: (log: AuditLog) => void
  
  // 状态管理
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  clearError: () => void
}

// 用户数据从Supabase获取

// 创建认证store
export const useAuthStore = create<AuthState>((set, get) => ({
  // 初始状态
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: false,
  
  loginAttempts: 0,
  isLocked: false,
  lockoutEndTime: null,
  requiresCaptcha: false,
  
  users: [],
  isInitialized: false,
  
  auditLogs: [],
  error: null,

  // 登录操作
  login: async (form: LoginForm): Promise<LoginResponse> => {
    try {
      set({ isLoading: true, error: null })
      
      // 使用Supabase认证服务
      const response = await AuthService.login(form)
      
      if (response.success && response.user) {
        // 更新状态
        set({
          isAuthenticated: true,
          user: response.user,
          token: response.token || null,
          loginAttempts: 0,
          isLocked: false,
          lockoutEndTime: null,
          requiresCaptcha: false,
          error: null
        })
        
        // 记录登录成功
        await AuditLogger.logLogin(form.email, true)
      } else {
        set({ error: response.message })
      }
      
      return response
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败'
      set({ error: errorMessage })
      
      return {
        success: false,
        message: errorMessage
      }
    } finally {
      set({ isLoading: false })
    }
  },

  // 登出操作
  logout: async () => {
    const user = get().user
    
    try {
      // 使用Supabase认证服务登出
      await AuthService.logout()
      
      // 重置状态
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        error: null
      })
      
      // 记录登出
      if (user) {
        await AuditLogger.logUserAction('user.logout', 'auth')
      }
    } catch (error) {
      // 即使登出失败，也要清除本地状态
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        error: null
      })
    }
  },

  // 刷新Token
  refreshToken: async (): Promise<boolean> => {
    try {
      return await AuthService.refreshSession()
    } catch {
      return false
    }
  },

  // 检查认证状态
  checkAuth: async (): Promise<boolean> => {
    // 设置加载状态
    set({ isLoading: true, error: null })
    
    try {
      const user = await AuthService.getCurrentUser()
      
      if (!user) {
        set({ 
          isAuthenticated: false, 
          user: null, 
          token: null,
          isLoading: false 
        })
        return false
      }
      
      // 更新状态
      set({ 
        isAuthenticated: true, 
        user, 
        token: null, // Token由Supabase管理
        isLoading: false
      })
      
      return true
    } catch (error) {
      set({ 
        isAuthenticated: false, 
        user: null, 
        token: null,
        isLoading: false,
        error: error instanceof Error ? error.message : '认证检查失败'
      })
      return false
    }
  },

  // 修改密码
  changePassword: async (form: PasswordResetForm): Promise<{ success: boolean; error?: string }> => {
    try {
      set({ isLoading: true, error: null })
      
      const state = get()
      if (!state.user) {
        const errorMsg = '用户未登录'
        set({ error: errorMsg })
        return { success: false, error: errorMsg }
      }

      // 使用Supabase认证服务修改密码
      const result = await AuthService.changePassword(form.newPassword)
      
      if (result.success) {
        // 记录密码修改
        await AuditLogger.logUserAction('user.password_change', 'auth', state.user.id)
        return { success: true }
      } else {
        const errorMsg = result.error || '密码修改失败'
        set({ error: errorMsg })
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '密码修改失败'
      set({ error: errorMessage })
      return { success: false, error: errorMessage }
    } finally {
      set({ isLoading: false })
    }
  },

  // 重置密码
  resetPassword: async (email: string): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null })
      
      // 使用Supabase认证服务重置密码
      const result = await AuthService.resetPassword(email)
      
      if (result.success) {
        // 记录密码重置请求
        await AuditLogger.logUserAction('user.password_reset_request', 'auth', undefined, { email })
        return true
      } else {
        set({ error: result.error })
        return false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '密码重置失败'
      set({ error: errorMessage })
      return false
    } finally {
      set({ isLoading: false })
    }
  },

  // 创建用户
  createUser: async (form: CreateUserForm): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null })
      
      const currentUser = get().user
      if (!currentUser || !get().hasPermission('page.user')) {
        set({ error: '权限不足' })
        return false
      }
      
      // 使用Supabase认证服务创建用户
      const result = await AuthService.createUser(form)
      
      if (result.success && result.user) {
        // 更新用户列表
        set(state => ({
          users: [...state.users, result.user!]
        }))
        
        // 记录用户创建
        await AuditLogger.logUserAction('user.create', 'user', result.user.id, {
          email: form.email,
          name: form.name,
          role: form.role
        })
        
        return true
      } else {
        set({ error: result.error })
        return false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '用户创建失败'
      set({ error: errorMessage })
      return false
    } finally {
      set({ isLoading: false })
    }
  },

  // 更新用户
  updateUser: async (userId: string, form: EditUserForm): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null })
      
      const currentUser = get().user
      if (!currentUser || !get().hasPermission('page.user')) {
        set({ error: '权限不足' })
        return false
      }
      
      // 使用Supabase认证服务更新用户
      const result = await AuthService.updateUser(userId, form)
      
      if (result.success && result.user) {
        // 更新用户列表
        set(state => ({
          users: state.users.map(u => u.id === userId ? result.user! : u)
        }))
        
        // 如果更新的是当前用户，同步更新认证状态
        if (currentUser.id === userId) {
          set({ user: result.user })
        }
        
        // 记录用户更新
        await AuditLogger.logUserAction('user.update', 'user', userId, {
          changes: form
        })
        
        return true
      } else {
        set({ error: result.error })
        return false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '用户更新失败'
      set({ error: errorMessage })
      return false
    } finally {
      set({ isLoading: false })
    }
  },

  // 删除用户
  deleteUser: async (userId: string): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null })
      
      const currentUser = get().user
      if (!currentUser || !get().hasPermission('page.user')) {
        set({ error: '权限不足' })
        return false
      }
      
      // 使用Supabase认证服务删除用户
      const result = await AuthService.deleteUser(userId)
      
      if (result.success) {
        // 从用户列表中移除
        set(state => ({
          users: state.users.filter(u => u.id !== userId)
        }))
        
        // 记录用户删除
        await AuditLogger.logUserAction('user.delete', 'user', userId, {
          action: 'delete'
        })
        
        return true
      } else {
        set({ error: result.error })
        return false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '用户删除失败'
      set({ error: errorMessage })
      return false
    } finally {
      set({ isLoading: false })
    }
  },

  // 锁定用户
  lockUser: async (userId: string): Promise<boolean> => {
    try {
      const currentUser = get().user
      if (!currentUser || !get().hasPermission('page.user')) {
        set({ error: '权限不足' })
        return false
      }
      
      // 使用Supabase认证服务锁定用户
      const result = await AuthService.lockUser(userId)
      
      if (result.success) {
        // 更新用户状态
        set(state => ({
          users: state.users.map(u => 
            u.id === userId 
              ? { ...u, status: 'locked' as const }
              : u
          )
        }))
        
        await AuditLogger.logUserAction('user.lock', 'user', userId)
        return true
      } else {
        set({ error: result.error })
        return false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '用户锁定失败'
      set({ error: errorMessage })
      return false
    }
  },

  // 解锁用户
  unlockUser: async (userId: string): Promise<boolean> => {
    try {
      const currentUser = get().user
      if (!currentUser || !get().hasPermission('page.user')) {
        set({ error: '权限不足' })
        return false
      }
      
      // 使用Supabase认证服务解锁用户
      const result = await AuthService.unlockUser(userId)
      
      if (result.success) {
        // 更新用户状态
        set(state => ({
          users: state.users.map(u => 
            u.id === userId 
              ? { ...u, status: 'active' as const }
              : u
          )
        }))
        
        await AuditLogger.logUserAction('user.unlock', 'user', userId)
        return true
      } else {
        set({ error: result.error })
        return false
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '用户解锁失败'
      set({ error: errorMessage })
      return false
    }
  },

  // 系统初始化
  initializeSystem: async (): Promise<boolean> => {
    try {
      set({ isLoading: true })
      
      // 检查是否已初始化
      if (get().isInitialized) {
        return true
      }
      
      // 初始化认证状态监听器
      AuthStateListener.init()
      AuthStateListener.addListener((user) => {
        set({ user, isAuthenticated: !!user })
      })
      
      // 检查当前认证状态
      const currentUser = await AuthService.getCurrentUser()
      if (currentUser) {
        set({ user: currentUser, isAuthenticated: true })
        
        // 如果是管理员，获取所有用户列表
        if (currentUser.role === 'admin') {
          const users = await AuthService.getAllUsers()
          set({ users })
        }
      }
      
      set({ isInitialized: true })
      return true
      
    } catch (error) {
      log.error('系统初始化失败', error, 'AuthStore')
      return false
    } finally {
      set({ isLoading: false })
    }
  },

  // 检查系统是否已初始化
  isSystemInitialized: (): boolean => {
    return get().isInitialized
  },

  // 权限检查方法
  hasPermission: (permission: string): boolean => {
    return PermissionChecker.hasPermission(get().user, permission)
  },

  hasAnyPermission: (permissions: string[]): boolean => {
    return PermissionChecker.hasAnyPermission(get().user, permissions)
  },

  hasAllPermissions: (permissions: string[]): boolean => {
    return PermissionChecker.hasAllPermissions(get().user, permissions)
  },

  isAdmin: (): boolean => {
    return PermissionChecker.isAdmin(get().user)
  },

  isOperator: (): boolean => {
    return PermissionChecker.isOperator(get().user)
  },

  // 审计日志管理
  getAuditLogs: (filters?: any): AuditLog[] => {
    const logs = get().auditLogs
    
    if (filters) {
      // 这里可以添加过滤逻辑
      // 比如按时间、用户、操作类型等过滤
    }
    
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  },

  addAuditLog: (log: AuditLog): void => {
    set(state => ({
      auditLogs: [log, ...state.auditLogs]
    }))
  },

  // 状态管理
  setError: (error: string | null): void => {
    set({ error })
  },

  setLoading: (loading: boolean): void => {
    set({ isLoading: loading })
  },

  clearError: (): void => {
    set({ error: null })
  }
}))

// 认证状态管理已完全迁移到Supabase

// 选择器函数 - 简化避免无限循环
export const useAuth = () => useAuthStore(state => state)

export const useAuthActions = () => useAuthStore(state => state)

export const usePermissions = () => useAuthStore(state => state)

export const useUserManagement = () => useAuthStore(state => state)

export const useAuditLogs = () => useAuthStore(state => state)