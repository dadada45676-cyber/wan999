// 统一的颜色编码系统
// 确保颜色使用一致且有意义

// 主色调系统
export const primaryColors = {
  // 品牌主色
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe', 
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',  // 主色
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e'
  },
  
  // 辅助色
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0', 
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',  // 辅助色
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a'
  }
}

// 状态颜色系统
export const statusColors = {
  // 成功状态
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white'
  },
  
  // 警告状态
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700', 
    border: 'border-amber-200',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    button: 'bg-amber-600 hover:bg-amber-700 text-white'
  },
  
  // 错误状态
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200', 
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-800 border-red-200',
    button: 'bg-red-600 hover:bg-red-700 text-white'
  },
  
  // 信息状态
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: 'text-blue-600', 
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700 text-white'
  },
  
  // 处理中状态
  processing: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    icon: 'text-indigo-600',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white'
  },
  
  // 待处理状态
  pending: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    icon: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-800 border-gray-200',
    button: 'bg-gray-600 hover:bg-gray-700 text-white'
  }
}

// 等级颜色系统
export const gradeColors = {
  S: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    gradient: 'bg-gradient-to-r from-purple-500 to-purple-600'
  },
  A: {
    bg: 'bg-emerald-50', 
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    gradient: 'bg-gradient-to-r from-emerald-500 to-emerald-600'
  },
  B: {
    bg: 'bg-blue-50',
    text: 'text-blue-700', 
    border: 'border-blue-200',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    gradient: 'bg-gradient-to-r from-blue-500 to-blue-600'
  },
  C: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    gradient: 'bg-gradient-to-r from-yellow-500 to-yellow-600'
  },
  D: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200', 
    icon: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    gradient: 'bg-gradient-to-r from-orange-500 to-orange-600'
  },
  E: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-800 border-red-200',
    gradient: 'bg-gradient-to-r from-red-500 to-red-600'
  }
}

// 优先级颜色系统
export const priorityColors = {
  high: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-800 border-red-200'
  },
  medium: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  low: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: 'text-green-600',
    badge: 'bg-green-100 text-green-800 border-green-200'
  }
}

// 常用颜色常量
export const commonColors = {
  // 等级颜色
  grades: {
    SS: '#dc2626',
    S: '#ea580c', 
    A: '#10b981',
    B: '#3b82f6',
    C: '#f59e0b',
    D: '#ef4444',
    E: '#6b7280'
  },
  
  // 系统主色调
  system: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    gray: '#6b7280'
  },

  // 图表边框和网格
  chart: {
    grid: '#e2e8f0',
    axis: '#64748b',
    border: '#e2e8f0'
  }
}

// 数据可视化颜色系统
export const chartColors = {
  // 主要图表颜色
  primary: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
  
  // 渐变色
  gradients: {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600', 
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-purple-600'
  },
  
  // 背景色
  backgrounds: {
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    green: 'bg-green-50', 
    yellow: 'bg-yellow-50',
    red: 'bg-red-50',
    gray: 'bg-gray-50'
  }
}

// 语义化颜色函数
export const getStatusColor = (status: string) => {
  const statusMap: Record<string, keyof typeof statusColors> = {
    'completed': 'success',
    'success': 'success',
    'active': 'success',
    'warning': 'warning',
    'pending': 'warning',
    'error': 'error',
    'failed': 'error',
    'info': 'info',
    'processing': 'processing',
    'generating': 'processing'
  }
  
  return statusColors[statusMap[status] || 'pending']
}

export const getGradeColor = (grade: string) => {
  return gradeColors[grade as keyof typeof gradeColors] || gradeColors.E
}

export const getPriorityColor = (priority: string) => {
  return priorityColors[priority as keyof typeof priorityColors] || priorityColors.low
}

// 颜色工具函数
export const colorUtils = {
  // 获取对比色
  getContrastColor: (bgColor: string) => {
    // 简单的对比色逻辑
    const lightColors = ['50', '100', '200', '300']
    const isLight = lightColors.some(shade => bgColor.includes(shade))
    return isLight ? 'text-gray-900' : 'text-white'
  },
  
  // 获取hover状态颜色
  getHoverColor: (baseColor: string) => {
    return baseColor.replace(/-(50|100|200|300|400|500|600|700|800|900)/, (match, shade) => {
      const shadeNum = parseInt(shade)
      const newShade = Math.min(shadeNum + 100, 900)
      return `-${newShade}`
    })
  },
  
  // 获取淡化颜色
  getLightColor: (baseColor: string) => {
    return baseColor.replace(/-(50|100|200|300|400|500|600|700|800|900)/, '-50')
  }
}