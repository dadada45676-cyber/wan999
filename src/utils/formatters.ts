/**
 * 通用格式化工具函数
 * 统一项目中的数据格式化逻辑，避免重复代码
 */

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化日期时间
 * @param date 日期对象、时间戳或日期字符串
 * @param options 格式化选项
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTime = (
  date: Date | number | string, 
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  
  // 默认使用中文本地化格式
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options
  }
  
  return dateObj.toLocaleString('zh-CN', defaultOptions)
}

/**
 * 格式化数字（添加千分位分隔符）
 * @param num 数字
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (num: number | string): string => {
  const numValue = typeof num === 'string' ? parseFloat(num) : num
  return numValue.toLocaleString('zh-CN')
}

/**
 * 格式化百分比
 * @param value 数值
 * @param total 总数
 * @param decimals 小数位数，默认1位
 * @returns 格式化后的百分比字符串
 */
export const formatPercentage = (value: number, total: number, decimals: number = 1): string => {
  if (total === 0) return '0%'
  const percentage = (value / total) * 100
  return `${percentage.toFixed(decimals)}%`
}

/**
 * 格式化相对时间（如：2小时前、3天前）
 * @param date 日期对象、时间戳或日期字符串
 * @returns 相对时间字符串
 */
export const formatRelativeTime = (date: Date | number | string): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  
  // 超过7天显示具体日期
  return formatDateTime(dateObj, { month: 'short', day: 'numeric' })
}

/**
 * 格式化状态文本
 * @param status 状态值
 * @param statusMap 状态映射表
 * @returns 格式化后的状态文本
 */
export const formatStatus = (status: string, statusMap: Record<string, string>): string => {
  return statusMap[status] || status
}