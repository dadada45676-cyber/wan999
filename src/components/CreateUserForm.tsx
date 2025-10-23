import React, { useState } from 'react';
import { X, User, Mail, Phone, Building, Shield, Eye, EyeOff } from 'lucide-react';
import { UserRole, UserStatus, CreateUserForm as CreateUserFormData } from '../types/auth';

interface CreateUserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: CreateUserFormData) => Promise<void>;
  formData: CreateUserFormData;
  setFormData: React.Dispatch<React.SetStateAction<CreateUserFormData>>;
}

const CreateUserForm: React.FC<CreateUserFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<CreateUserFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateUserFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入用户姓名';
    }

    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password.trim()) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 8) {
      newErrors.password = '密码长度至少8位';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // 重置表单
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'operator',
        department: '',
        phone: '',
        status: 'active',
        sendWelcomeEmail: false
      });
      setErrors({});
    } catch (error) {
      // 创建用户失败
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateUserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg mr-3">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">新增用户</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 临时解决方案提示 */}
        <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">
                临时用户创建模式
              </h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>当前创建的用户仅在系统中建立档案，需要管理员稍后为其设置登录认证。用户创建后将标记为"需要修改密码"状态。</p>
              </div>
            </div>
          </div>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <User className="h-4 w-4 mr-2 text-emerald-600" />
              基本信息
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="请输入用户姓名"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="请输入邮箱地址"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                初始密码 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="请输入初始密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                密码长度至少8位，用户首次登录时需要修改密码
              </p>
            </div>
          </div>

          {/* 角色和权限 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <Shield className="h-4 w-4 mr-2 text-emerald-600" />
              角色权限
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户角色 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              >
                <option value="operator">操作员</option>
                <option value="admin">管理员</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.role === 'admin' ? '管理员拥有系统完整权限' : '操作员仅拥有基础操作权限'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                账号状态
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value as UserStatus)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              >
                <option value="active">正常</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>

          {/* 联系信息 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <Building className="h-4 w-4 mr-2 text-emerald-600" />
              联系信息
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                部门
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="请输入部门名称"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                联系电话
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  placeholder="请输入联系电话"
                />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '创建中...' : '创建用户'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserForm;