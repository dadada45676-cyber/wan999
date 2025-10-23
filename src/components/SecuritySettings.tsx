// 安全设置组件 - 显示安全统计和管理安全策略

import React, { useState, useEffect } from 'react'
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Clock,
  Globe,
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { SecurityManager } from '../utils/securityManager'
import { SECURITY_CONFIG } from '../types/auth'

interface SecurityStatsCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color: 'green' | 'yellow' | 'red' | 'blue'
  trend?: 'up' | 'down' | 'stable'
}

const SecurityStatsCard: React.FC<SecurityStatsCardProps> = ({ 
  title, 
  value, 
  icon, 
  color, 
  trend 
}) => {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const iconColorClasses = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    blue: 'text-blue-600'
  }

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <div className="flex items-center">
                {trend === 'up' && <TrendingUp className="w-4 h-4 text-red-500" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4 text-green-500" />}
                {trend === 'stable' && <Activity className="w-4 h-4 text-gray-500" />}
              </div>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-full bg-white/50 ${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

interface LoginAttemptRowProps {
  attempt: {
    email: string
    ip: string
    timestamp: number
    success: boolean
    userAgent?: string
  }
}

const LoginAttemptRow: React.FC<LoginAttemptRowProps> = ({ attempt }) => {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${attempt.success ? 'bg-green-500' : 'bg-red-500'}`} />
          <div>
            <div className="font-medium text-gray-900">{attempt.email}</div>
            <div className="text-sm text-gray-500">
              {new Date(attempt.timestamp).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            attempt.success 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {attempt.success ? '成功' : '失败'}
          </span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600 space-y-1">
          <div><strong>IP地址:</strong> {attempt.ip}</div>
          {attempt.userAgent && (
            <div><strong>用户代理:</strong> {attempt.userAgent}</div>
          )}
        </div>
      )}
    </div>
  )
}

const SecuritySettings: React.FC = () => {
  const [securityStats, setSecurityStats] = useState({
    totalAttempts: 0,
    failedAttempts: 0,
    successfulAttempts: 0,
    lockedUsers: 0,
    lockedIPs: 0,
    recentAttempts: []
  })
  const [isLoading, setIsLoading] = useState(true)

  // 加载安全统计数据
  const loadSecurityStats = () => {
    setIsLoading(true)
    try {
      const stats = SecurityManager.getSecurityStats()
      setSecurityStats(stats)
    } catch (error) {
      // 加载安全统计失败
    } finally {
      setIsLoading(false)
    }
  }

  // 清理过期数据
  const handleCleanupData = () => {
    SecurityManager.cleanupExpiredData()
    loadSecurityStats()
  }

  useEffect(() => {
    loadSecurityStats()
    
    // 每30秒刷新一次数据
    const interval = setInterval(loadSecurityStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>加载安全数据中...</span>
        </div>
      </div>
    )
  }

  const successRate = securityStats.totalAttempts > 0 
    ? Math.round((securityStats.successfulAttempts / securityStats.totalAttempts) * 100)
    : 100

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">安全监控</h2>
          <p className="text-gray-600 mt-1">系统安全状态和登录活动监控</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSecurityStats}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新数据
          </button>
          <button
            onClick={handleCleanupData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Shield className="w-4 h-4" />
            清理过期数据
          </button>
        </div>
      </div>

      {/* 安全统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <SecurityStatsCard
          title="登录成功率"
          value={`${successRate}%`}
          icon={<CheckCircle className="w-6 h-6" />}
          color={successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red'}
          trend={successRate >= 90 ? 'stable' : 'down'}
        />
        
        <SecurityStatsCard
          title="今日登录尝试"
          value={securityStats.totalAttempts}
          icon={<Activity className="w-6 h-6" />}
          color="blue"
        />
        
        <SecurityStatsCard
          title="失败尝试"
          value={securityStats.failedAttempts}
          icon={<XCircle className="w-6 h-6" />}
          color={securityStats.failedAttempts > 10 ? 'red' : securityStats.failedAttempts > 5 ? 'yellow' : 'green'}
          trend={securityStats.failedAttempts > 10 ? 'up' : 'stable'}
        />
        
        <SecurityStatsCard
          title="锁定用户"
          value={securityStats.lockedUsers}
          icon={<Lock className="w-6 h-6" />}
          color={securityStats.lockedUsers > 0 ? 'red' : 'green'}
        />
        
        <SecurityStatsCard
          title="锁定IP"
          value={securityStats.lockedIPs}
          icon={<Globe className="w-6 h-6" />}
          color={securityStats.lockedIPs > 0 ? 'red' : 'green'}
        />
      </div>

      {/* 安全配置信息 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          安全策略配置
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">登录安全</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>最大登录尝试:</span>
                <span className="font-medium">{SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS}次</span>
              </div>
              <div className="flex justify-between">
                <span>锁定时长:</span>
                <span className="font-medium">{SECURITY_CONFIG.LOCKOUT_DURATION / 60000}分钟</span>
              </div>
              <div className="flex justify-between">
                <span>验证码阈值:</span>
                <span className="font-medium">{SECURITY_CONFIG.CAPTCHA_THRESHOLD}次</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">会话管理</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>会话超时:</span>
                <span className="font-medium">{SECURITY_CONFIG.SESSION_TIMEOUT / 60000}分钟</span>
              </div>
              <div className="flex justify-between">
                <span>Token有效期:</span>
                <span className="font-medium">{SECURITY_CONFIG.TOKEN_EXPIRY / 3600000}小时</span>
              </div>
              <div className="flex justify-between">
                <span>最大并发会话:</span>
                <span className="font-medium">{SECURITY_CONFIG.MAX_CONCURRENT_SESSIONS}个</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">密码策略</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>最小长度:</span>
                <span className="font-medium">{SECURITY_CONFIG.PASSWORD_MIN_LENGTH}位</span>
              </div>
              <div className="flex justify-between">
                <span>密码历史:</span>
                <span className="font-medium">{SECURITY_CONFIG.PASSWORD_HISTORY_COUNT}个</span>
              </div>
              <div className="flex justify-between">
                <span>密码过期:</span>
                <span className="font-medium">{SECURITY_CONFIG.PASSWORD_EXPIRY_DAYS}天</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 最近登录活动 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            最近登录活动
          </h3>
          <span className="text-sm text-gray-500">
            显示最近50次登录尝试
          </span>
        </div>
        
        {securityStats.recentAttempts.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {securityStats.recentAttempts.map((attempt, index) => (
              <LoginAttemptRow key={index} attempt={attempt} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无登录活动记录</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SecuritySettings