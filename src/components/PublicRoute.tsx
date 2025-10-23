import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { Loader2 } from 'lucide-react'

interface PublicRouteProps {
  children: React.ReactNode
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  // 如果已认证，重定向到仪表板
  if (isAuthenticated && user) {
    return <Navigate to="/dashboard" replace />
  }

  // 如果未认证，显示子组件
  return <>{children}</>
}

export default PublicRoute