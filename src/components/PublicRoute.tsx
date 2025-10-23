import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

interface PublicRouteProps {
  children: React.ReactNode
}

/**
 * 公共路由组件
 * 用于保护只有未登录用户才能访问的页面（如登录页）
 * 如果用户已登录，则重定向到主页
 */
const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  // 如果正在加载认证状态，显示加载指示器
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    )
  }

  // 如果已登录，重定向到主页
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // 如果未登录，显示子组件（通常是登录页）
  return <>{children}</>
}

export default PublicRoute