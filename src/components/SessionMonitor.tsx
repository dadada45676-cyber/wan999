// 会话监控组件 - 处理会话超时警告和自动登出

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Clock, RefreshCw, LogOut } from 'lucide-react'
import { useAuth, useAuthActions } from '../store/auth'
import { SessionManager } from '../utils/auth'
import { SECURITY_CONFIG } from '../types/auth'

interface SessionWarningModalProps {
  isOpen: boolean
  remainingTime: number
  onExtend: () => void
  onLogout: () => void
}

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  isOpen,
  remainingTime,
  onExtend,
  onLogout
}) => {
  const minutes = Math.floor(remainingTime / 60)
  const seconds = remainingTime % 60

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">会话即将过期</h3>
              <p className="text-sm text-gray-600">您的登录会话即将过期</p>
            </div>
          </div>

          {/* 倒计时 */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">剩余时间</span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
          </div>

          {/* 说明 */}
          <p className="text-sm text-gray-600 mb-6">
            为了保护您的账号安全，系统将在倒计时结束后自动登出。
            您可以选择延长会话或立即登出。
          </p>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onExtend}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              延长会话
            </button>
            <button
              onClick={onLogout}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              立即登出
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const SessionMonitor: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const { logout } = useAuthActions()
  
  const [showWarning, setShowWarning] = useState(false)
  const [remainingTime, setRemainingTime] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    // 初始化会话监控
    SessionManager.initializeSessionMonitoring()

    // 设置会话超时回调
    SessionManager.setTimeoutCallback(() => {
      setShowWarning(false)
      logout()
    })

    // 设置会话警告回调
    SessionManager.setWarningCallback((timeLeft: number) => {
      setRemainingTime(Math.floor(timeLeft / 1000))
      setShowWarning(true)
    })

    // 定期检查会话状态
    const checkInterval = setInterval(() => {
      if (SessionManager.isSessionExpired()) {
        logout()
        return
      }

      const timeUntilWarning = SessionManager.getTimeUntilWarning()
      if (timeUntilWarning <= 0 && timeUntilWarning > -SECURITY_CONFIG.SESSION_WARNING_TIME) {
        const timeUntilExpiry = SessionManager.getTimeUntilExpiry()
        if (timeUntilExpiry > 0) {
          setRemainingTime(Math.floor(timeUntilExpiry / 1000))
          setShowWarning(true)
        }
      }
    }, 1000)

    // 倒计时更新
    let countdownInterval: NodeJS.Timeout | null = null
    if (showWarning) {
      countdownInterval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            setShowWarning(false)
            logout()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      clearInterval(checkInterval)
      if (countdownInterval) {
        clearInterval(countdownInterval)
      }
    }
  }, [isAuthenticated, logout, showWarning])

  // 延长会话
  const handleExtendSession = () => {
    SessionManager.extendSession()
    setShowWarning(false)
    setRemainingTime(0)
  }

  // 立即登出
  const handleLogout = () => {
    setShowWarning(false)
    logout()
  }

  return (
    <SessionWarningModal
      isOpen={showWarning}
      remainingTime={remainingTime}
      onExtend={handleExtendSession}
      onLogout={handleLogout}
    />
  )
}

export default SessionMonitor