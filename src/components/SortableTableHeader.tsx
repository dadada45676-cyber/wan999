import React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface SortableTableHeaderProps {
  label: string
  sortKey: string
  currentSortBy: string
  currentSortOrder: 'asc' | 'desc'
  onSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  className?: string
  align?: 'left' | 'center' | 'right'
}

const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  label,
  sortKey,
  currentSortBy,
  currentSortOrder,
  onSort,
  className = '',
  align = 'left'
}) => {
  const isActive = currentSortBy === sortKey
  const isAsc = isActive && currentSortOrder === 'asc'
  const isDesc = isActive && currentSortOrder === 'desc'

  const handleClick = () => {
    if (isActive) {
      // 如果当前列已激活，切换排序方向
      onSort(sortKey, currentSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // 如果是新列，默认降序
      onSort(sortKey, 'desc')
    }
  }

  const getSortIcon = () => {
    if (isAsc) {
      return (
        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-sm">
          <ChevronUp className="w-3 h-3 text-white" />
        </div>
      )
    } else if (isDesc) {
      return (
        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-sm">
          <ChevronDown className="w-3 h-3 text-white" />
        </div>
      )
    } else {
      return (
        <div className="flex items-center justify-center w-5 h-5 bg-gray-100 rounded-full group-hover:bg-indigo-100 transition-all duration-200">
          <ChevronsUpDown className="w-3 h-3 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" />
        </div>
      )
    }
  }

  const alignmentClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  }[align]

  return (
    <th 
      className={`px-6 py-4 ${alignmentClass} text-sm font-semibold cursor-pointer select-none group transition-all duration-200 ${
        isActive 
          ? 'bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border-b-2 border-gradient-to-r border-indigo-400 shadow-sm' 
          : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50 border-b border-gray-200 hover:border-indigo-200'
      } ${className}`}
      onClick={handleClick}
    >
      <div className={`flex items-center gap-3 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <span className={`${isActive ? 'text-indigo-700 font-bold' : 'text-gray-700 group-hover:text-indigo-600'} transition-colors duration-200`}>
          {label}
        </span>
        <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
          {getSortIcon()}
        </div>
      </div>
    </th>
  )
}

export default SortableTableHeader