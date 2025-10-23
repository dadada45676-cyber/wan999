import React, { useState } from 'react'
import { 
  X, 
  Eye, 
  EyeOff, 
  Lock, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react'
import { useAuthActions } from '../store/auth'
import { PasswordValidator } from '../utils/auth'
import { User } from '../types/auth'

interface ChangePasswordModalProps {
  isOpen: boolean
  isFirstLogin?: boolean
  onClose: () => void
  onSuccess?: () => void
  targetUser?: User | null // 目标用户，用于管理员重置密码
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  isFirstLogin = false,
  onClose,
  onSuccess,
  targetUser
}) => {
  const { changePassword } = useAuthActions()
  
  // 表单状态
  const [formData, setFormData] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // UI状态
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number
    feedback: string[]
  }>({ score: 0, feedback: [] })

  // 密码验证器
  const passwordValidator = new PasswordValidator()

  // 如果不是打开状态，不渲染
  if (!isOpen) return null

  // 处理输入变化
  const handleInputChange = (field: keyof PasswordForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }

    // 实时检查新密码强度
    if (field === 'newPassword') {
      const validation = passwordValidator.validatePassword(value)
      setPasswordStrength({
        score: validation.score,
        feedback: validation.feedback
      })
    }
  }

  // 切换密码显示状态
  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 当前密码验证（非首次登录且非管理员重置时需要）
    if (!isFirstLogin && !targetUser && !formData.currentPassword) {
      newErrors.currentPassword = '请输入当前密码'
    }

    // 新密码验证
    if (!formData.newPassword) {
      newErrors.newPassword = '请输入新密码'
    } else {
      const validation = passwordValidator.validatePassword(formData.newPassword)
      if (!validation.isValid) {
        newErrors.newPassword = validation.feedback[0] || '密码不符合要求'
      }
    }

    // 确认密码验证
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认新密码'
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }

    // 检查新密码是否与当前密码相同（仅在非管理员重置时检查）
    if (!isFirstLogin && !targetUser && formData.currentPassword && formData.newPassword && 
        formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = '新密码不能与当前密码相同'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const result = await changePassword({
        currentPassword: isFirstLogin || targetUser ? '' : formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
        isFirstLogin,
        targetUserId: targetUser?.id
      })

      if (result.success) {
        // 重置表单
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
        setErrors({})
        setPasswordStrength({ score: 0, feedback: [] })
        
        // 调用成功回调
        onSuccess?.()
        
        // 关闭模态框
        onClose()
      } else {
        setErrors({ submit: result.error || '密码修改失败' })
      }
    } catch (error) {
      // 密码修改失败
      setErrors({ submit: '密码修改失败，请重试' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 获取密码强度颜色
  const getStrengthColor = (score: number) => {
    if (score < 2) return 'bg-red-500'
    if (score < 3) return 'bg-yellow-500'
    if (score < 4) return 'bg-blue-500'
    return 'bg-green-500'
  }

  // 获取密码强度文本
  const getStrengthText = (score: number) => {
    if (score < 2) return '弱'
    if (score < 3) return '中等'
    if (score < 4) return '强'
    return '很强'
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      {/* 模态框内容 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
          {/* 头部 */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {isFirstLogin ? '首次登录设置密码' : targetUser ? '重置用户密码' : '修改密码'}
                  </h2>
                  <p className="text-sm text-blue-100">
                    {isFirstLogin 
                      ? '为了账户安全，请设置新密码' 
                      : targetUser 
                      ? `为用户 "${targetUser.name}" 设置新密码`
                      : '请输入当前密码和新密码'
                    }
                  </p>
                </div>
              </div>
              {!isFirstLogin && onClose && (
                <button
                  onClick={onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* 表单内容 */}
          <div className="p-6">
            {/* 首次登录或管理员重置提示 */}
            {(isFirstLogin || targetUser) && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 mb-1">
                      {isFirstLogin ? '安全提醒' : '管理员操作'}
                    </p>
                    <p className="text-amber-700">
                      {isFirstLogin 
                        ? '这是您首次登录系统，为了账户安全，请立即设置一个强密码。'
                        : `您正在为用户 "${targetUser?.name}" 重置密码，请设置一个安全的新密码。`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-800">{errors.submit}</span>
              </div>
            )}

            {/* 密码修改表单 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 当前密码 - 非首次登录且非管理员重置时显示 */}
              {!isFirstLogin && !targetUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={formData.currentPassword}
                      onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                      className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                        errors.currentPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="请输入当前密码"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('current')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      disabled={isSubmitting}
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.currentPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>
                  )}
                </div>
              )}

              {/* 新密码 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  新密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.newPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="请输入新密码"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isSubmitting}
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* 密码强度指示器 */}
                {formData.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs text-gray-600">密码强度:</span>
                      <span className={`text-xs font-medium ${
                        passwordStrength.score < 2 ? 'text-red-600' :
                        passwordStrength.score < 3 ? 'text-yellow-600' :
                        passwordStrength.score < 4 ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {getStrengthText(passwordStrength.score)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(passwordStrength.score)}`}
                        style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                      />
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <div className="mt-1 text-xs text-gray-600">
                        {passwordStrength.feedback.map((feedback, index) => (
                          <div key={index}>• {feedback}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {errors.newPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
                )}
              </div>

              {/* 确认新密码 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  确认新密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`w-full pl-10 pr-10 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="请再次输入新密码"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={isSubmitting}
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              {/* 密码要求说明 */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">密码要求：</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• 至少8个字符</li>
                  <li>• 包含大写字母、小写字母</li>
                  <li>• 包含数字</li>
                  <li>• 包含特殊字符 (!@#$%^&*)</li>
                </ul>
              </div>

              {/* 提交按钮 */}
              <div className="flex space-x-3 pt-4">
                {!isFirstLogin && (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    取消
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || passwordStrength.score < 2}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>修改中...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>{isFirstLogin ? '设置密码' : '修改密码'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChangePasswordModal