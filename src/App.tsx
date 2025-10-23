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

function App() {
  const { isAuthenticated, user, isLoading } = useAuth()
  const { checkAuth } = useAuthActions()
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)

  // 检查认证状态
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // 检查是否需要显示首次登录密码修改模态框
  useEffect(() => {
    if (isAuthenticated && user?.isFirstLogin) {
      setShowChangePasswordModal(true)
    }
  }, [isAuthenticated, user?.isFirstLogin])

  // 认证加载中显示
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 bg-blue-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            系统加载中...
          </h2>
          <p className="text-gray-600">
            请稍候，正在验证用户身份
          </p>
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
