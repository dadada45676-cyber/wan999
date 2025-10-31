import React, { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { useAppStore } from '../store'
import { useCountry } from '../store/country'

import { Activity, Users, Package, Target, BarChart3, PieChart as PieChartIcon, RefreshCw, AlertCircle, CheckCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import CountrySelector from '../components/CountrySelector'

const Dashboard: React.FC = () => {
  const { 
    packages, 
    phoneRatings, 
    phoneScores,
    addPackage, 
    addPhoneRating, 
    addPhoneScore,
    calculateConversionRate,
    getPackageGrade
  } = useAppStore()
  
  // 国家选择状态
  const { selectedCountry } = useCountry()

  // 简化的加载状态管理
  const [isLoading, setIsLoading] = useState(true)
  
  // 图表渲染状态 - 简单的延迟渲染机制
  const [chartsReady, setChartsReady] = useState(false)

  // 实时监控状态
  const [systemStatus, setSystemStatus] = useState({
    processingTasks: 3,
    systemLoad: 65,
    dbConnection: 'connected',
    lastUpdate: new Date()
  })

  // 初始化加载和图表渲染延迟
  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      setIsLoading(false)
    }, 1000) // 1秒加载延迟

    // 图表渲染延迟 - 确保 DOM 完全渲染后再显示图表
    const chartsTimer = setTimeout(() => {
      setChartsReady(true)
    }, 1200) // 在数据加载完成后额外延迟200ms

    return () => {
      clearTimeout(loadingTimer)
      clearTimeout(chartsTimer)
    }
  }, [])

  // 自动刷新实时数据
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        processingTasks: Math.floor(Math.random() * 10),
        systemLoad: Math.floor(Math.random() * 100),
        lastUpdate: new Date()
      }))
    }, 30000) // 30秒刷新一次

    return () => clearInterval(interval)
  }, [])

  // 现代化配色方案
  const colors = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    gray: '#6b7280'
  }

  // 按国家筛选的包数据
  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => pkg.country === selectedCountry.code)
  }, [packages, selectedCountry.code])

  // 核心指标计算（基于PRD的数据契约）
  const coreMetrics = useMemo(() => {
    const totalPhones = filteredPackages.reduce((sum, pkg) => sum + pkg.phoneCount, 0)
    const totalFirstCharge = filteredPackages.reduce((sum, pkg) => sum + pkg.firstChargeCount, 0)
    const overallConversionRate = totalPhones > 0 ? (totalFirstCharge / totalPhones) * 10000 : 0
    
    // 保本线分析（16万分转化数为保本线）
    const aboveBreakEven = filteredPackages.filter(pkg => pkg.conversion_rate >= 16).length
    const breakEvenRate = filteredPackages.length > 0 ? (aboveBreakEven / filteredPackages.length) * 100 : 0
    
    return {
      totalPackages: filteredPackages.length,
      totalPhones,
      totalFirstCharge,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100,
      breakEvenRate: Math.round(breakEvenRate * 100) / 100,
      avgPackageSize: filteredPackages.length > 0 ? Math.round(totalPhones / filteredPackages.length) : 0
    }
  }, [filteredPackages])

  // 等级分布统计（基于PRD的评级标准）
  const gradeDistribution = useMemo(() => {
    const distribution = {
      SS: filteredPackages.filter(p => p.conversion_rate >= 50).length,
      S: filteredPackages.filter(p => p.conversion_rate >= 30 && p.conversion_rate < 50).length,
      A: filteredPackages.filter(p => p.conversion_rate >= 20 && p.conversion_rate < 30).length,
      B: filteredPackages.filter(p => p.conversion_rate >= 16 && p.conversion_rate < 20).length,
      C: filteredPackages.filter(p => p.conversion_rate >= 10 && p.conversion_rate < 16).length,
      D: filteredPackages.filter(p => p.conversion_rate < 10).length,
    }
    
    return Object.entries(distribution).map(([grade, count]) => ({
      name: `${grade}级`,
      value: count,
      color: grade === 'SS' ? '#a855f7' :
             grade === 'S' ? '#3b82f6' :
             grade === 'A' ? '#10b981' :
             grade === 'B' ? '#f59e0b' :
             grade === 'C' ? '#f97316' : '#ef4444'
    })).filter(item => item.value > 0)
  }, [filteredPackages])

  // 趋势数据（最近7天）
  const trendData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      const dateStr = date.toISOString().split('T')[0]
      
      const dayPackages = filteredPackages.filter(pkg => 
        pkg.uploadTime.startsWith(dateStr)
      )
      
      const dayPhones = dayPackages.reduce((sum, pkg) => sum + pkg.phoneCount, 0)
      const dayFirstCharge = dayPackages.reduce((sum, pkg) => sum + pkg.firstChargeCount, 0)
      const dayConversion = dayPhones > 0 ? (dayFirstCharge / dayPhones) * 10000 : 0
      
      return {
        date: date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        packages: dayPackages.length,
        phones: dayPhones,
        firstCharge: dayFirstCharge,
        conversionRate: Math.round(dayConversion)
      }
    })
  }, [filteredPackages])

  // 系统状态指示器组件
  const StatusIndicator = ({ status, label }: { status: 'good' | 'warning' | 'error', label: string }) => {
    const getStatusColor = () => {
      switch (status) {
        case 'good': return 'bg-green-500'
        case 'warning': return 'bg-yellow-500'
        case 'error': return 'bg-red-500'
        default: return 'bg-gray-500'
      }
    }

    const getStatusIcon = () => {
      switch (status) {
        case 'good': return <CheckCircle className="w-4 h-4 text-green-600" />
        case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />
        case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />
        default: return <Clock className="w-4 h-4 text-gray-600" />
      }
    }

    return (
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
        {getStatusIcon()}
        <span className="text-sm text-gray-600">{label}</span>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 页面标题 */}
      <div className="mb-10">
        <div className="flex items-center space-x-4 mb-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            仪表盘
          </h1>
          <CountrySelector 
            className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm"
            size="lg"
            showLabel={true}
          />
        </div>
        <p className="text-lg text-slate-600">实时监控系统状态和核心业务指标</p>
      </div>

      {/* 系统状态栏 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 mb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <StatusIndicator 
              status={systemStatus.dbConnection === 'connected' ? 'good' : 'error'} 
              label="数据库连接" 
            />
            <StatusIndicator 
              status={systemStatus.systemLoad < 80 ? 'good' : 'warning'} 
              label={`系统负载 ${systemStatus.systemLoad}%`} 
            />
            <StatusIndicator 
              status={systemStatus.processingTasks > 0 ? 'good' : 'warning'} 
              label={`活跃任务 ${systemStatus.processingTasks}`} 
            />
          </div>
          <div className="flex items-center space-x-4">
            <button className="btn-ghost">
              <RefreshCw className="w-5 h-5" />
            </button>
            <span className="text-sm text-slate-500">
              最后更新: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        <div className="metric-card group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">总包数量</p>
              <p className="metric-value">{coreMetrics.totalPackages.toLocaleString()}</p>
              <p className="metric-change">平均 {coreMetrics.avgPackageSize.toLocaleString()} 条/包</p>
            </div>
            <div className="icon-container primary group-hover:scale-110 transition-transform duration-300">
              <Package className="w-7 h-7" />
            </div>
          </div>
        </div>

        <div className="metric-card group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">总号码数</p>
              <p className="metric-value">{coreMetrics.totalPhones.toLocaleString()}</p>
              <p className="metric-change">活跃号码池</p>
            </div>
            <div className="icon-container success group-hover:scale-110 transition-transform duration-300">
              <Users className="w-7 h-7" />
            </div>
          </div>
        </div>

        <div className="metric-card group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">总首充数</p>
              <p className="metric-value">{coreMetrics.totalFirstCharge.toLocaleString()}</p>
              <p className="metric-change">转化用户</p>
            </div>
            <div className="icon-container warning group-hover:scale-110 transition-transform duration-300">
              <Target className="w-7 h-7" />
            </div>
          </div>
        </div>

        <div className="metric-card group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">整体万分转化</p>
              <p className={`metric-value ${coreMetrics.overallConversionRate >= 16 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {Math.round(coreMetrics.overallConversionRate)}
              </p>
              <p className="metric-change">保本率 {coreMetrics.breakEvenRate}%</p>
            </div>
            <div className={`icon-container group-hover:scale-110 transition-transform duration-300 ${
              coreMetrics.overallConversionRate >= 16 ? 'success' : 'error'
            }`}>
              {coreMetrics.overallConversionRate >= 16 ? 
                <TrendingUp className="w-7 h-7" /> :
                <TrendingDown className="w-7 h-7" />
              }
            </div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* 万分转化数趋势图 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">万分转化数趋势</h3>
              <p className="text-sm text-slate-600">最近7天数据变化</p>
            </div>
            <div className="icon-container info">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>
          <div className="h-80 min-h-[320px] w-full min-w-[300px] relative overflow-hidden" style={{ minHeight: '320px', minWidth: '300px' }}>
            {trendData.length > 0 && !isLoading && chartsReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={320}>
              <AreaChart data={trendData}>
              <defs>
                <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis 
                stroke="#64748b"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="conversionRate" 
                stroke="#6366f1" 
                strokeWidth={3}
                fill="url(#conversionGradient)"
                name="万分转化数"
              />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
                  <p className="text-lg font-medium">图表加载中...</p>
                </>
              ) : (
                <>
                  <BarChart3 className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">暂无数据</p>
                  <p className="text-sm">请先上传数据包以查看趋势分析</p>
                </>
              )}
            </div>
          )}
        </div>
        </div>

        {/* 等级分布饼图 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">等级分布</h3>
              <p className="text-sm text-slate-600">基于万分转化数评级</p>
            </div>
            <div className="icon-container warning">
              <PieChartIcon className="w-6 h-6" />
            </div>
          </div>
          <div className="h-80 min-h-[320px] w-full min-w-[300px] relative overflow-hidden" style={{ minHeight: '320px', minWidth: '300px' }}>
            {gradeDistribution.length > 0 && !isLoading && chartsReady ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={320}>
                <PieChart>
                <Pie
                  data={gradeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {gradeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-lg font-medium">图表加载中...</p>
                  </>
                ) : (
                  <>
                    <PieChartIcon className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">暂无数据</p>
                    <p className="text-sm">请先上传数据包以查看等级分布</p>
                  </>
                )}
              </div>
            )}
          </div>
          {gradeDistribution.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              {gradeDistribution.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm text-slate-600">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 处理量统计 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">处理量统计</h3>
            <p className="text-sm text-slate-600">每日数据处理量分析</p>
          </div>
          <div className="icon-container success">
            <Activity className="w-6 h-6" />
          </div>
        </div>
        <div className="h-80 min-h-[320px] w-full min-w-[300px] relative overflow-hidden" style={{ minHeight: '320px', minWidth: '300px' }}>
          {trendData.length > 0 && !isLoading && chartsReady ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={320}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar 
                  dataKey="packages" 
                  fill="#6366f1" 
                  radius={[4, 4, 0, 0]}
                  name="处理包数"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mb-4"></div>
                  <p className="text-lg font-medium">图表加载中...</p>
                </>
              ) : (
                <>
                  <Activity className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg font-medium">暂无数据</p>
                  <p className="text-sm">请先上传数据包以查看处理量统计</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard