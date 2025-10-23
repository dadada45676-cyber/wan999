import React, { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Shield, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useAuth, useAuthActions } from '../store/auth'
import { LoginForm } from '../types/auth'
import { PasswordValidator } from '../utils/auth'
import { AuthService } from '../services/auth'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, error, requiresCaptcha } = useAuth()
  const { login, clearError } = useAuthActions()

  // 表单状态
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
    rememberMe: false,
    captcha: ''
  })

  // UI状态
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [captchaCode, setCaptchaCode] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  
  // 网络诊断状态
  const [showNetworkDiagnostics, setShowNetworkDiagnostics] = useState(false)
  const [networkDiagnostics, setNetworkDiagnostics] = useState<any>(null)
  const [isDiagnosing, setIsDiagnosing] = useState(false)

  // 如果已登录，重定向到仪表盘
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // 生成验证码
  const generateCaptcha = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCaptchaCode(result)
  }

  // 初始化验证码
  useEffect(() => {
    if (requiresCaptcha) {
      generateCaptcha()
    }
  }, [requiresCaptcha])

  // 清除错误信息
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  // 表单验证
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // 邮箱验证
    if (!formData.email) {
      errors.email = '请输入邮箱地址'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '请输入有效的邮箱地址'
    }

    // 密码验证
    if (!formData.password) {
      errors.password = '请输入密码'
    } else if (formData.password.length < 6) {
      errors.password = '密码长度至少6位'
    }

    // 验证码验证
    if (requiresCaptcha) {
      if (!formData.captcha) {
        errors.captcha = '请输入验证码'
      } else if (formData.captcha.toUpperCase() !== captchaCode) {
        errors.captcha = '验证码错误'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await login(formData)
      
      if (response.success) {
        setShowSuccess(true)
        
        // 等待状态更新完成后再跳转
        setTimeout(() => {
          navigate('/dashboard', { replace: true })
        }, 1200) // 稍微延长等待时间确保状态更新完成
      } else {
        // 如果需要验证码，重新生成
        if (response.requiresCaptcha) {
          generateCaptcha()
          setFormData(prev => ({ ...prev, captcha: '' }))
        }
      }
    } catch (err) {
      // 登录失败
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理输入变化
  const handleInputChange = (field: keyof LoginForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 清除对应字段的验证错误
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  // 网络诊断
  const handleNetworkDiagnostics = async () => {
    setIsDiagnosing(true)
    setShowNetworkDiagnostics(true)
    
    try {
      const diagnostics = await AuthService.diagnoseNetworkConnection()
      setNetworkDiagnostics(diagnostics)
    } catch (error) {
      setNetworkDiagnostics({
        success: false,
        details: {
          internetConnection: false,
          supabaseReachable: false,
          dnsResolution: false,
          corsIssue: false
        },
        message: `诊断失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    } finally {
      setIsDiagnosing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 登录卡片 */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* 头部 */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">SMS营销数据分析系统</h1>
            <p className="text-blue-100">请登录您的账号</p>
          </div>

          {/* 表单内容 */}
          <div className="p-8">
            {/* 成功提示 */}
            {showSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">登录成功，正在跳转...</span>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-800 font-medium">登录失败</span>
                </div>
                <div className="text-red-700 text-sm whitespace-pre-line mb-3">
                  {error}
                </div>
                {/* 网络诊断按钮 */}
                {(error.includes('Failed to fetch') || error.includes('网络连接失败')) && (
                  <button
                    type="button"
                    onClick={handleNetworkDiagnostics}
                    disabled={isDiagnosing}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isDiagnosing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                    {isDiagnosing ? '诊断中...' : '网络诊断'}
                  </button>
                )}
              </div>
            )}

            {/* 网络诊断结果 */}
            {showNetworkDiagnostics && networkDiagnostics && (
              <div className={`mb-6 p-4 border rounded-lg ${
                networkDiagnostics.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {networkDiagnostics.success ? (
                    <Wifi className="w-5 h-5 text-green-600" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className={`font-medium ${
                    networkDiagnostics.success ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    网络诊断结果
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNetworkDiagnostics(false)}
                    className="ml-auto text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
                <div className={`text-sm whitespace-pre-line ${
                  networkDiagnostics.success ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  {networkDiagnostics.message}
                </div>
              </div>
            )}

            {/* 登录表单 */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 邮箱输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱地址
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      validationErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="请输入邮箱地址"
                    disabled={isSubmitting || showSuccess}
                  />
                </div>
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                )}
              </div>

              {/* 密码输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      validationErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="请输入密码"
                    disabled={isSubmitting || showSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isSubmitting || showSuccess}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {validationErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                )}
              </div>

              {/* 验证码 */}
              {requiresCaptcha && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    验证码
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.captcha}
                        onChange={(e) => handleInputChange('captcha', e.target.value.toUpperCase())}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                          validationErrors.captcha ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="请输入验证码"
                        maxLength={4}
                        disabled={isSubmitting || showSuccess}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 font-mono text-lg font-bold text-gray-700 select-none">
                        {captchaCode}
                      </div>
                      <button
                        type="button"
                        onClick={generateCaptcha}
                        className="p-3 text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={isSubmitting || showSuccess}
                        title="刷新验证码"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  {validationErrors.captcha && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.captcha}</p>
                  )}
                </div>
              )}

              {/* 记住登录 */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={isSubmitting || showSuccess}
                  />
                  <span className="ml-2 text-sm text-gray-600">记住登录状态</span>
                </label>
                
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  disabled={isSubmitting || showSuccess}
                >
                  忘记密码？
                </button>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={isSubmitting || showSuccess}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    登录中...
                  </>
                ) : showSuccess ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    登录成功
                  </>
                ) : (
                  '登录'
                )}
              </button>
            </form>


          </div>
        </div>

        {/* 底部信息 */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2024 SMS营销数据分析系统. 保留所有权利.</p>
          <p className="mt-1">适用于5人高效小团队的专业数据分析平台</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage