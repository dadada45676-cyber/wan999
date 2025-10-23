// 统一的表格样式配置
export const tableStyles = {
  // 表格容器
  container: "bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm overflow-hidden",
  
  // 表格本身
  table: "min-w-full divide-y divide-gray-200",
  
  // 表头
  thead: "bg-gradient-to-r from-gray-50/80 to-gray-100/80 backdrop-blur-sm",
  theadRow: "",
  th: "px-6 py-5 text-left text-sm font-semibold text-gray-700 tracking-wide border-b border-gray-200/70",
  
  // 表体
  tbody: "bg-white/50 backdrop-blur-sm divide-y divide-gray-100/60",
  tbodyRow: "group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-200 hover:shadow-sm",
  td: "px-6 py-5 whitespace-nowrap text-sm leading-relaxed",
  
  // 分页
  pagination: {
    container: "bg-white/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-t border-gray-200/50",
    info: "flex items-center space-x-2 text-sm text-gray-600",
    nav: "flex items-center space-x-2"
  },
  
  // 状态样式
  status: {
    completed: "text-green-600 bg-green-50 border-green-200",
    processing: "text-blue-600 bg-blue-50 border-blue-200", 
    failed: "text-red-600 bg-red-50 border-red-200",
    pending: "text-yellow-600 bg-yellow-50 border-yellow-200",
    active: "text-green-600 bg-green-50 border-green-200"
  },
  
  // 等级样式
  grade: {
    S: "text-purple-600 bg-purple-50 border-purple-200",
    A: "text-green-600 bg-green-50 border-green-200",
    B: "text-blue-600 bg-blue-50 border-blue-200",
    C: "text-yellow-600 bg-yellow-50 border-yellow-200",
    D: "text-orange-600 bg-orange-50 border-orange-200",
    E: "text-red-600 bg-red-50 border-red-200"
  },
  
  // 操作按钮
  actionButton: "p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200"
}

// 表格行高配置
export const tableRowHeights = {
  compact: "py-2.5",    // 紧凑模式：10px
  normal: "py-4",       // 正常模式：16px  
  comfortable: "py-5",  // 舒适模式：20px
  spacious: "py-6"      // 宽松模式：24px
}

// 表格文本样式
export const tableTextStyles = {
  primary: "text-sm font-medium text-gray-900 leading-relaxed",
  secondary: "text-sm text-gray-600 leading-relaxed",
  accent: "text-sm font-semibold text-indigo-600 leading-relaxed",
  muted: "text-xs text-gray-500 leading-relaxed",
  number: "text-sm font-mono text-gray-800 leading-relaxed",
  badge: "text-xs font-medium px-2.5 py-1 rounded-full border leading-tight"
}

// 表格图标样式
export const tableIconStyles = {
  small: "w-3 h-3",
  medium: "w-4 h-4", 
  large: "w-5 h-5"
}

// 表格密度配置
export const tableDensity = {
  compact: {
    th: "px-4 py-3 text-xs",
    td: "px-4 py-3 text-xs",
    container: "text-xs"
  },
  normal: {
    th: "px-6 py-4 text-sm",
    td: "px-6 py-4 text-sm", 
    container: "text-sm"
  },
  comfortable: {
    th: "px-6 py-5 text-sm",
    td: "px-6 py-5 text-sm",
    container: "text-sm"
  },
  spacious: {
    th: "px-8 py-6 text-base",
    td: "px-8 py-6 text-base",
    container: "text-base"
  }
}

// 表格边框样式
export const tableBorders = {
  none: "",
  light: "border border-gray-100",
  normal: "border border-gray-200", 
  strong: "border border-gray-300"
}