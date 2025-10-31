import { useMemo } from 'react'
import { useCallback } from 'react'
import { useAuth } from '../store/auth'
import { PERMISSIONS, ROLE_PERMISSIONS, UserRole } from '../types/auth'
import { PermissionChecker } from '../utils/auth'

/**
 * 权限检查Hook
 * 提供权限验证、角色检查等功能
 */
export const usePermissions = () => {
  const { user, isAuthenticated } = useAuth()

  // 当前用户权限列表
  const userPermissions = useMemo(() => {
    if (!user || !isAuthenticated) return []
    return ROLE_PERMISSIONS[user.role] || []
  }, [user, isAuthenticated])

  // 检查是否有特定权限
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user || !isAuthenticated) return false
    return PermissionChecker.hasPermission(user, permission)
  }, [user, isAuthenticated])

  // 检查是否有任一权限
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!user || !isAuthenticated) return false
    return PermissionChecker.hasAnyPermission(user, permissions)
  }, [user, isAuthenticated])

  // 检查是否有所有权限
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (!user || !isAuthenticated) return false
    return PermissionChecker.hasAllPermissions(user, permissions)
  }, [user, isAuthenticated])

  // 检查是否是特定角色
  const hasRole = useCallback((role: UserRole): boolean => {
    if (!user || !isAuthenticated) return false
    return user.role === role
  }, [user, isAuthenticated])

  // 检查是否是管理员
  const isAdmin = useCallback((): boolean => {
    return PermissionChecker.isAdmin(user)
  }, [user])

  // 检查是否是操作员
  const isOperator = useCallback((): boolean => {
    return PermissionChecker.isOperator(user)
  }, [user])

  // 页面级权限检查方法
  const canAccessPackage = useCallback((): boolean => {
    return hasPermission(PERMISSIONS.PAGE_PACKAGE)
  }, [hasPermission])

  const canAccessPhone = useCallback((): boolean => {
    return hasPermission(PERMISSIONS.PAGE_PHONE)
  }, [hasPermission])

  const canAccessUser = useCallback((): boolean => {
    return hasPermission(PERMISSIONS.PAGE_USER)
  }, [hasPermission])

  const canAccessSettings = useCallback((): boolean => {
    return hasPermission(PERMISSIONS.PAGE_SETTINGS)
  }, [hasPermission])

  const canAccessAnalysis = useCallback((): boolean => {
    return hasPermission(PERMISSIONS.PAGE_ANALYSIS)
  }, [hasPermission])

  // 向下兼容的别名方法
  const canManageUsers = canAccessUser
  const canManagePackages = canAccessPackage
  const canViewAnalysis = canAccessAnalysis
  const canManagePhones = canAccessPhone

  // 根据用户权限动态生成可访问的导航菜单
  const getAccessibleMenus = useCallback(() => {
    const menus: Array<{
      key: string
      path: string
      label: string
      icon: string
    }> = []

    // 仪表盘 - 所有用户都可以访问
    if (isAuthenticated) {
      menus.push({
        key: 'dashboard',
        path: '/dashboard',
        label: '仪表盘',
        icon: 'BarChart3'
      })
    }

    // 号码包管理
    if (canAccessPackage()) {
      menus.push({
        key: 'packages',
        path: '/packages',
        label: '号码包管理',
        icon: 'Package'
      })
    }

    // 数据分析
    if (canAccessAnalysis()) {
      menus.push({
        key: 'analysis',
        path: '/analysis',
        label: '数据分析',
        icon: 'TrendingUp'
      })
    }

    // 号码管理
    if (canAccessPhone()) {
      menus.push({
        key: 'phones',
        path: '/phones',
        label: '号码管理',
        icon: 'Phone'
      })
    }

    // 系统设置
    if (canAccessSettings()) {
      menus.push({
        key: 'settings',
        path: '/settings',
        label: '系统设置',
        icon: 'Settings'
      })
    }

    return menus
  }, [isAuthenticated, canAccessPackage, canAccessAnalysis, canAccessPhone, canAccessSettings, isAdmin])

  return {
    // 基础状态
    user,
    isAuthenticated,
    userPermissions,
    
    // 权限检查
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    
    // 角色检查
    isAdmin,
    isOperator,
    
    // 页面级权限检查
    canAccessPackage,
    canAccessPhone,
    canAccessUser,
    canAccessSettings,
    canAccessAnalysis,
    
    // 向下兼容的别名方法
    canManageUsers,
    canManagePackages,
    canViewAnalysis,
    canManagePhones,
    
    // 导航菜单
    getAccessibleMenus
  }
}

/**
 * 路由权限检查Hook
 * 用于检查当前路由是否有访问权限
 */
export const useRoutePermissions = (routePath: string) => {
  const {
    isAuthenticated,
    canAccessPackage,
    canAccessPhone,
    canAccessUser,
    canAccessSettings,
    canAccessAnalysis,
    isAdmin
  } = usePermissions()

  // 检查当前路由是否有权限访问
  const hasRouteAccess = useCallback((): boolean => {
    switch (routePath) {
      case '/dashboard':
        return isAuthenticated
      case '/packages':
        return canAccessPackage()
      case '/analysis':
        return canAccessAnalysis()
      case '/phones':
        return canAccessPhone()
      case '/settings':
        return canAccessSettings() || canAccessUser() // 系统设置或用户管理权限
      case '/login':
        return true // 登录页面始终可访问
      default:
        // 未定义的路由，默认需要登录
        return isAuthenticated
    }
  }, [routePath, isAuthenticated, canAccessPackage, canAccessPhone, canAccessUser, canAccessSettings, canAccessAnalysis, isAdmin])

  // 获取重定向路径
  const getRedirectPath = useCallback((): string => {
    if (!isAuthenticated) {
      return '/login'
    }
    // 如果已登录但没有权限，重定向到仪表盘
    return '/dashboard'
  }, [isAuthenticated])

  return {
    hasRouteAccess,
    getRedirectPath
  }
}