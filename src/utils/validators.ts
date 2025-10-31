/**
 * 通用验证工具函数
 * 统一项目中的数据验证逻辑，避免重复代码
 */

/**
 * 邮箱格式验证
 * @param email 邮箱地址
 * @returns 是否为有效邮箱格式
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * 密码强度验证
 * @param password 密码
 * @param minLength 最小长度，默认8位
 * @returns 验证结果
 */
export const validatePassword = (password: string, minLength: number = 8): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  
  if (!password.trim()) {
    errors.push('请输入密码')
  } else {
    if (password.length < minLength) {
      errors.push(`密码长度至少${minLength}位`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 手机号格式验证
 * @param phone 手机号
 * @returns 是否为有效手机号格式
 */
export const isValidPhone = (phone: string): boolean => {
  // 中国手机号格式验证
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone.trim())
}

/**
 * 用户名验证
 * @param name 用户名
 * @param minLength 最小长度，默认2位
 * @param maxLength 最大长度，默认20位
 * @returns 验证结果
 */
export const validateUserName = (name: string, minLength: number = 2, maxLength: number = 20): {
  isValid: boolean
  error?: string
} => {
  const trimmedName = name.trim()
  
  if (!trimmedName) {
    return { isValid: false, error: '请输入用户姓名' }
  }
  
  if (trimmedName.length < minLength) {
    return { isValid: false, error: `用户姓名至少${minLength}个字符` }
  }
  
  if (trimmedName.length > maxLength) {
    return { isValid: false, error: `用户姓名不能超过${maxLength}个字符` }
  }
  
  return { isValid: true }
}

/**
 * 必填字段验证
 * @param value 字段值
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export const validateRequired = (value: string, fieldName: string): {
  isValid: boolean
  error?: string
} => {
  if (!value.trim()) {
    return { isValid: false, error: `请输入${fieldName}` }
  }
  return { isValid: true }
}

/**
 * 数字范围验证
 * @param value 数值
 * @param min 最小值
 * @param max 最大值
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export const validateNumberRange = (
  value: number, 
  min: number, 
  max: number, 
  fieldName: string
): {
  isValid: boolean
  error?: string
} => {
  if (isNaN(value)) {
    return { isValid: false, error: `${fieldName}必须是数字` }
  }
  
  if (value < min || value > max) {
    return { isValid: false, error: `${fieldName}必须在${min}-${max}之间` }
  }
  
  return { isValid: true }
}

/**
 * 文件类型验证
 * @param file 文件对象
 * @param allowedTypes 允许的文件类型
 * @returns 验证结果
 */
export const validateFileType = (file: File, allowedTypes: string[]): {
  isValid: boolean
  error?: string
} => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  
  if (!fileExtension || !allowedTypes.includes(fileExtension)) {
    return { 
      isValid: false, 
      error: `只支持${allowedTypes.join('、')}格式的文件` 
    }
  }
  
  return { isValid: true }
}

/**
 * 文件大小验证
 * @param file 文件对象
 * @param maxSizeMB 最大文件大小（MB）
 * @returns 验证结果
 */
export const validateFileSize = (file: File, maxSizeMB: number): {
  isValid: boolean
  error?: string
} => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  
  if (file.size > maxSizeBytes) {
    return { 
      isValid: false, 
      error: `文件大小不能超过${maxSizeMB}MB` 
    }
  }
  
  return { isValid: true }
}