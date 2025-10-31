import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Building, Shield } from 'lucide-react';
import { UserRole, UserStatus, User as UserType, EditUserForm as EditUserFormData } from '../types/auth';
import { isValidEmail, validateUserName } from '../utils/validators';

interface EditUserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: EditUserFormData) => Promise<void>;
  formData: EditUserFormData;
  setFormData: React.Dispatch<React.SetStateAction<EditUserFormData>>;
  user: UserType | null;
}

const EditUserForm: React.FC<EditUserFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  user
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<EditUserFormData>>({});

  // 当用户数据变化时，更新表单数据
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || '',
        phone: user.phone || '',
        status: user.status
      });
      setErrors({});
    }
  }, [user, isOpen, setFormData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<EditUserFormData> = {};

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
      setErrors({});
    } catch (error) {
      // 更新用户失败
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof EditUserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg mr-3">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">编辑用户</h2>
              <p className="text-sm text-gray-500">修改用户 "{user.name}" 的信息</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <User className="h-4 w-4 mr-2 text-blue-600" />
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
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
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
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="请输入邮箱地址"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          {/* 角色和权限 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <Shield className="h-4 w-4 mr-2 text-blue-600" />
              角色权限
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户角色 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="active">正常</option>
                <option value="locked">锁定</option>
                <option value="inactive">停用</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.status === 'active' && '用户可以正常登录和使用系统'}
                {formData.status === 'locked' && '用户被锁定，无法登录系统'}
                {formData.status === 'inactive' && '用户被停用，无法登录系统'}
              </p>
            </div>
          </div>

          {/* 联系信息 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 flex items-center">
              <Building className="h-4 w-4 mr-2 text-blue-600" />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="请输入联系电话"
                />
              </div>
            </div>
          </div>

          {/* 用户信息 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">用户信息</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">用户ID:</span>
                <span className="ml-2 font-mono text-gray-900">{user.id}</span>
              </div>
              <div>
                <span className="text-gray-500">创建时间:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">最后登录:</span>
                <span className="ml-2 text-gray-900">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '从未登录'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">登录次数:</span>
                <span className="ml-2 text-gray-900">{user.loginCount || 0} 次</span>
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
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserForm;