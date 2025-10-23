import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  const location = useLocation()

  // 根据路由自动生成面包屑
  const getAutoBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = [
      { label: '首页', href: '/dashboard', icon: <Home className="w-4 h-4" /> }
    ]

    const routeMap: Record<string, string> = {
      'dashboard': '仪表盘',
      'packages': '包管理',
      'analysis': '数据分析',
      'phones': '号码管理',
      'reports': '报告中心',
      'settings': '系统设置'
    }

    pathSegments.forEach((segment, index) => {
      const label = routeMap[segment] || segment
      const href = index === pathSegments.length - 1 ? undefined : `/${pathSegments.slice(0, index + 1).join('/')}`
      
      breadcrumbs.push({ label, href })
    })

    return breadcrumbs
  }

  const breadcrumbItems = items || getAutoBreadcrumbs()

  if (breadcrumbItems.length <= 1) {
    return null
  }

  return (
    <nav 
      className={`flex items-center space-x-2 text-sm ${className}`}
      aria-label="面包屑导航"
    >
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1
        const isFirst = index === 0

        return (
          <React.Fragment key={index}>
            {/* 分隔符 */}
            {!isFirst && (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            
            {/* 面包屑项 */}
            <div className="flex items-center space-x-1 min-w-0">
              {item.icon && (
                <span className={`flex-shrink-0 ${isLast ? 'text-blue-600' : 'text-gray-500'}`}>
                  {item.icon}
                </span>
              )}
              
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="text-gray-600 hover:text-blue-600 transition-colors duration-200 truncate font-medium hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span 
                  className={`truncate font-medium ${
                    isLast 
                      ? 'text-blue-600' 
                      : 'text-gray-800'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </div>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default Breadcrumb