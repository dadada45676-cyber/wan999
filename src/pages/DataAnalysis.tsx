import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar, Package, Smartphone, Globe, Users, Target, Clock, ChevronUp, ChevronDown, Eye, Download, TrendingUp, TrendingDown, Filter } from 'lucide-react'
import { useAppStore } from '../store'
import { useCountry } from '../store/country'

import { TableSkeleton } from '../components/Skeleton'
import Breadcrumb from '../components/Breadcrumb'
import SortableTableHeader from '../components/SortableTableHeader'
import Button from '../components/Button'
import CountrySelector from '../components/CountrySelector'

const DataAnalysis: React.FC = () => {
  const { 
    packages, 
    phoneRatings, 
    phoneScores, 
    addPackage, 
    addPhoneRating, 
    addPhoneScore,
    getPackageGrade
  } = useAppStore()
  
  // 国家选择状态
  const { selectedCountry } = useCountry()
  
  // 5个时间维度筛选（严格按照PRD要求：昨天、3天、7天、15天、30天）
  const [timeRange, setTimeRange] = useState<'yesterday' | '3days' | '7days' | '15days' | '30days'>('7days')
  
  // 每个排行榜的独立状态
  const [rankingStates, setRankingStates] = useState({
    packages: {
      collapsed: false,
      showAll: false,
      sortBy: 'conversionRate',
      sortOrder: 'desc' as 'asc' | 'desc'
    },
    smsProviders: {
      collapsed: false,
      showAll: false,
      sortBy: 'conversionRate',
      sortOrder: 'desc' as 'asc' | 'desc'
    },
    gamePlatforms: {
      collapsed: false,
      showAll: false,
      sortBy: 'conversionRate',
      sortOrder: 'desc' as 'asc' | 'desc'
    },
    sources: {
      collapsed: false,
      showAll: false,
      sortBy: 'conversionRate',
      sortOrder: 'desc' as 'asc' | 'desc'
    },
    sendTimes: {
      collapsed: false,
      showAll: false,
      sortBy: 'conversionRate',
      sortOrder: 'desc' as 'asc' | 'desc'
    }
  })
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(true)

  // 初始化数据（基于PRD的双重评估系统）
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      // 数据已在应用初始化时加载
      setIsLoading(false)
    }
    
    loadData()
  }, [packages.length])

  // 按国家和时间筛选逻辑（严格按照PRD的5个时间维度：昨天、3天、7天、15天、30天）
  const filteredPackages = useMemo(() => {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    
    return packages.filter(pkg => {
      // 首先按国家筛选
      if (pkg.country !== selectedCountry.code) {
        return false
      }
      
      // 然后按时间筛选
      const pkgDate = new Date(pkg.uploadTime)
      const diffTime = now.getTime() - pkgDate.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      switch (timeRange) {
        case 'yesterday':
          return pkgDate.toDateString() === yesterday.toDateString()
        case '3days':
          return diffDays <= 3
        case '7days':
          return diffDays <= 7
        case '15days':
          return diffDays <= 15
        case '30days':
          return diffDays <= 30
        default:
          return true
      }
    })
  }, [packages, timeRange, selectedCountry.code])

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

  // 等级分布统计状态
  const [gradeDistribution, setGradeDistribution] = useState<Array<{name: string, value: number, color: string}>>([])

  // 计算等级分布（使用配置驱动的评级标准）
  useEffect(() => {
    const calculateGradeDistribution = async () => {
      const distribution: Record<string, number> = {}
      
      // 使用配置驱动的评级计算
      for (const pkg of filteredPackages) {
        try {
          const grade = await getPackageGrade(pkg.conversion_rate)
          distribution[grade] = (distribution[grade] || 0) + 1
        } catch (error) {
          // 降级到默认逻辑
          let grade = 'D'
          if (pkg.conversion_rate >= 50) grade = 'SS'
          else if (pkg.conversion_rate >= 30) grade = 'S'
          else if (pkg.conversion_rate >= 20) grade = 'A'
          else if (pkg.conversion_rate >= 16) grade = 'B'
          else if (pkg.conversion_rate >= 10) grade = 'C'
          
          distribution[grade] = (distribution[grade] || 0) + 1
        }
      }
      
      const result = Object.entries(distribution).map(([grade, count]) => ({
        name: `${grade}级`,
        value: count,
        color: grade === 'SS' ? '#dc2626' :
               grade === 'S' ? '#ea580c' :
               grade === 'A' ? '#ca8a04' :
               grade === 'B' ? '#16a34a' :
               grade === 'C' ? '#2563eb' :
               '#6b7280'
      }))
      
      setGradeDistribution(result)
    }

    calculateGradeDistribution()
  }, [filteredPackages, getPackageGrade])

  // 趋势数据（最近7天）
  const trendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().split('T')[0]
    })

    return last7Days.map(date => {
      const dayPackages = filteredPackages.filter(pkg => 
        new Date(pkg.uploadTime).toISOString().split('T')[0] === date
      )
      
      const totalPhones = dayPackages.reduce((sum, pkg) => sum + pkg.phoneCount, 0)
      const totalFirstCharge = dayPackages.reduce((sum, pkg) => sum + pkg.firstChargeCount, 0)
      const conversionRate = totalPhones > 0 ? (totalFirstCharge / totalPhones) * 10000 : 0

      return {
        date: new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        packages: dayPackages.length,
        phones: totalPhones,
        firstCharge: totalFirstCharge,
        conversion: Math.round(conversionRate)
      }
    })
  }, [filteredPackages])

  // 四个排行榜的独立数据
  const allRankingData = useMemo(() => {
    // 包排行榜数据
    const packagesData = filteredPackages
      .map((pkg, index) => ({
        rank: index + 1,
        name: pkg.name,
        conversionRate: Math.round(pkg.conversion_rate),
        totalPhones: pkg.phoneCount,
        totalFirstCharge: pkg.firstChargeCount,
        uploadTime: pkg.uploadTime,
        smsProvider: pkg.smsProvider
      }))

    // 短信商排行榜数据
    const providerStats = filteredPackages.reduce((acc, pkg) => {
      if (!acc[pkg.smsProvider]) {
        acc[pkg.smsProvider] = { 
          totalPhones: 0, 
          totalFirstCharge: 0, 
          packageCount: 0 
        }
      }
      acc[pkg.smsProvider].totalPhones += pkg.phoneCount
      acc[pkg.smsProvider].totalFirstCharge += pkg.firstChargeCount
      acc[pkg.smsProvider].packageCount += 1
      return acc
    }, {} as Record<string, { totalPhones: number, totalFirstCharge: number, packageCount: number }>)
    
    const smsProvidersData = Object.entries(providerStats)
      .map(([provider, stats]) => ({
        name: provider,
        conversionRate: stats.totalPhones > 0 ? Math.round((stats.totalFirstCharge / stats.totalPhones) * 10000) : 0,
        totalPhones: stats.totalPhones,
        totalFirstCharge: stats.totalFirstCharge,
        packageCount: stats.packageCount
      }))
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }))

    // 游戏平台排行榜数据
    const platformStats = filteredPackages.reduce((acc, pkg) => {
      if (!acc[pkg.gamePlatform]) {
        acc[pkg.gamePlatform] = { 
          totalPhones: 0, 
          totalFirstCharge: 0, 
          packageCount: 0 
        }
      }
      acc[pkg.gamePlatform].totalPhones += pkg.phoneCount
      acc[pkg.gamePlatform].totalFirstCharge += pkg.firstChargeCount
      acc[pkg.gamePlatform].packageCount += 1
      return acc
    }, {} as Record<string, { totalPhones: number, totalFirstCharge: number, packageCount: number }>)
    
    const gamePlatformsData = Object.entries(platformStats)
      .map(([platform, stats]) => ({
        name: platform,
        conversionRate: stats.totalPhones > 0 ? Math.round((stats.totalFirstCharge / stats.totalPhones) * 10000) : 0,
        totalPhones: stats.totalPhones,
        totalFirstCharge: stats.totalFirstCharge,
        packageCount: stats.packageCount
      }))
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }))

    // 来源排行榜数据
    const sourceStats = filteredPackages.reduce((acc, pkg) => {
      if (!acc[pkg.source]) {
        acc[pkg.source] = { 
          totalPhones: 0, 
          totalFirstCharge: 0, 
          packageCount: 0 
        }
      }
      acc[pkg.source].totalPhones += pkg.phoneCount
      acc[pkg.source].totalFirstCharge += pkg.firstChargeCount
      acc[pkg.source].packageCount += 1
      return acc
    }, {} as Record<string, { totalPhones: number, totalFirstCharge: number, packageCount: number }>)
    
    const sourcesData = Object.entries(sourceStats)
      .map(([source, stats]) => ({
        name: source,
        conversionRate: stats.totalPhones > 0 ? Math.round((stats.totalFirstCharge / stats.totalPhones) * 10000) : 0,
        totalPhones: stats.totalPhones,
        totalFirstCharge: stats.totalFirstCharge,
        packageCount: stats.packageCount
      }))
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }))

    // 发送时间排行榜数据
    const sendTimeStats = filteredPackages.reduce((acc, pkg) => {
      // 解析发送时间，提取小时段
      const sendTime = new Date(pkg.sendTime)
      const hour = sendTime.getHours()
      
      // 将24小时分为12个2小时时间段
      let timeSlot = ''
      if (hour >= 0 && hour < 2) {
        timeSlot = '00:00-02:00'
      } else if (hour >= 2 && hour < 4) {
        timeSlot = '02:00-04:00'
      } else if (hour >= 4 && hour < 6) {
        timeSlot = '04:00-06:00'
      } else if (hour >= 6 && hour < 8) {
        timeSlot = '06:00-08:00'
      } else if (hour >= 8 && hour < 10) {
        timeSlot = '08:00-10:00'
      } else if (hour >= 10 && hour < 12) {
        timeSlot = '10:00-12:00'
      } else if (hour >= 12 && hour < 14) {
        timeSlot = '12:00-14:00'
      } else if (hour >= 14 && hour < 16) {
        timeSlot = '14:00-16:00'
      } else if (hour >= 16 && hour < 18) {
        timeSlot = '16:00-18:00'
      } else if (hour >= 18 && hour < 20) {
        timeSlot = '18:00-20:00'
      } else if (hour >= 20 && hour < 22) {
        timeSlot = '20:00-22:00'
      } else {
        timeSlot = '22:00-24:00'
      }
      
      if (!acc[timeSlot]) {
        acc[timeSlot] = { 
          totalPhones: 0, 
          totalFirstCharge: 0, 
          packageCount: 0 
        }
      }
      acc[timeSlot].totalPhones += pkg.phoneCount
      acc[timeSlot].totalFirstCharge += pkg.firstChargeCount
      acc[timeSlot].packageCount += 1
      return acc
    }, {} as Record<string, { totalPhones: number, totalFirstCharge: number, packageCount: number }>)
    
    const sendTimesData = Object.entries(sendTimeStats)
      .map(([timeSlot, stats]) => ({
        name: timeSlot,
        conversionRate: stats.totalPhones > 0 ? Math.round((stats.totalFirstCharge / stats.totalPhones) * 10000) : 0,
        totalPhones: stats.totalPhones,
        totalFirstCharge: stats.totalFirstCharge,
        packageCount: stats.packageCount
      }))
      .sort((a, b) => {
        // 按时间段排序
        const timeOrder = [
          '00:00-02:00', '02:00-04:00', '04:00-06:00', '06:00-08:00',
          '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00',
          '16:00-18:00', '18:00-20:00', '20:00-22:00', '22:00-24:00'
        ]
        return timeOrder.indexOf(a.name) - timeOrder.indexOf(b.name)
      })
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }))

    return {
      packages: packagesData,
      smsProviders: smsProvidersData,
      gamePlatforms: gamePlatformsData,
      sources: sourcesData,
      sendTimes: sendTimesData
    }
  }, [filteredPackages])

  // 状态更新函数
  const updateRankingState = useCallback((
    rankingType: 'packages' | 'smsProviders' | 'gamePlatforms' | 'sources' | 'sendTimes',
    updates: Partial<typeof rankingStates.packages>
  ) => {
    setRankingStates(prev => ({
      ...prev,
      [rankingType]: {
        ...prev[rankingType],
        ...updates
      }
    }))
  }, [])

  // 排序处理函数
  const handleSort = useCallback((
    rankingType: 'packages' | 'smsProviders' | 'gamePlatforms' | 'sources' | 'sendTimes',
    sortKey: string, 
    sortDirection: 'asc' | 'desc'
  ) => {
    updateRankingState(rankingType, {
      sortBy: sortKey,
      sortOrder: sortDirection
    })
  }, [updateRankingState])

  // 应用排序和数据限制的排行榜数据
  const processedRankingData = useMemo(() => {
    const processData = (
      data: any[], 
      rankingType: 'packages' | 'smsProviders' | 'gamePlatforms' | 'sources' | 'sendTimes'
    ) => {
      const state = rankingStates[rankingType]
      
      // 应用排序
      const sorted = [...data].sort((a, b) => {
        const aValue = a[state.sortBy as keyof typeof a]
        const bValue = b[state.sortBy as keyof typeof b]
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return state.sortOrder === 'asc' ? aValue - bValue : bValue - aValue
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return state.sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }
        
        return 0
      })
      
      // 重新分配排名
      const rankedData = sorted.map((item, index) => ({
        ...item,
        rank: index + 1
      }))
      
      // 应用数据限制（默认显示前5名）
      return state.showAll ? rankedData : rankedData.slice(0, 5)
    }

    return {
      packages: processData(allRankingData.packages, 'packages'),
      smsProviders: processData(allRankingData.smsProviders, 'smsProviders'),
      gamePlatforms: processData(allRankingData.gamePlatforms, 'gamePlatforms'),
      sources: processData(allRankingData.sources, 'sources'),
      sendTimes: processData(allRankingData.sendTimes, 'sendTimes')
    }
  }, [allRankingData, rankingStates])

  // 锚点跳转函数
  const scrollToRanking = useCallback((rankingType: string) => {
    const element = document.getElementById(`ranking-${rankingType}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-8">
      {/* 面包屑导航 */}
      <Breadcrumb />
      
      {/* 页面标题 */}
      <div className="mb-10">
        <div className="flex items-center space-x-4 mb-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            数据分析
          </h1>
          <CountrySelector 
            className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm"
            size="lg"
            showLabel={true}
          />
        </div>
        <p className="text-lg text-slate-600">深度分析业务数据，洞察转化趋势</p>
      </div>

      {/* 筛选控制栏 */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-white/20 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">时间范围:</span>
            </div>
            <div className="flex space-x-2">
              {[
                { key: 'yesterday', label: '昨天' },
                { key: '3days', label: '3天' },
                { key: '7days', label: '7天' },
                { key: '15days', label: '15天' },
                { key: '30days', label: '30天' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTimeRange(key as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    timeRange === key
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="secondary" icon={Filter}>
              高级筛选
            </Button>
            <Button variant="primary" icon={Download}>
              导出报告
            </Button>
          </div>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        <div className="metric-card group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">分析包数</p>
              <p className="metric-value">{coreMetrics.totalPackages.toLocaleString()}</p>
              <p className="metric-change">当前时间段</p>
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
              <p className="metric-change">数据样本量</p>
            </div>
            <div className="icon-container info group-hover:scale-110 transition-transform duration-300">
              <Users className="w-7 h-7" />
            </div>
          </div>
        </div>

        <div className="metric-card group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">转化用户</p>
              <p className="metric-value">{coreMetrics.totalFirstCharge.toLocaleString()}</p>
              <p className="metric-change">首充成功</p>
            </div>
            <div className="icon-container success group-hover:scale-110 transition-transform duration-300">
              <Target className="w-7 h-7" />
            </div>
          </div>
        </div>

        <div className="metric-card group hover:scale-105 transition-transform duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="metric-label">平均转化率</p>
              <p className={`metric-value ${coreMetrics.overallConversionRate >= 16 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {Math.round(coreMetrics.overallConversionRate)}‱
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



      {/* 排行榜区域 */}
      <div className="space-y-8">
        {/* 排行榜导航栏 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">排行榜</h3>
              <p className="text-sm text-slate-600">各维度转化率排名</p>
            </div>
          </div>
          
          {/* 锚点导航 */}
          <div className="flex flex-wrap gap-3">
            {[
              { key: 'packages', label: '📦 包排行', icon: Package },
              { key: 'smsProviders', label: '📱 短信商', icon: Smartphone },
              { key: 'gamePlatforms', label: '🎮 游戏平台', icon: Globe },
              { key: 'sources', label: '🔗 来源', icon: Users },
              { key: 'sendTimes', label: '🕐 发送时间', icon: Clock }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => scrollToRanking(key)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300"
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 四个独立排行榜 */}
        <div className="space-y-8">
        {[
          { key: 'packages', title: '📦 包排行榜', icon: Package, data: processedRankingData.packages },
          { key: 'smsProviders', title: '📱 短信商排行榜', icon: Smartphone, data: processedRankingData.smsProviders },
          { key: 'gamePlatforms', title: '🎮 游戏平台排行榜', icon: Globe, data: processedRankingData.gamePlatforms },
          { key: 'sources', title: '🔗 来源排行榜', icon: Users, data: processedRankingData.sources },
          { key: 'sendTimes', title: '⏰ 发送时间排行榜', icon: Clock, data: processedRankingData.sendTimes }
        ].map(({ key, title, icon: Icon, data }) => {
          const rankingType = key as 'packages' | 'smsProviders' | 'gamePlatforms' | 'sources' | 'sendTimes'
          const state = rankingStates[rankingType]
          const allData = allRankingData[rankingType]
          
          return (
            <div key={key} id={`ranking-${key}`} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
              {/* 排行榜标题和控制按钮 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="icon-container primary">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{title}</h4>
                    <p className="text-sm text-slate-600">
                      共 {allData.length} 项 • 显示前 {state.showAll ? allData.length : Math.min(5, allData.length)} 项
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* 查看更多/收起按钮 */}
                  {allData.length > 5 && (
                    <button
                      onClick={() => updateRankingState(rankingType, { showAll: !state.showAll })}
                      className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors duration-200"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{state.showAll ? '收起' : '查看更多'}</span>
                    </button>
                  )}
                  
                  {/* 折叠/展开按钮 */}
                  <button
                    onClick={() => updateRankingState(rankingType, { collapsed: !state.collapsed })}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                  >
                    {state.collapsed ? (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        <span>展开</span>
                      </>
                    ) : (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span>折叠</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 排行榜内容 */}
              {!state.collapsed && (
                <>
                  {/* 移动端卡片布局 */}
                  <div className="block lg:hidden">
                    {isLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <div key={index} className="bg-white rounded-xl p-4 animate-pulse border border-slate-200">
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                              <div className="flex-1">
                                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 bg-slate-200 rounded w-full"></div>
                              <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {data.map((item, index) => (
                          <div key={index} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg transition-all duration-200">
                            {/* 卡片头部 */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                  item.rank === 1 ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300' :
                                  item.rank === 2 ? 'bg-gray-100 text-gray-700 border-2 border-gray-300' :
                                  item.rank === 3 ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.rank}
                                </div>
                                {item.rank <= 3 && (
                                  <div className="text-lg">
                                    {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                                  </div>
                                )}
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                                </div>
                              </div>
                              <span className={`font-bold text-sm ${
                                item.conversionRate >= 100 ? 'text-emerald-600' :
                                item.conversionRate >= 50 ? 'text-blue-600' :
                                'text-slate-600'
                              }`}>
                                {item.conversionRate}
                              </span>
                            </div>

                            {/* 卡片内容 */}
                            <div className="grid grid-cols-2 gap-3">
                              {key === 'packages' && (
                                <>
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-600">总号码数</div>
                                    <div className="text-sm font-medium text-slate-900">{item.totalPhones?.toLocaleString()}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-600">总首充人数</div>
                                    <div className="text-sm font-medium text-slate-900">{item.totalFirstCharge?.toLocaleString()}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-600">上传时间</div>
                                    <div className="text-sm text-slate-900">{item.uploadTime}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-600">发送短信商</div>
                                    <div className="text-sm text-slate-900">{item.smsProvider}</div>
                                  </div>
                                </>
                              )}
                              
                              {key !== 'packages' && (
                                <>
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-600">总号码数</div>
                                    <div className="text-sm font-medium text-slate-900">{item.totalPhones?.toLocaleString()}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-slate-600">总首充人数</div>
                                    <div className="text-sm font-medium text-slate-900">{item.totalFirstCharge?.toLocaleString()}</div>
                                  </div>
                                  <div className="space-y-1 col-span-2">
                                    <div className="text-xs text-slate-600">使用的号码包数量</div>
                                    <div className="text-sm font-medium text-slate-900">{item.packageCount}</div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 桌面端表格布局 */}
                  <div className="hidden lg:block overflow-x-auto">
                    {isLoading ? (
                      <TableSkeleton rows={10} columns={key === 'packages' ? 7 : 6} showHeader={true} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6" />
                    ) : (
                      <table className="w-full bg-white rounded-xl shadow-sm border border-slate-200">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                            <SortableTableHeader
                              label="排名"
                              sortKey="rank"
                              currentSortBy={state.sortBy}
                              currentSortOrder={state.sortOrder}
                              onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                              className="px-6 py-4 text-left text-sm font-semibold text-slate-700"
                            />
                            <SortableTableHeader
                              label={key === 'packages' ? '包名称' : 
                                     key === 'smsProviders' ? '短信商名称' :
                                     key === 'gamePlatforms' ? '平台名称' : '来源名称'}
                              sortKey="name"
                              currentSortBy={state.sortBy}
                              currentSortOrder={state.sortOrder}
                              onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                              className="px-6 py-4 text-left text-sm font-semibold text-slate-700"
                            />
                            <SortableTableHeader
                              label="万分转化数"
                              sortKey="conversionRate"
                              currentSortBy={state.sortBy}
                              currentSortOrder={state.sortOrder}
                              onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                              className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                              align="center"
                            />
                            <SortableTableHeader
                              label="总号码数"
                              sortKey="totalPhones"
                              currentSortBy={state.sortBy}
                              currentSortOrder={state.sortOrder}
                              onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                              className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                              align="center"
                            />
                            <SortableTableHeader
                              label="总首充人数"
                              sortKey="totalFirstCharge"
                              currentSortBy={state.sortBy}
                              currentSortOrder={state.sortOrder}
                              onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                              className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                              align="center"
                            />
                            {key === 'packages' ? (
                              <>
                                <SortableTableHeader
                                  label="上传时间"
                                  sortKey="uploadTime"
                                  currentSortBy={state.sortBy}
                                  currentSortOrder={state.sortOrder}
                                  onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                                  className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                                  align="center"
                                />
                                <SortableTableHeader
                                  label="发送短信商"
                                  sortKey="smsProvider"
                                  currentSortBy={state.sortBy}
                                  currentSortOrder={state.sortOrder}
                                  onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                                  className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                                  align="center"
                                />
                              </>
                            ) : (
                              <SortableTableHeader
                                label="使用的号码包数量"
                                sortKey="packageCount"
                                currentSortBy={state.sortBy}
                                currentSortOrder={state.sortOrder}
                                onSort={(sortKey, sortDirection) => handleSort(rankingType, sortKey, sortDirection)}
                                className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                                align="center"
                              />
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((item, index) => (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-200">
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                    item.rank === 1 ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300' :
                                    item.rank === 2 ? 'bg-gray-100 text-gray-700 border-2 border-gray-300' :
                                    item.rank === 3 ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {item.rank}
                                  </div>
                                  {item.rank <= 3 && (
                                    <div className="text-xl">
                                      {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">{item.name}</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`font-bold ${
                                  item.conversionRate >= 100 ? 'text-emerald-600' :
                                  item.conversionRate >= 50 ? 'text-blue-600' :
                                  'text-slate-600'
                                }`}>
                                  {item.conversionRate}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center text-slate-600">
                                {item.totalPhones?.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-center text-slate-600">
                                {item.totalFirstCharge?.toLocaleString()}
                              </td>
                              {key === 'packages' ? (
                                <>
                                  <td className="px-6 py-4 text-center text-slate-600">
                                    {item.uploadTime}
                                  </td>
                                  <td className="px-6 py-4 text-center text-slate-600">
                                    {item.smsProvider}
                                  </td>
                                </>
                              ) : (
                                <td className="px-6 py-4 text-center text-slate-600">
                                  {item.packageCount}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>
          )
         })}
        </div>
      </div>


    </div>
  )
}

export default DataAnalysis