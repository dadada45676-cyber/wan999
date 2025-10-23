import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  variant?: 'text' | 'rectangular' | 'circular'
  animation?: 'pulse' | 'wave' | 'none'
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
  variant = 'text',
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700'
  
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full'
  }
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse',
    none: ''
  }
  
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  }
  
  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  )
}

// 表格骨架屏组件
interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  className?: string
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 6,
  showHeader = true,
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* 表头骨架 */}
      {showHeader && (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={`header-${index}`} height="1.25rem" width="80%" />
            ))}
          </div>
        </div>
      )}
      
      {/* 表格行骨架 */}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={`cell-${rowIndex}-${colIndex}`} 
                height="1rem" 
                width={colIndex === 0 ? '60%' : colIndex === columns - 1 ? '40%' : '90%'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// 卡片骨架屏组件
interface CardSkeletonProps {
  count?: number
  className?: string
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  count = 3,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={`card-${index}`} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            {/* 标题 */}
            <Skeleton height="1.5rem" width="70%" />
            
            {/* 内容行 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton height="1rem" width="40%" />
                <Skeleton height="1rem" width="30%" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton height="1rem" width="50%" />
                <Skeleton height="1rem" width="25%" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton height="1rem" width="35%" />
                <Skeleton height="1rem" width="40%" />
              </div>
            </div>
            
            {/* 底部按钮区域 */}
            <div className="flex justify-end space-x-2 pt-4">
              <Skeleton height="2rem" width="4rem" variant="rectangular" />
              <Skeleton height="2rem" width="4rem" variant="rectangular" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// 上传进度骨架屏
export const UploadSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <div className="space-y-4">
        {/* 文件信息 */}
        <div className="flex items-center space-x-3">
          <Skeleton variant="rectangular" width="3rem" height="3rem" />
          <div className="flex-1 space-y-2">
            <Skeleton height="1.25rem" width="60%" />
            <Skeleton height="1rem" width="40%" />
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton height="1rem" width="30%" />
            <Skeleton height="1rem" width="20%" />
          </div>
          <Skeleton height="0.5rem" width="100%" variant="rectangular" />
        </div>
        
        {/* 状态信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton height="1rem" width="50%" />
            <Skeleton height="1rem" width="70%" />
          </div>
          <div className="space-y-2">
            <Skeleton height="1rem" width="60%" />
            <Skeleton height="1rem" width="40%" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Skeleton