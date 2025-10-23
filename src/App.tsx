import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import PackageManagement from './pages/PackageManagement'
import DataAnalysis from './pages/DataAnalysis'
import PhoneManagement from './pages/PhoneManagement'
import ReportCenter from './pages/ReportCenter'
import SystemSettings from './pages/SystemSettings'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import ChangePasswordModal from './components/ChangePasswordModal'
import { useAuth, useAuthActions } from './store/auth'
import { APIService } from './services/api'
import { log } from './utils/logger'

interface InitializationStatus {
  status: 'loading' | 'success' | 'error' | 'retry'
  message?: string
  details?: string[]
  retryCount?: number
}

function App() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { checkAuth } = useAuthActions()
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [initializationStatus, setInitializationStatus] = useState<InitializationStatus>({ 
    status: 'loading',
    retryCount: 0
  })

  // 系统初始化函数
  const initializeSystem = async (isRetry = false) => {
    try {
      if (isRetry) {
        setInitializationStatus(prev => ({ 
          ...prev, 
          status: 'loading',
          retryCount: (prev.retryCount || 0) + 1
        }))
      } else {
        setInitializationStatus({ status: 'loading', retryCount: 0 })
      }
      
      log.info('开始系统初始化...', undefined, 'App')
      const result = await APIService.initializeApp()
      
      if (result.success) {
        setInitializationStatus({ 
          status: 'success',
          message: `系统初始化完成 (耗时: ${result.duration}ms)`
        })
        
        log.info(`系统初始化成功，耗时: ${result.duration}ms`, undefined, 'App')
        
        // 检查认证状态
        await checkAuth()
      } else {
        setInitializationStatus({ 
          status: 'error',
          message: '系统初始化失败',
          details: result.errors
        })
        
        log.error('系统初始化失败', result.errors, 'App')
        
        // 即使初始化失败，也尝试检查认证状态
        try {
          await checkAuth()
        } catch (authError) {
          log.warn('认证检查失败', authError, 'App')
        }
      }
      
      // 记录警告信息
      if (result.warnings.length > 0) {
        log.warn('系统初始化警告', result.warnings, 'App')
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      setInitializationStatus({ 
        status: 'error',
        message: '系统初始化异常',
        details: [errorMessage]
      })
      
      log.error('系统初始化异常', error, 'App')
      
      // 即使异常，也尝试检查认证状态
      try {
        await checkAuth()
      } catch (authError) {
        log.warn('认证检查失败', authError, 'App')
      }
    }
  }

  // 系统初始化
  useEffect(() => {
    initializeSystem()
  }, [])

  // 检查是否需要显示首次登录密码修改模态框
  useEffect(() => {
    if (isAuthenticated && user?.isFirstLogin) {
      setShowChangePasswordModal(true)
    }
  }, [isAuthenticated, user?.isFirstLogin])

  // 重试初始化
  const handleRetryInitialization = () => {
    initializeSystem(true)
  }

  // 系统加载中显示
  if (isLoading || initializationStatus.status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 bg-blue-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {initializationStatus.status === 'loading' ? 
              (initializationStatus.retryCount && initializationStatus.retryCount > 0 ? 
                `重新初始化中... (第${initializationStatus.retryCount}次尝试)` : 
                '系统初始化中...'
              ) : 
              '系统加载中...'
            }
          </h2>
          <p className="text-gray-600">
            {initializationStatus.message || '请稍候，正在加载系统配置和服务'}
          </p>
        </div>
      </div>
    )
  }

  // 初始化失败显示
  if (initializationStatus.status === 'error') {
    const canRetry = (initializationStatus.retryCount || 0) < 3
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {initializationStatus.message}
          </h2>
          <p className="text-gray-600 mb-4">
            {canRetry ? 
              '系统可能暂时无法正常工作，您可以尝试重新初始化' : 
              '多次初始化失败，请联系系统管理员'
            }
          </p>
          
          {initializationStatus.details && initializationStatus.details.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
              <p className="text-sm font-medium text-red-800 mb-2">错误详情：</p>
              <ul className="text-sm text-red-700 space-y-1">
                {initializationStatus.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex gap-3 justify-center">
            {canRetry && (
              <button
                onClick={handleRetryInitialization}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                重新初始化 ({3 - (initializationStatus.retryCount || 0)} 次机会)
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              刷新页面
            </button>
          </div>
          
          {!canRetry && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                如果问题持续存在，请联系技术支持或检查网络连接
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        {/* 根路径重定向 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 公共路由 - 登录页面 */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />

        {/* 受保护的路由 - 需要认证 */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/packages" 
          element={
            <ProtectedRoute>
              <Layout>
                <PackageManagement />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/analysis" 
          element={
            <ProtectedRoute>
              <Layout>
                <DataAnalysis />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/phones" 
          element={
            <ProtectedRoute>
              <Layout>
                <PhoneManagement />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute>
              <Layout>
                <ReportCenter />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Layout>
                <SystemSettings />
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        {/* 404 页面 */}
        <Route 
          path="*" 
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">页面未找到</h2>
                <p className="text-gray-600 mb-6">抱歉，您访问的页面不存在。</p>
                <button
                  onClick={() => window.history.back()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  返回上一页
                </button>
              </div>
            </div>
          } 
        />
      </Routes>

      {/* 首次登录密码修改模态框 */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        isFirstLogin={true}
        onClose={() => {}} // 首次登录不允许关闭
        onSuccess={() => {
          setShowChangePasswordModal(false)
        }}
      />
    </Router>
  )
}

export default App
