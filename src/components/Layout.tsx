import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  BarChart3, 
  Package, 
  TrendingUp, 
  Phone, 
  FileText, 
  Settings,
  Menu,
  X,
  Home,
  User,
  LogOut,
  Shield,
  ChevronDown,
  Clock
} from 'lucide-react'
import { useAuth, useAuthActions } from '../store/auth'
import { usePermissions } from '../hooks/usePermissions'
import { useCountry } from '../store/country'
import SessionMonitor from './SessionMonitor'
import CountrySelector from './CountrySelector'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  
  // 认证和权限相关
  const { user, isAuthenticated } = useAuth()
  const { logout } = useAuthActions()
  const { getAccessibleMenus } = usePermissions()
  
  // 国家选择相关
  const { selectedCountry } = useCountry()

  // 路由变化时自动关闭侧边栏和用户菜单
  useEffect(() => {
    setSidebarOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  // 阻止背景滚动
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [sidebarOpen])

  // ESC键关闭侧边栏
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [sidebarOpen])

  // 根据用户权限获取可访问的导航菜单
  const navigation = getAccessibleMenus().map(menu => ({
    name: menu.label,
    href: menu.path,
    icon: menu.icon === 'BarChart3' ? Home :
          menu.icon === 'Package' ? Package :
          menu.icon === 'TrendingUp' ? TrendingUp :
          menu.icon === 'Phone' ? Phone :
          menu.icon === 'FileText' ? FileText :
          menu.icon === 'Settings' ? Settings :
          menu.icon === 'Shield' ? Shield : Home
  }))

  // 处理登出
  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      // 登出失败
    }
  }

  // 获取用户角色显示文本
  const getRoleText = (role: string) => {
    return role === 'admin' ? '管理员' : '操作员'
  }

  // 获取用户状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'inactive': return 'text-gray-600 bg-gray-100'
      case 'locked': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard'
    }
    return location.pathname === href
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 移动端侧边栏遮罩 */}
      <div 
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* 侧边栏 - 固定在左侧 */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transform transition-all duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:relative lg:flex lg:flex-col lg:shadow-lg
        `}
        role="navigation"
        aria-label="主导航"
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center">
            <div className="p-1 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <span className="ml-3 text-lg font-bold text-gray-900 truncate">SMS数据分析</span>
          </div>
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭导航菜单"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <nav className="flex-1 mt-6 px-4 overflow-y-auto">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`
                      group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200
                      ${active
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className={`mr-3 h-5 w-5 transition-transform duration-200 ${
                      active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                    } group-hover:scale-110`} />
                    <span className="truncate">{item.name}</span>
                    {active && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse" />
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
          
          {/* 国家选择区域 */}
          {isAuthenticated && (
            <div className="mt-6 px-4">
              <div className="text-xs font-medium text-gray-500 mb-2 px-2">选择国家</div>
              <CountrySelector size="md" />
            </div>
          )}
          
          {/* 用户信息区域 */}
          {isAuthenticated && user && (
            <div className="mt-6 px-4 py-4 border-t border-gray-100">
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-full flex items-center p-3 text-sm rounded-lg hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="ml-3 flex-1 text-left">
                    <div className="font-medium text-gray-900 truncate">{user.name}</div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                        {getRoleText(user.role)}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* 用户下拉菜单 */}
                {userMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        最后登录: {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '首次登录'}
                      </div>
                    </div>
                    
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          navigate('/settings')
                        }}
                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                      >
                        <Settings className="w-4 h-4 mr-3 text-gray-400" />
                        个人设置
                      </button>
                      
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          handleLogout()
                        }}
                        className="w-full flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors duration-200"
                      >
                        <LogOut className="w-4 h-4 mr-3 text-red-400" />
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 底部装饰 */}
          <div className="mt-4 px-4 py-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 text-center">
              <div className="flex items-center justify-center space-x-1 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>系统运行正常</span>
              </div>
              <div>© 2024 SMS数据分析系统</div>
            </div>
          </div>
        </nav>
      </div>

      {/* 主内容区 - 与侧边栏平行 */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* 移动端顶部导航栏 */}
        <header className="lg:hidden bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="打开导航菜单"
              >
                <Menu className="h-6 w-6 text-gray-600" />
              </button>
              <div className="flex items-center">
                <div className="p-1 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <span className="ml-2 text-lg font-semibold text-gray-900 hidden sm:block">SMS数据分析</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* 国家选择器 */}
              {isAuthenticated && (
                <div className="hidden sm:block">
                  <CountrySelector size="sm" />
                </div>
              )}
              
              {/* 移动端用户信息 */}
              {isAuthenticated && user && (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 hidden sm:block">{user.name}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* 移动端用户下拉菜单 */}
                  {userMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                        <div className="flex items-center mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                            {getRoleText(user.role)}
                          </span>
                        </div>
                      </div>
                      
                      {/* 移动端国家选择 */}
                      <div className="px-4 py-3 border-b border-gray-100 sm:hidden">
                        <div className="text-xs font-medium text-gray-500 mb-2">选择国家</div>
                        <CountrySelector size="sm" />
                      </div>
                      
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            navigate('/settings')
                          }}
                          className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <Settings className="w-4 h-4 mr-3 text-gray-400" />
                          个人设置
                        </button>
                        
                        <button
                          onClick={() => {
                            setUserMenuOpen(false)
                            handleLogout()
                          }}
                          className="w-full flex items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors duration-200"
                        >
                          <LogOut className="w-4 h-4 mr-3 text-red-400" />
                          退出登录
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-xs text-gray-500 hidden sm:block">
                {new Date().toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short'
                })}
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* 会话监控组件 */}
      {isAuthenticated && <SessionMonitor />}
    </div>
  )
}

export default Layout