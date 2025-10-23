import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Upload, Search, Filter, Download, Eye, Trash2, Package, FileText, AlertCircle, CheckCircle, Clock, Calendar, Globe, Smartphone, Building, Info, X, Plus, Star, Award, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useAppStore } from '../store'
import { useCountry } from '../store/country'

import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { TableSkeleton } from '../components/Skeleton'
import Breadcrumb from '../components/Breadcrumb'
import SortableTableHeader from '../components/SortableTableHeader'
import Button from '../components/Button'
import { tableStyles, tableRowHeights, tableTextStyles } from '../styles/tableStyles'
import CountrySelector from '../components/CountrySelector'

const PackageManagement: React.FC = () => {
  const { 
    packages, 
    phoneRatings,
    phoneScores,
    uploadProgress,
    addPackage, 
    addPhoneRating,
    addPhoneScore,
    calculateConversionRate,
    getPackageGrade
  } = useAppStore()
  
  const { selectedCountry, countries } = useCountry()
  const { toasts, success, error, warning, removeToast } = useToast()
  
  // 搜索和筛选状态
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSmsProvider, setFilterSmsProvider] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterGamePlatform, setFilterGamePlatform] = useState<string>('all')
  
  // 上传相关状态
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgressState, setUploadProgressState] = useState(0)
  const [uploadStage, setUploadStage] = useState<'uploading' | 'processing' | 'analyzing' | 'completing'>('uploading')
  const [uploadMessage, setUploadMessage] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  
  // 排序状态
  const [sortBy, setSortBy] = useState<string>('uploadTime')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(true)
  
  // 包详情查看状态
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
  const [showPackageDetail, setShowPackageDetail] = useState(false)
  
  // 上传表单状态
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    packageName: '',
    country: 'BR',
    sendTime: '',
    smsProvider: '',
    source: '',
    gamePlatform: '',
    firstChargeCount: 0,
    totalPhoneCount: 0,
    description: '',
    visitCount: 0,
    registerCount: 0,
    chargeAmount: 0
  })

  // 初始化模拟数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      
      // 注意：模拟数据已移除，现在使用store中的真实数据
      // 如果需要加载数据，应通过API调用获取
      // TODO: 实现真实的数据加载逻辑
      
      setIsLoading(false)
    }
    
    loadData()
  }, [packages.length, phoneRatings.length, phoneScores.length, addPackage, addPhoneRating, addPhoneScore])

  // 万分转化数计算函数
  const calculateConversionRateValue = (firstChargeCount: number, totalPhoneCount: number): number => {
    if (totalPhoneCount === 0) return 0
    return Math.round((firstChargeCount / totalPhoneCount) * 10000)
  }

  // 评级计算函数（基于万分转化数）
  const calculateGrade = (conversionRate: number): string => {
    if (conversionRate >= 50) return 'SS'
    if (conversionRate >= 30) return 'S'
    if (conversionRate >= 20) return 'A'
    if (conversionRate >= 16) return 'B' // 保本线
    if (conversionRate >= 10) return 'C'
    return 'D'
  }

  // 巴西号码验证函数
  const validateBrazilianPhone = (phone: string): boolean => {
    // 巴西号码：13-14位，以55开头
    const cleanPhone = phone.replace(/\D/g, '')
    return cleanPhone.length >= 13 && cleanPhone.length <= 14 && cleanPhone.startsWith('55')
  }

  // 文件上传处理
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return

    // 文件大小检查（最大100MB）
    if (file.size > 100 * 1024 * 1024) {
      error('文件大小超限', '文件大小不能超过100MB，请选择较小的文件')
      return
    }

    // 文件格式检查
    const allowedTypes = ['text/plain', 'text/csv', 'application/csv']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|csv)$/i)) {
      error('文件格式不支持', '只支持TXT和CSV格式文件，请选择正确的文件格式')
      return
    }

    try {
      // 读取文件内容并统计号码数量
      const fileContent = await readFileContent(file)
      const phoneCount = countValidPhoneNumbers(fileContent)
      
      // 自动填充包名称（基于文件名）
      const fileName = file.name.replace(/\.(txt|csv)$/i, '')
      
      setUploadForm(prev => ({
        ...prev,
        file,
        packageName: fileName,
        totalPhoneCount: phoneCount
      }))

      // 显示统计结果
      success('文件解析成功', `检测到 ${phoneCount} 个有效号码`)
      setShowUploadForm(true)
    } catch (err) {
      error('文件解析失败', '无法读取文件内容，请检查文件格式是否正确')
      // 文件解析错误
    }
  }, [success, error])

  // 读取文件内容
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content)
      }
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }
      reader.readAsText(file, 'utf-8')
    })
  }

  // 统计有效号码数量
  const countValidPhoneNumbers = (content: string): number => {
    if (!content) return 0
    
    // 按行分割内容
    const lines = content.split(/\r?\n/)
    let validCount = 0
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // 跳过空行和注释行
      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
        continue
      }
      
      // 对于CSV格式，取第一列作为号码
      let phoneNumber = trimmedLine
      if (trimmedLine.includes(',')) {
        phoneNumber = trimmedLine.split(',')[0].trim()
      } else if (trimmedLine.includes('\t')) {
        phoneNumber = trimmedLine.split('\t')[0].trim()
      }
      
      // 验证号码格式（简单验证：数字开头，长度在8-15位之间）
      if (isValidPhoneNumber(phoneNumber)) {
        validCount++
      }
    }
    
    return validCount
  }

  // 验证号码格式
  const isValidPhoneNumber = (phone: string): boolean => {
    // 移除所有非数字字符
    const cleanPhone = phone.replace(/\D/g, '')
    
    // 检查长度（8-15位）和是否为纯数字
    return cleanPhone.length >= 8 && cleanPhone.length <= 15 && /^\d+$/.test(cleanPhone)
  }

  // 拖拽处理
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }, [handleFileUpload])

  // 从文件内容中提取有效号码列表
  const extractPhoneNumbers = async (file: File): Promise<string[]> => {
    const content = await readFileContent(file)
    const lines = content.split(/\r?\n/)
    const phoneNumbers: string[] = []
    const seenNumbers = new Set<string>()
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // 跳过空行和注释行
      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
        continue
      }
      
      // 对于CSV格式，取第一列作为号码
      let phoneNumber = trimmedLine
      if (trimmedLine.includes(',')) {
        phoneNumber = trimmedLine.split(',')[0].trim()
      }
      
      // 验证号码格式
      if (validateBrazilianPhone(phoneNumber)) {
        const cleanPhone = phoneNumber.replace(/\D/g, '')
        
        // 去重处理
        if (!seenNumbers.has(cleanPhone)) {
          seenNumbers.add(cleanPhone)
          phoneNumbers.push(cleanPhone)
          
          // 性能优化：大文件时只保存前1000个有效号码作为样本
          if (phoneNumbers.length >= 1000) {
            break
          }
        }
      }
    }
    
    return phoneNumbers
  }

  // 提交上传表单
  const handleSubmitUpload = async () => {
    // 必填字段验证
    if (!uploadForm.file || !uploadForm.packageName || !uploadForm.sendTime || 
        !uploadForm.smsProvider || !uploadForm.source || !uploadForm.gamePlatform ||
        uploadForm.firstChargeCount <= 0 || uploadForm.totalPhoneCount <= 0) {
      warning('表单不完整', '请填写所有必填字段后再提交')
      return
    }

    setIsUploading(true)
    setUploadProgressState(0)
    setUploadStage('uploading')
    setUploadMessage('正在上传文件...')

    try {
      // 阶段1: 文件上传 (0-30%)
      setUploadStage('uploading')
      setUploadMessage('正在上传文件...')
      for (let i = 0; i <= 30; i += 5) {
        setUploadProgressState(i)
        await new Promise(resolve => setTimeout(resolve, 150))
      }

      // 阶段2: 文件处理 (30-70%)
      setUploadStage('processing')
      setUploadMessage('正在解析文件内容...')
      
      // 提取号码列表（基于PRD的数据契约要求）
      const phoneNumbers = await extractPhoneNumbers(uploadForm.file)
      
      for (let i = 30; i <= 70; i += 8) {
        setUploadProgressState(i)
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // 阶段3: 数据分析 (70-90%)
      setUploadStage('analyzing')
      setUploadMessage('正在分析号码数据...')
      for (let i = 70; i <= 90; i += 5) {
        setUploadProgressState(i)
        await new Promise(resolve => setTimeout(resolve, 180))
      }

      // 阶段4: 完成处理 (90-100%)
      setUploadStage('completing')
      setUploadMessage('正在生成分析报告...')
      for (let i = 90; i <= 100; i += 2) {
        setUploadProgressState(i)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 计算万分转化数和评级
      const conversionRate = calculateConversionRateValue(uploadForm.firstChargeCount, uploadForm.totalPhoneCount)
      const grade = calculateGrade(conversionRate)

      // 创建新包（包含phoneNumbers字段）
      const newPackage = {
        id: Date.now().toString(),
        name: uploadForm.packageName,
        fileName: uploadForm.file.name,
        country: uploadForm.country,
        totalPhones: uploadForm.totalPhoneCount,
        validPhones: phoneNumbers.length,
        invalidPhones: uploadForm.totalPhoneCount - phoneNumbers.length,
        duplicatePhones: 0,
        conversionRate,
        packageRating: grade as 'SS' | 'S' | 'A' | 'B' | 'C' | 'D',
        sendTime: uploadForm.sendTime,
        smsProvider: uploadForm.smsProvider,
        source: uploadForm.source,
        gamePlatform: uploadForm.gamePlatform,
        visitCount: uploadForm.visitCount,
        registerCount: uploadForm.registerCount,
        firstChargeCount: uploadForm.firstChargeCount,
        totalAmount: uploadForm.chargeAmount,
        status: 'completed' as const,
        uploadProgress: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        grade: grade as 'SS' | 'S' | 'A' | 'B' | 'C' | 'D',
        phoneCount: uploadForm.totalPhoneCount,
        description: uploadForm.description || `${uploadForm.smsProvider} - ${uploadForm.source}`,
        fileSize: uploadForm.file.size,
        uploadTime: new Date().toISOString(),
        phoneNumbers: phoneNumbers // 添加实际的号码列表
      }

      addPackage(newPackage)
      
      // 重置表单
      setUploadForm({
        file: null,
        packageName: '',
        country: 'BR',
        sendTime: '',
        smsProvider: '',
        source: '',
        gamePlatform: '',
        firstChargeCount: 0,
        totalPhoneCount: 0,
        description: '',
        visitCount: 0,
        registerCount: 0,
        chargeAmount: 0
      })
      
      setShowUploadForm(false)
      success('上传成功', `号码包已成功上传，包含 ${phoneNumbers.length} 个有效号码样本`)
      
    } catch (error) {
      error('上传失败', '文件处理过程中出现错误，请检查文件格式后重试')
    } finally {
      setIsUploading(false)
      setUploadProgressState(0)
      setUploadStage('uploading')
      setUploadMessage('')
    }
  }

  // 排序处理函数
  const handleSort = useCallback((sortKey: string, sortDirection: 'asc' | 'desc') => {
    setSortBy(sortKey)
    setSortOrder(sortDirection)
  }, [])

  // 筛选、搜索和排序逻辑
  const filteredPackages = useMemo(() => {
    let filtered = packages.filter(pkg => {
      const matchesCountry = pkg.country === selectedCountry.code
      const matchesSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           pkg.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesGrade = filterGrade === 'all' || pkg.grade === filterGrade
      const matchesStatus = filterStatus === 'all' || pkg.status === filterStatus
      const matchesSmsProvider = filterSmsProvider === 'all' || pkg.smsProvider === filterSmsProvider
      const matchesSource = filterSource === 'all' || pkg.source === filterSource
      const matchesGamePlatform = filterGamePlatform === 'all' || pkg.gamePlatform === filterGamePlatform
      
      return matchesCountry && matchesSearch && matchesGrade && matchesStatus && matchesSmsProvider && matchesSource && matchesGamePlatform
    })

    // 排序
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof typeof a]
      let bValue: any = b[sortBy as keyof typeof b]
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    return filtered
  }, [packages, selectedCountry.code, searchTerm, filterGrade, filterStatus, filterSmsProvider, filterSource, filterGamePlatform, sortBy, sortOrder])

  // 分页逻辑
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredPackages.length / itemsPerPage)
    const paginatedPackages = filteredPackages.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
    return { totalPages, paginatedPackages }
  }, [filteredPackages, currentPage, itemsPerPage])

  const { totalPages, paginatedPackages } = paginationData

  // 获取包详情
  const getPackageDetail = useCallback((packageId: string) => {
    return packages.find(pkg => pkg.id === packageId)
  }, [packages])

  // 等级颜色映射
  const getGradeColor = (grade: string) => {
    const colors = {
      'SS': 'text-purple-600 bg-purple-50 border-purple-200',
      'S': 'text-red-600 bg-red-50 border-red-200',
      'A': 'text-orange-600 bg-orange-50 border-orange-200',
      'B': 'text-yellow-600 bg-yellow-50 border-yellow-200', // 保本线
      'C': 'text-blue-600 bg-blue-50 border-blue-200',
      'D': 'text-gray-600 bg-gray-50 border-gray-200'
    }
    return colors[grade as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getGradeText = (grade: string) => {
    const texts = {
      'SS': 'SS级',
      'S': 'S级',
      'A': 'A级',
      'B': 'B级（保本线）',
      'C': 'C级',
      'D': 'D级'
    }
    return texts[grade as keyof typeof texts] || grade
  }

  // 状态颜色映射
  const getStatusColor = (status: string) => {
    const colors = {
      'completed': 'text-green-600 bg-green-50 border-green-200',
      'processing': 'text-blue-600 bg-blue-50 border-blue-200',
      'failed': 'text-red-600 bg-red-50 border-red-200'
    }
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getStatusText = (status: string) => {
    const texts = {
      'completed': '已完成',
      'processing': '处理中',
      'failed': '失败'
    }
    return texts[status as keyof typeof texts] || status
  }

  // 等级样式映射（用于详情页面）
  const getGradeStyle = (grade?: string) => {
    const styles = {
      'SS': { 
        bg: 'bg-purple-50', 
        text: 'text-purple-700', 
        border: 'border-purple-200',
        dot: 'bg-purple-500',
        icon: Star
      },
      'S': { 
        bg: 'bg-red-50', 
        text: 'text-red-700', 
        border: 'border-red-200',
        dot: 'bg-red-500',
        icon: Star
      },
      'A': { 
        bg: 'bg-orange-50', 
        text: 'text-orange-700', 
        border: 'border-orange-200',
        dot: 'bg-orange-500',
        icon: Award
      },
      'B': { 
        bg: 'bg-yellow-50', 
        text: 'text-yellow-700', 
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
        icon: Award
      },
      'C': { 
        bg: 'bg-blue-50', 
        text: 'text-blue-700', 
        border: 'border-blue-200',
        dot: 'bg-blue-500',
        icon: Award
      },
      'D': { 
        bg: 'bg-gray-50', 
        text: 'text-gray-700', 
        border: 'border-gray-200',
        dot: 'bg-gray-500',
        icon: Award
      }
    }
    return styles[grade as keyof typeof styles] || styles['D']
  }

  // 状态样式映射（用于详情页面）
  const getStatusStyle = (status: string) => {
    const styles = {
      'completed': { 
        bg: 'bg-green-50', 
        text: 'text-green-700', 
        border: 'border-green-200',
        dot: 'bg-green-500'
      },
      'processing': { 
        bg: 'bg-blue-50', 
        text: 'text-blue-700', 
        border: 'border-blue-200',
        dot: 'bg-blue-500'
      },
      'failed': { 
        bg: 'bg-red-50', 
        text: 'text-red-700', 
        border: 'border-red-200',
        dot: 'bg-red-500'
      }
    }
    return styles[status as keyof typeof styles] || styles['processing']
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 格式化日期
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  // 根据国家代码获取国家信息
  const getCountryInfo = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode)
    return country ? `${country.flag} ${country.name}` : countryCode
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 面包屑导航 */}
        <Breadcrumb />
        
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                包管理
              </h1>
              <CountrySelector 
                className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-sm"
                size="md"
                showLabel={true}
              />
            </div>
            <p className="text-gray-600 text-lg">管理号码包的上传、处理和分析，支持万分转化数计算与SS-D评级</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="primary"
              size="md"
              icon={Upload}
              onClick={() => setShowUploadForm(true)}
              className="group hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              上传号码包
            </Button>
          </div>
        </div>

        {/* 上传表单弹窗 */}
        {showUploadForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-primary to-primary-dark rounded-xl">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    上传号码包
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  onClick={() => setShowUploadForm(false)}
                  className="p-2"
                />
              </div>

              {/* 文件上传区域 */}
              <div
                className={`relative border-2 border-dashed rounded-2xl p-4 text-center mb-3 transition-all duration-300 ${
                  dragActive 
                    ? 'border-primary bg-gradient-to-br from-primary/5 to-primary-dark/5 scale-105' 
                    : 'border-gray-300 hover:border-primary/50 hover:bg-gradient-to-br hover:from-gray-50 hover:to-gray-100'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className={`transition-all duration-300 ${dragActive ? 'scale-110' : ''}`}>
                  <div className="p-2 bg-gradient-to-r from-primary/10 to-primary-dark/10 rounded-2xl w-fit mx-auto mb-3">
                    <Upload className={`w-8 h-8 mx-auto transition-colors duration-300 ${
                      dragActive ? 'text-primary' : 'text-gray-400'
                    }`} />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    {uploadForm.file ? (
                      <span className="flex items-center justify-center space-x-2">
                        <FileText className="w-5 h-5 text-primary" />
                        <span>{uploadForm.file.name}</span>
                      </span>
                    ) : (
                      '拖拽文件到此处或点击选择'
                    )}
                  </p>
                  <p className="text-gray-500 mb-3">
                    支持 TXT、CSV 格式，最大 100MB
                  </p>
                  <input
                    type="file"
                    accept=".txt,.csv"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all duration-200 cursor-pointer font-medium shadow-sm hover:shadow-md"
                  >
                    <Plus className="w-5 h-5" />
                    <span>选择文件</span>
                  </label>
                </div>
              </div>

              {/* 上传表单 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    包名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadForm.packageName}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, packageName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                    placeholder="自动填充或手动输入"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    国家地区 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadForm.country}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                  >
                    {countries.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    发送时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={uploadForm.sendTime}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, sendTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    短信商 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadForm.smsProvider}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, smsProvider: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                  >
                    <option value="">请选择短信商</option>
                    <option value="短信商A">📱 短信商A</option>
                    <option value="短信商B">📱 短信商B</option>
                    <option value="短信商C">📱 短信商C</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    数据来源 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadForm.source}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                  >
                    <option value="">请选择数据来源</option>
                    <option value="Facebook">📘 Facebook</option>
                    <option value="Google">🔍 Google</option>
                    <option value="TikTok">🎵 TikTok</option>
                    <option value="其他">📊 其他</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    游戏平台 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadForm.gamePlatform}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, gamePlatform: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                  >
                    <option value="">请选择游戏平台</option>
                    <option value="平台A">🎮 平台A</option>
                    <option value="平台B">🎮 平台B</option>
                    <option value="平台C">🎮 平台C</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    访问人数 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={uploadForm.visitCount || 0}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, visitCount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                    placeholder="点击链接的人数"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    注册人数 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={uploadForm.registerCount || 0}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, registerCount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                    placeholder="真正注册游戏的人数"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    首充人数 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={uploadForm.firstChargeCount}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, firstChargeCount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                    placeholder="第一次充值的人数"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-semibold text-gray-700">
                    充值金额 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={uploadForm.chargeAmount || 0}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, chargeAmount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
                    placeholder="总充值金额"
                  />
                </div>

              </div>



              {/* 描述 */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  描述（可选）
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white resize-none"
                  placeholder="输入包描述信息..."
                />
              </div>

              {/* 上传进度 */}
              {isUploading && (
                <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {uploadStage === 'uploading' && <Upload className="w-5 h-5 text-blue-600 animate-bounce" />}
                      {uploadStage === 'processing' && <FileText className="w-5 h-5 text-indigo-600 animate-pulse" />}
                      {uploadStage === 'analyzing' && <Eye className="w-5 h-5 text-purple-600 animate-spin" />}
                      {uploadStage === 'completing' && <CheckCircle className="w-5 h-5 text-green-600 animate-pulse" />}
                      <div>
                        <span className="text-sm font-semibold text-gray-800">
                          {uploadStage === 'uploading' && '文件上传中'}
                          {uploadStage === 'processing' && '文件处理中'}
                          {uploadStage === 'analyzing' && '数据分析中'}
                          {uploadStage === 'completing' && '即将完成'}
                        </span>
                        <p className="text-xs text-gray-600 mt-1">{uploadMessage}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">{uploadProgressState}%</span>
                      <p className="text-xs text-gray-500">
                        {uploadStage === 'uploading' && '上传阶段'}
                        {uploadStage === 'processing' && '处理阶段'}
                        {uploadStage === 'analyzing' && '分析阶段'}
                        {uploadStage === 'completing' && '完成阶段'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="relative">
                    <div className="w-full bg-white/80 rounded-full h-4 overflow-hidden shadow-inner">
                      <div
                        className={`h-4 rounded-full transition-all duration-700 ease-out relative overflow-hidden ${
                          uploadStage === 'uploading' ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                          uploadStage === 'processing' ? 'bg-gradient-to-r from-indigo-400 to-indigo-600' :
                          uploadStage === 'analyzing' ? 'bg-gradient-to-r from-purple-400 to-purple-600' :
                          'bg-gradient-to-r from-green-400 to-green-600'
                        }`}
                        style={{ width: `${uploadProgressState}%` }}
                      >
                        {/* 动画光效 */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                      </div>
                    </div>
                    
                    {/* 阶段指示器 */}
                    <div className="flex justify-between mt-3 text-xs">
                      <div className={`flex items-center space-x-1 ${uploadProgressState >= 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${uploadProgressState >= 0 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        <span>上传</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${uploadProgressState >= 30 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${uploadProgressState >= 30 ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                        <span>处理</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${uploadProgressState >= 70 ? 'text-purple-600' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${uploadProgressState >= 70 ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                        <span>分析</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${uploadProgressState >= 90 ? 'text-green-600' : 'text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${uploadProgressState >= 90 ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                        <span>完成</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-end space-x-4">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setShowUploadForm(false)}
                  disabled={isUploading}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon={isUploading ? Clock : Upload}
                  onClick={handleSubmitUpload}
                  disabled={isUploading}
                  loading={isUploading}
                  className="hover:shadow-lg hover:scale-105 disabled:hover:scale-100 transition-all duration-200"
                >
                  {isUploading ? '上传中...' : '确认上传'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 搜索和筛选 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gradient-to-r from-primary/10 to-primary-dark/10 rounded-xl">
              <Filter className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">筛选和搜索</h3>
          </div>
          
          <div className="grid grid-cols-6 gap-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索包名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>

            {/* 等级筛选 */}
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
            >
              <option value="all">🏆 所有等级</option>
              <option value="SS">💎 SS级</option>
              <option value="S">🔥 S级</option>
              <option value="A">⭐ A级</option>
              <option value="B">📈 B级（保本线）</option>
              <option value="C">📊 C级</option>
              <option value="D">📉 D级</option>
            </select>

            {/* 状态筛选 */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
            >
              <option value="all">📋 所有状态</option>
              <option value="completed">✅ 已完成</option>
              <option value="processing">⏳ 处理中</option>
              <option value="failed">❌ 失败</option>
            </select>

            {/* 短信商筛选 */}
            <select
              value={filterSmsProvider}
              onChange={(e) => setFilterSmsProvider(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
            >
              <option value="all">📱 所有短信商</option>
              <option value="短信商A">📱 短信商A</option>
              <option value="短信商B">📱 短信商B</option>
              <option value="短信商C">📱 短信商C</option>
            </select>

            {/* 数据来源筛选 */}
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
            >
              <option value="all">🌐 所有来源</option>
              <option value="Facebook">📘 Facebook</option>
              <option value="Google">🔍 Google</option>
              <option value="TikTok">🎵 TikTok</option>
              <option value="其他">📊 其他</option>
            </select>

            {/* 游戏平台筛选 */}
            <select
              value={filterGamePlatform}
              onChange={(e) => setFilterGamePlatform(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 bg-gray-50/50 hover:bg-white"
            >
              <option value="all">🎮 所有平台</option>
              <option value="平台A">🎮 平台A</option>
              <option value="平台B">🎮 平台B</option>
              <option value="平台C">🎮 平台C</option>
            </select>
          </div>
        </div>

        {/* 包列表 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-primary/10 to-primary-dark/10 rounded-xl">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">号码包列表</h3>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                  共 {filteredPackages.length} 个包
                </span>
              </div>
              
              {/* 排序状态指示器 */}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>排序:</span>
                <div className="flex items-center space-x-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
                  <span className="font-medium">
                    {sortBy === 'name' ? '包名称' :
                     sortBy === 'uploadTime' ? '上传时间' :
                     sortBy === 'totalPhoneCount' ? '号码数量' :
                     sortBy === 'conversionRate' ? '转化率' :
                     sortBy === 'grade' ? '评级' :
                     sortBy === 'smsProvider' ? '短信商' :
                     sortBy === 'source' ? '来源' :
                     sortBy === 'gamePlatform' ? '游戏平台' :
                     sortBy === 'status' ? '状态' : '默认'}
                  </span>
                  <div className="flex items-center justify-center w-4 h-4 bg-indigo-500 rounded-full">
                    {sortOrder === 'asc' ? (
                      <ChevronUp className="w-2.5 h-2.5 text-white" />
                    ) : (
                      <ChevronDown className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 移动端卡片布局 */}
          <div className="block lg:hidden">
            {isLoading ? (
              <div className="space-y-4 p-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="bg-white/50 backdrop-blur-sm rounded-xl p-4 animate-pulse">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : paginatedPackages.length > 0 ? (
              <div className="space-y-4 p-6">
                {paginatedPackages.map((pkg, index) => (
                  <div key={pkg.id} className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 p-4 hover:shadow-lg transition-all duration-200">
                    {/* 卡片头部 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <Package className="w-10 h-10 text-indigo-500" />
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white font-bold">{index + 1}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">{pkg.name}</h4>
                          <p className="text-xs text-gray-500">{pkg.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {pkg.grade === 'S' && <Star className="w-4 h-4 text-yellow-500 mr-1" />}
                        {pkg.grade === 'A' && <Award className="w-4 h-4 text-blue-500 mr-1" />}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getGradeColor(pkg.grade)}`}>
                          {getGradeText(pkg.grade)}
                        </span>
                      </div>
                    </div>

                    {/* 卡片内容 */}
                    <div className="space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center text-xs text-gray-600">
                            <Smartphone className="w-3 h-3 mr-1" />
                            <span>号码数量</span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{pkg.phoneCount?.toLocaleString() || 0}</div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center text-xs text-gray-600">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            <span>万分转化数</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-gray-900">{Math.round(pkg.conversionRate || 0)}</span>
                            {pkg.conversionRate >= 160 && (
                              <span className="text-xs text-amber-700 bg-gradient-to-r from-amber-100 to-yellow-100 px-2 py-1 rounded-full border border-amber-200 font-medium">
                                保本线
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center text-xs text-gray-600">
                          <Building className="w-3 h-3 mr-1" />
                          <span>短信商</span>
                        </div>
                        <div className="text-sm text-gray-900">{pkg.smsProvider || '-'}</div>
                      </div>
                    </div>

                    {/* 额外信息 */}
                    <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-gray-100">
                      <div className="space-y-2">
                        <div className="flex items-center text-xs text-gray-600">
                          <FileText className="w-3 h-3 mr-1" />
                          <span>来源</span>
                        </div>
                        <div className="text-sm text-gray-900">{pkg.source || '-'}</div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center text-xs text-gray-600">
                          <Globe className="w-3 h-3 mr-1" />
                          <span>游戏平台</span>
                        </div>
                        <div className="text-sm text-gray-900">{pkg.gamePlatform || '-'}</div>
                      </div>
                    </div>

                    {/* 状态和操作 */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(pkg.status)}`}>
                        {pkg.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {pkg.status === 'processing' && <Clock className="w-3 h-3 mr-1" />}
                        {pkg.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {getStatusText(pkg.status)}
                      </span>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedPackage(pkg.id)
                            setShowPackageDetail(true)
                          }}
                          className="flex items-center px-3 py-1.5 text-xs text-indigo-600 hover:text-white hover:bg-indigo-500 rounded-lg transition-all duration-200"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          查看
                        </button>
                        <button className="flex items-center px-3 py-1.5 text-xs text-emerald-600 hover:text-white hover:bg-emerald-500 rounded-lg transition-all duration-200">
                          <Download className="w-3 h-3 mr-1" />
                          导出
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-gray-500">
                <Package className="w-20 h-20 mb-6 opacity-30" />
                <h3 className="text-xl font-semibold mb-2">暂无号码包</h3>
                <p className="text-sm text-center mb-6">
                  还没有上传任何号码包，点击上方"上传号码包"按钮开始使用
                </p>
                <Button
                  variant="primary"
                  size="md"
                  icon={Upload}
                  onClick={() => setShowUploadForm(true)}
                  className="hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  上传第一个号码包
                </Button>
              </div>
            )}
          </div>

          {/* 桌面端表格布局 */}
          <div className={`hidden lg:block ${tableStyles.container}`}>
            {isLoading ? (
              <TableSkeleton rows={10} columns={11} showHeader={true} className="bg-white/50 backdrop-blur-sm rounded-xl p-6" />
            ) : paginatedPackages.length > 0 ? (
              <table className={tableStyles.table}>
                <thead className={tableStyles.thead}>
                  <tr className={tableStyles.theadRow}>
                    <SortableTableHeader
                      label="包名称"
                      sortKey="name"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      label="📱 号码数量"
                      sortKey="totalPhoneCount"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                      align="center"
                    />
                    <SortableTableHeader
                      label="📊 万分转化数"
                      sortKey="conversionRate"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                      align="center"
                    />
                    <SortableTableHeader
                      label="🏆 评级"
                      sortKey="grade"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                      align="center"
                    />
                    <SortableTableHeader
                      label="📱 短信商"
                      sortKey="smsProvider"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      label="🌐 来源"
                      sortKey="source"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      label="🎮 游戏平台"
                      sortKey="gamePlatform"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      label="📋 状态"
                      sortKey="status"
                      currentSortBy={sortBy}
                      currentSortOrder={sortOrder}
                      onSort={handleSort}
                      align="center"
                    />
                    <th className={`${tableStyles.th} min-w-[140px] w-36`}>⚙️ 操作</th>
                  </tr>
                </thead>
                <tbody className={tableStyles.tbody}>
                {paginatedPackages.map((pkg, index) => (
                <tr key={pkg.id} className={tableStyles.tbodyRow}>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <div className={`${tableTextStyles.primary} group-hover:text-indigo-700 transition-colors duration-200`}>
                      {pkg.name}
                    </div>
                  </td>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <div className={`flex items-center ${tableTextStyles.primary}`}>
                      <Smartphone className="w-4 h-4 text-gray-400 mr-2" />
                      {pkg.phoneCount?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        {pkg.conversionRate >= 200 ? (
                          <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        ) : pkg.conversionRate >= 160 ? (
                          <TrendingUp className="w-4 h-4 text-yellow-500 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                        )}
                        <span className={tableTextStyles.primary}>{Math.round(pkg.conversionRate || 0)}</span>
                      </div>
                      {pkg.conversionRate >= 160 && (
                        <span className="text-xs text-amber-700 bg-gradient-to-r from-amber-100 to-yellow-100 px-2 py-1 rounded-full border border-amber-200 font-medium">
                          保本线
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <div className="flex items-center">
                      {pkg.grade === 'S' && <Star className="w-4 h-4 text-yellow-500 mr-1" />}
                      {pkg.grade === 'A' && <Award className="w-4 h-4 text-blue-500 mr-1" />}
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${getGradeColor(pkg.grade)}`}>
                        {getGradeText(pkg.grade)}
                      </span>
                    </div>
                  </td>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <div className={`flex items-center ${tableTextStyles.secondary}`}>
                      <Building className="w-4 h-4 text-gray-400 mr-2" />
                      {pkg.smsProvider || '-'}
                    </div>
                  </td>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <div className={`flex items-center ${tableTextStyles.secondary}`}>
                      <FileText className="w-4 h-4 text-gray-400 mr-2" />
                      {pkg.source || '-'}
                    </div>
                  </td>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <div className={`flex items-center ${tableTextStyles.secondary}`}>
                      <Globe className="w-4 h-4 text-gray-400 mr-2" />
                      {pkg.gamePlatform || '-'}
                    </div>
                  </td>
                  <td className={`${tableStyles.td} ${tableRowHeights.comfortable}`}>
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${getStatusColor(pkg.status)}`}>
                      {pkg.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {pkg.status === 'processing' && <Clock className="w-3 h-3 mr-1" />}
                      {pkg.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                      {getStatusText(pkg.status)}
                    </span>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-sm font-medium min-w-[140px] w-36">
                    <div className="flex items-center space-x-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => {
                          setSelectedPackage(pkg.id)
                          setShowPackageDetail(true)
                        }}
                        className="text-indigo-600 hover:text-white hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-500 hover:shadow-md hover:scale-105"
                      >
                        查看
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Download}
                        className="text-emerald-600 hover:text-white hover:bg-gradient-to-r hover:from-emerald-500 hover:to-green-500 hover:shadow-md hover:scale-105"
                      >
                        导出
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-gray-500">
                <Package className="w-24 h-24 mb-6 opacity-30" />
                <h3 className="text-2xl font-semibold mb-3">暂无号码包</h3>
                <p className="text-base text-center mb-8 max-w-md">
                  还没有上传任何号码包，点击上方"上传号码包"按钮开始使用系统进行号码包管理和分析
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  icon={Upload}
                  onClick={() => setShowUploadForm(true)}
                  className="hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  上传第一个号码包
                </Button>
              </div>
            )}
          </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="bg-white/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between border-t border-gray-200/50 rounded-b-xl">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-indigo-500" />
              <p className="text-sm text-gray-600">
                显示第 <span className="font-semibold text-indigo-600">{(currentPage - 1) * itemsPerPage + 1}</span> 到{' '}
                <span className="font-semibold text-indigo-600">
                  {Math.min(currentPage * itemsPerPage, filteredPackages.length)}
                </span>{' '}
                条，共 <span className="font-semibold text-indigo-600">{filteredPackages.length}</span> 条记录
              </p>
            </div>
            <div>
              <nav className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-300 hover:text-indigo-600 shadow-sm hover:shadow-md"
                >
                  上一页
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page
                    if (totalPages <= 5) {
                      page = i + 1
                    } else if (currentPage <= 3) {
                      page = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i
                    } else {
                      page = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${
                          currentPage === page
                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105'
                            : 'text-gray-600 bg-white border border-gray-300 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-300 hover:text-indigo-600 hover:scale-105'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:border-indigo-300 hover:text-indigo-600 shadow-sm hover:shadow-md"
                >
                  下一页
                </Button>
              </nav>
            </div>
          </div>
        )}
      </div>



      {/* 包详情模态框 */}
      {showPackageDetail && selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {(() => {
              const pkg = packages.find(p => p.id === selectedPackage)
              if (!pkg) return null

              const gradeStyle = getGradeStyle(pkg.grade)
              const statusStyle = getStatusStyle(pkg.status)
              const GradeIcon = gradeStyle.icon

              return (
                <>
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">包详情</h3>
                      <button
                        onClick={() => setShowPackageDetail(false)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 基本信息 */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900">基本信息</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-500">包名称</label>
                            <div className="text-base text-gray-900">{pkg.name}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">描述</label>
                            <div className="text-base text-gray-900">{pkg.description}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">文件信息</label>
                            <div className="text-base text-gray-900">{pkg.fileName}</div>
                            <div className="text-sm text-gray-500">{formatFileSize(pkg.fileSize)}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">上传时间</label>
                            <div className="text-base text-gray-900">{formatDate(pkg.uploadTime)}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">状态</label>
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${statusStyle.dot}`}></div>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                {pkg.status === 'completed' ? '已完成' : 
                                 pkg.status === 'processing' ? '处理中' : '失败'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 转化数据 */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900">转化数据</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-500">评级</label>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${gradeStyle.bg} ${gradeStyle.text} ${gradeStyle.border} border`}>
                                <GradeIcon className="w-4 h-4 mr-1" />
                                {pkg.grade}级
                              </span>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">万分转化数</label>
                            <div className={`text-2xl font-bold ${pkg.conversionRate >= 16 ? 'text-green-600' : 'text-red-600'}`}>
                              {Math.round(pkg.conversionRate)}‱
                            </div>
                            {pkg.conversionRate >= 16 && (
                              <div className="text-sm text-green-600 font-medium">保本线以上</div>
                            )}
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">总号码数</label>
                            <div className="text-lg text-gray-900">{pkg.phoneCount.toLocaleString()}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">首充人数</label>
                            <div className="text-lg text-gray-900">{pkg.firstChargeCount.toLocaleString()}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">转化率</label>
                            <div className="text-lg text-gray-900">
                              {((pkg.firstChargeCount / pkg.phoneCount) * 100).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 发送信息 */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900">发送信息</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-500">发送时间</label>
                            <div className="text-base text-gray-900">{pkg.sendTime}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">短信商</label>
                            <div className="text-base text-gray-900">{pkg.smsProvider}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">来源</label>
                            <div className="text-base text-gray-900">{pkg.source}</div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-500">国家</label>
                            <div className="text-base text-gray-900">{getCountryInfo(pkg.country)}</div>
                          </div>
                        </div>
                      </div>

                      {/* 平台信息 */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-medium text-gray-900">平台信息</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-500">游戏平台</label>
                            <div className="text-base text-gray-900">{pkg.gamePlatform}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                    <Button
                      variant="secondary"
                      onClick={() => setShowPackageDetail(false)}
                    >
                      关闭
                    </Button>
                    <Button variant="primary">
                      导出详情
                    </Button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

export default PackageManagement