import React, { useState } from 'react';
import { X, User, Mail, Phone, Building, Shield, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { UserRole, UserStatus, CreateUserForm as CreateUserFormData } from '../types/auth';
import { isValidEmail, validatePassword, validateUserName } from '../utils/validators';

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

    // 验证用户名
    const nameValidation = validateUserName(formData.name);
    if (!nameValidation.isValid) {
      newErrors.name = nameValidation.error;
    }

    // 验证邮箱
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    // 验证密码
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0];
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

        {/* 用户创建说明 */}
        <div className="mx-6 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-emerald-800">
                完整用户创建
              </h3>
              <div className="mt-2 text-sm text-emerald-700">
                <p>创建的用户将拥有完整的登录认证功能，可以立即使用设置的密码登录系统。用户首次登录时需要修改密码。</p>
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