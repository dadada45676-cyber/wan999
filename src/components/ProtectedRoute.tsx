import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2, Shield, AlertTriangle } from 'lucide-react'
import { useAuth, useAuthActions } from '../store/auth'
import { useRoutePermissions } from '../hooks/usePermissions'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  fallbackPath?: string
}

/**
 * 路由保护组件
 * 检查用户认证状态和权限，控制页面访问
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  fallbackPath = '/dashboard'
}) => {
  const location = useLocation()
  const { isAuthenticated, isLoading, user } = useAuth()
  const { checkAuth } = useAuthActions()
  const { hasRouteAccess, getRedirectPath } = useRoutePermissions(location.pathname)

  // 检查认证状态
  useEffect(() => {
    // 只有在未认证且未加载时才检查认证状态
    if (!isAuthenticated && !isLoading) {
      checkAuth()
    }
  }, [isAuthenticated, isLoading, checkAuth])

  // 加载中状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">正在验证身份...</h2>
          <p className="text-gray-600">请稍候，系统正在检查您的登录状态</p>
        </div>
      </div>
    )
  }

  // 未认证用户重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 检查路由访问权限
  if (!hasRouteAccess()) {
    const redirectPath = getRedirectPath()
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">访问受限</h2>
            <p className="text-gray-600 mb-6">
              抱歉，您没有权限访问此页面。请联系管理员获取相应权限。
            </p>
            <div className="space-y-3">
              <button
                onClick={() => window.history.back()}
                className="w-full px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                返回上一页
              </button>
              <Navigate to={redirectPath} replace />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 检查特定权限要求
  if (requiredPermissions.length > 0 && user) {
    const hasRequiredPermissions = requiredPermissions.every(permission => {
      // 这里可以添加更复杂的权限检查逻辑
      return true // 暂时返回true，具体权限检查在各个页面组件中实现
    })

    if (!hasRequiredPermissions) {
      return <Navigate to={fallbackPath} replace />
    }
  }

  // 权限验证通过，渲染子组件
  return <>{children}</>
}

/**
 * 管理员路由保护组件
 * 只允许管理员访问
 */
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">管理员权限要求</h2>
            <p className="text-gray-600 mb-6">
              此页面仅限管理员访问。如需访问权限，请联系系统管理员。
            </p>
            <Navigate to="/dashboard" replace />
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * 公共路由组件
 * 用于不需要认证的页面（如登录页）
 */
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth()

  // 如果已登录，重定向到仪表盘
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute