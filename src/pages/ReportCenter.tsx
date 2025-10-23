import { useState, useEffect } from 'react'
import { FileText, Download, Calendar, Filter, Plus, Clock, CheckCircle, AlertCircle, Eye, Settings, BarChart3, TrendingUp, Users, Package, Search, MoreVertical, Trash2, Edit3, Globe } from 'lucide-react'
import { useAppStore } from '../store'
import { useCountry } from '../store/country'

import Breadcrumb from '../components/Breadcrumb'
import CountrySelector from '../components/CountrySelector'

const ReportCenter = () => {
  const { reports, setReports, addReport } = useAppStore()
  const { selectedCountry } = useCountry()
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [timeRange, setTimeRange] = useState('30d')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedReportType, setSelectedReportType] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // 数据已在应用初始化时加载
  }, [reports.length, setReports])

  // 筛选数据
  const filteredReports = reports.filter(report => {
    const matchesCountry = report.country === selectedCountry.code
    const matchesType = selectedType === 'all' || report.type === selectedType
    const matchesStatus = selectedStatus === 'all' || report.status === selectedStatus
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCountry && matchesType && matchesStatus && matchesSearch
  })

  // 统计数据
  const totalReports = reports.length
  const monthlyReports = reports.filter(r => {
    const reportDate = new Date(r.generatedAt)
    const now = new Date()
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1)
    return reportDate >= monthAgo
  }).length
  const totalDownloads = reports.reduce((sum, r) => sum + r.downloadCount, 0)
  const generatingReports = reports.filter(r => r.status === 'generating').length

  // 生成报告
  const handleGenerateReport = async (type: string, title: string) => {
    setIsGenerating(true)
    
    // 模拟生成过程
    const newReport = {
      id: `report_${Date.now()}`,
      name: title,
      type: type as 'daily' | 'weekly' | 'monthly' | 'custom',
      format: 'pdf' as const,
      status: 'generating' as const,
      generatedAt: new Date().toISOString(),
      dataRange: {
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      },
      downloadCount: 0,
      fileSize: 0
    }
    
    addReport(newReport)
    
    // 模拟生成时间
    setTimeout(() => {
      const updatedReports = reports.map(r => 
        r.id === newReport.id 
          ? { ...r, status: 'completed' as const, fileSize: Math.floor(Math.random() * 10000000) + 1000000 }
          : r
      )
      setReports(updatedReports)
      setIsGenerating(false)
      setShowGenerateModal(false)
    }, 3000)
  }

  // 报告类型配置
  const reportTypes = [
    { id: 'daily', name: '日报', icon: Calendar, color: 'bg-blue-500', description: '每日数据汇总报告' },
    { id: 'weekly', name: '周报', icon: BarChart3, color: 'bg-green-500', description: '每周趋势分析报告' },
    { id: 'monthly', name: '月报', icon: TrendingUp, color: 'bg-purple-500', description: '每月综合分析报告' },
    { id: 'custom', name: '自定义', icon: Settings, color: 'bg-orange-500', description: '自定义时间范围报告' }
  ]

  // 状态配置
  const statusConfig = {
    generating: { label: '生成中', color: 'text-blue-600 bg-blue-50', icon: Clock },
    completed: { label: '已完成', color: 'text-green-600 bg-green-50', icon: CheckCircle },
    failed: { label: '失败', color: 'text-red-600 bg-red-50', icon: AlertCircle }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 面包屑导航 */}
      <div className="px-6 pt-6">
        <Breadcrumb />
      </div>
      
      {/* 页面头部 */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">报告中心</h1>
                <p className="mt-1 text-sm text-gray-500">生成和管理各类数据报告</p>
              </div>
              <CountrySelector 
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm"
                size="md"
                showLabel={true}
              />
            </div>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              生成报告
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">总报告数</p>
                <p className="text-2xl font-bold text-gray-900">{totalReports}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">本月生成</p>
                <p className="text-2xl font-bold text-gray-900">{monthlyReports}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">总下载量</p>
                <p className="text-2xl font-bold text-gray-900">{totalDownloads}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">生成中</p>
                <p className="text-2xl font-bold text-gray-900">{generatingReports}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 筛选和搜索 */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="搜索报告..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200 w-full sm:w-64"
                />
              </div>

              {/* 类型筛选 */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
              >
                <option value="all">所有类型</option>
                <option value="daily">日报</option>
                <option value="weekly">周报</option>
                <option value="monthly">月报</option>
                <option value="custom">自定义</option>
              </select>

              {/* 状态筛选 */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all duration-200"
              >
                <option value="all">所有状态</option>
                <option value="generating">生成中</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
              </select>
            </div>

            <div className="text-sm text-gray-500">
              共 {filteredReports.length} 个报告
            </div>
          </div>
        </div>

        {/* 报告列表 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">报告信息</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生成时间</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件大小</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">下载次数</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report, index) => {
                  const StatusIcon = statusConfig[report.status].icon
                  const reportType = reportTypes.find(t => t.id === report.type)
                  const TypeIcon = reportType?.icon || FileText

                  return (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${reportType?.color || 'bg-gray-500'} bg-opacity-10 mr-3`}>
                            <TypeIcon className={`w-5 h-5 ${reportType?.color?.replace('bg-', 'text-') || 'text-gray-500'}`} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{report.name}</div>
                            <div className="text-sm text-gray-500">{report.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {reportType?.name || report.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[report.status].color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[report.status].label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(report.generatedAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {report.fileSize}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {report.downloadCount}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {report.status === 'completed' && (
                            <>
                              <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200">
                                <Download className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <div className="relative">
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all duration-200">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无报告</h3>
              <p className="text-gray-500 mb-4">还没有生成任何报告，点击上方按钮开始生成</p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                生成第一个报告
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 生成报告模态框 */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">生成新报告</h3>
            
            <div className="space-y-4">
              {reportTypes.map((type) => {
                const Icon = type.icon
                return (
                  <div
                    key={type.id}
                    onClick={() => setSelectedReportType(type.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedReportType === type.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${type.color} bg-opacity-10 mr-3`}>
                        <Icon className={`w-5 h-5 ${type.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{type.name}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowGenerateModal(false)
                  setSelectedReportType('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (selectedReportType) {
                    const type = reportTypes.find(t => t.id === selectedReportType)
                    handleGenerateReport(selectedReportType, `${type?.name} - ${new Date().toLocaleDateString('zh-CN')}`)
                  }
                }}
                disabled={!selectedReportType || isGenerating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isGenerating ? '生成中...' : '开始生成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportCenter