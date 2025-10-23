import React, { useState, useMemo } from 'react'
import { useAppStore } from '../store'
import ConfirmDialog from '../components/ConfirmDialog'
import Breadcrumb from '../components/Breadcrumb'
import { 
  FileText, 
  Download, 
  Trash2, 
  Share2, 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  Filter, 
  Search, 
  Plus,
  BarChart3,
  TrendingUp,
  Users,
  Package,
  Eye,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react'

// 报告类型定义
type ReportType = 'daily' | 'weekly' | 'monthly'
type ReportFormat = 'pdf' | 'excel'

// 报告记录接口
interface ReportRecord {
  id: string
  name: string
  type: ReportType
  format: ReportFormat
  generatedAt: string
  dataRange: {
    startDate: string
    endDate: string
  }
  fileSize: string
  downloadCount: number
  status: 'generating' | 'completed' | 'failed'
}

const Reports: React.FC = () => {
  const { packages, phoneRatings, phoneScores } = useAppStore()
  
  // 状态管理
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('daily')
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf')
  const [isGenerating, setIsGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<ReportType | 'all'>('all')
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  })

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    reportName: ''
  })

  // 模拟历史报告记录
  const [reportHistory, setReportHistory] = useState<ReportRecord[]>([
    {
      id: '1',
      name: '2024年1月15日 - 日报',
      type: 'daily',
      format: 'pdf',
      generatedAt: '2024-01-15T09:00:00Z',
      dataRange: {
        startDate: '2024-01-15',
        endDate: '2024-01-15'
      },
      fileSize: '2.3 MB',
      downloadCount: 15,
      status: 'completed'
    },
    {
      id: '2',
      name: '2024年1月第2周 - 周报',
      type: 'weekly',
      format: 'excel',
      generatedAt: '2024-01-14T18:30:00Z',
      dataRange: {
        startDate: '2024-01-08',
        endDate: '2024-01-14'
      },
      fileSize: '5.7 MB',
      downloadCount: 8,
      status: 'completed'
    },
    {
      id: '3',
      name: '2023年12月 - 月报',
      type: 'monthly',
      format: 'pdf',
      generatedAt: '2024-01-01T10:00:00Z',
      dataRange: {
        startDate: '2023-12-01',
        endDate: '2023-12-31'
      },
      fileSize: '12.1 MB',
      downloadCount: 25,
      status: 'completed'
    },
    {
      id: '4',
      name: '2024年1月14日 - 日报',
      type: 'daily',
      format: 'pdf',
      generatedAt: '2024-01-14T09:00:00Z',
      dataRange: {
        startDate: '2024-01-14',
        endDate: '2024-01-14'
      },
      fileSize: '1.8 MB',
      downloadCount: 12,
      status: 'generating'
    }
  ])

  // 生成报告统计数据
  const reportStats = useMemo(() => {
    const totalReports = reportHistory.length
    const completedReports = reportHistory.filter(r => r.status === 'completed').length
    const totalDownloads = reportHistory.reduce((sum, r) => sum + r.downloadCount, 0)
    const totalSize = reportHistory.reduce((sum, r) => {
      const size = parseFloat(r.fileSize.split(' ')[0])
      return sum + size
    }, 0)

    return {
      totalReports,
      completedReports,
      totalDownloads,
      totalSize: totalSize.toFixed(1)
    }
  }, [reportHistory])

  // 筛选报告记录
  const filteredReports = useMemo(() => {
    return reportHistory.filter(report => {
      const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = filterType === 'all' || report.type === filterType
      return matchesSearch && matchesType
    })
  }, [reportHistory, searchTerm, filterType])

  // 生成报告
  const generateReport = async () => {
    if (isGenerating) return

    setIsGenerating(true)
    
    // 模拟报告生成过程
    const newReport: ReportRecord = {
      id: Date.now().toString(),
      name: `${new Date().toLocaleDateString('zh-CN')} - ${
        selectedReportType === 'daily' ? '日报' : 
        selectedReportType === 'weekly' ? '周报' : '月报'
      }`,
      type: selectedReportType,
      format: selectedFormat,
      generatedAt: new Date().toISOString(),
      dataRange: {
        startDate: customDateRange.startDate || new Date().toISOString().split('T')[0],
        endDate: customDateRange.endDate || new Date().toISOString().split('T')[0]
      },
      fileSize: '0 MB',
      downloadCount: 0,
      status: 'generating'
    }

    setReportHistory(prev => [newReport, ...prev])

    // 模拟生成时间
    setTimeout(() => {
      setReportHistory(prev => 
        prev.map(report => 
          report.id === newReport.id 
            ? { ...report, status: 'completed' as const, fileSize: '2.5 MB' }
            : report
        )
      )
      setIsGenerating(false)
    }, 3000)
  }

  // 下载报告
  const downloadReport = (report: ReportRecord) => {
    if (report.status !== 'completed') return
    
    // 更新下载次数
    setReportHistory(prev =>
      prev.map(r => 
        r.id === report.id 
          ? { ...r, downloadCount: r.downloadCount + 1 }
          : r
      )
    )
    
    // 实现文件下载功能
    const blob = new Blob([`Report: ${report.name}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.name}.${report.format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 删除报告
  const deleteReport = (reportId: string) => {
    const report = reportHistory.find(r => r.id === reportId);
    if (!report) return;
    
    setConfirmDialog({
      isOpen: true,
      title: '确认删除报告',
      message: `确定要删除报告"${report.name}"吗？删除后将无法恢复。`,
      reportName: report.name,
      onConfirm: () => {
        setReportHistory(prev => prev.filter(r => r.id !== reportId));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }

  // 获取状态图标
  const getStatusIcon = (status: ReportRecord['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'generating':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  // 获取状态文本
  const getStatusText = (status: ReportRecord['status']) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'generating':
        return '生成中'
      case 'failed':
        return '失败'
      default:
        return '未知'
    }
  }

  // 获取状态样式
  const getStatusStyle = (status: ReportRecord['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'generating':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-8 h-8 text-indigo-600" />
                报告管理
              </h1>
              <p className="text-gray-600 mt-1">生成和管理系统报告</p>
            </div>
            <button
              onClick={generateReport}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  生成报告
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总报告数</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{reportStats.totalReports}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">已完成</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{reportStats.completedReports}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总下载量</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{reportStats.totalDownloads}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总大小</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{reportStats.totalSize} MB</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 报告生成配置 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">报告配置</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">报告类型</label>
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="daily">日报</option>
                <option value="weekly">周报</option>
                <option value="monthly">月报</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">文件格式</label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as ReportFormat)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 筛选和搜索 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索报告..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as ReportType | 'all')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">所有类型</option>
                <option value="daily">日报</option>
                <option value="weekly">周报</option>
                <option value="monthly">月报</option>
              </select>
            </div>
          </div>
        </div>

        {/* 报告列表 */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">报告历史</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {filteredReports.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无报告记录</p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        {report.format === 'pdf' ? (
                          <FileText className="w-6 h-6 text-red-600" />
                        ) : (
                          <FileSpreadsheet className="w-6 h-6 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{report.name}</h3>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(report.generatedAt).toLocaleDateString('zh-CN')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(report.generatedAt).toLocaleTimeString('zh-CN', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                          <span>{report.fileSize}</span>
                          <span className="flex items-center gap-1">
                            <Download className="w-4 h-4" />
                            {report.downloadCount} 次下载
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusStyle(report.status)}`}>
                        {getStatusIcon(report.status)}
                        {getStatusText(report.status)}
                      </div>
                      <div className="flex items-center space-x-2">
                        {report.status === 'completed' && (
                          <>
                            <button
                              onClick={() => downloadReport(report)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="下载"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="分享"
                            >
                              <Share2 className="w-5 h-5" />
                            </button>
                            <button
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="预览"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteReport(report.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
        confirmText="确认删除"
        cancelText="取消"
        details={confirmDialog.reportName ? [`报告名称：${confirmDialog.reportName}`, '此操作不可撤销'] : undefined}
      />
    </div>
  )
}

export default Reports