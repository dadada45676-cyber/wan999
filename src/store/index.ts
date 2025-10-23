import { create } from 'zustand'
import { PackageService, FileUploadService } from '../services/package'
import { ReportService } from '../services/report'
import { SettingsService } from '../services/settings'
import { log } from '../utils/logger'
import type { 
  PhonePackage, 
  PhoneRating, 
  PhoneScore, 
  Report, 
  SystemSettings,
  EditPackageForm
} from '../types'

// 报告筛选类型
export interface ReportFilter {
  country?: string
  startDate?: string
  endDate?: string
  type?: string
}

// 报告生成请求类型
export interface ReportGenerateRequest {
  name: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  format: 'pdf' | 'excel' | 'csv'
  dataRange: {
    startDate: string
    endDate: string
  }
  country?: string
  packageIds?: string[]
  includeCharts?: boolean
  includeDetails?: boolean
}

// 应用状态类型
interface AppState {
  // 数据
  packages: PhonePackage[]
  phoneRatings: PhoneRating[]
  phoneScores: PhoneScore[]
  reports: Report[]
  settings: SystemSettings
  
  // UI状态
  loading: boolean
  selectedPackageId: string | null
  uploadProgress: number
  
  // 操作方法 - 号码包管理
  setPackages: (packages: PhonePackage[]) => void
  addPackage: (pkg: PhonePackage) => void
  updatePackage: (id: string, updates: Partial<PhonePackage>) => void
  deletePackage: (id: string) => void
  
  // 异步API方法 - 号码包管理
  loadPackages: (country?: string) => Promise<boolean>
  createPackage: (packageData: Omit<PhonePackage, 'id' | 'uploadTime'>) => Promise<boolean>
  updatePackageAsync: (id: string, updates: EditPackageForm) => Promise<boolean>
  deletePackageAsync: (id: string) => Promise<boolean>
  uploadPackageFile: (file: File, packageId: string) => Promise<string | null>
  
  // 操作方法 - 号码评级历史
  setPhoneRatings: (ratings: PhoneRating[]) => void
  addPhoneRating: (rating: PhoneRating) => void
  getPhoneRatingHistory: (phoneNumber: string) => PhoneRating[]
  
  // 异步API方法 - 号码评级历史
  loadPhoneRatings: (phoneNumber?: string, packageId?: string) => Promise<boolean>
  createPhoneRating: (rating: Omit<PhoneRating, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>
  
  // 号码综合评分管理
  setPhoneScores: (scores: PhoneScore[]) => void
  addPhoneScore: (score: PhoneScore) => void
  updatePhoneScore: (phoneNumber: string, updates: Partial<PhoneScore>) => void
  calculatePhoneScore: (phoneNumber: string) => void
  getPhonesByGrade: (grade: 'A' | 'B' | 'C' | 'D' | 'E') => PhoneScore[]
  
  // 异步API方法 - 号码综合评分
  loadPhoneScores: (country?: string, grade?: string) => Promise<boolean>
  updatePhoneScoreAsync: (phoneNumber: string, updates: Partial<PhoneScore>) => Promise<boolean>
  savePhoneScore: (score: Omit<PhoneScore, 'created_at' | 'updated_at'>) => Promise<boolean>
  
  // 操作方法 - 报告管理
  setReports: (reports: Report[]) => void
  addReport: (report: Report) => void
  
  // 异步API方法 - 报告管理
  loadReports: (filter?: ReportFilter) => Promise<boolean>
  generateReport: (request: ReportGenerateRequest) => Promise<boolean>
  deleteReportAsync: (reportId: string) => Promise<boolean>
  downloadReport: (reportId: string) => Promise<string | null>
  getReportStats: () => Promise<{
    totalReports: number
    totalDownloads: number
    totalSize: number
    recentReports: number
  } | null>
  
  // 操作方法 - 系统设置
  updateSettings: (settings: Partial<SystemSettings>) => void
  
  // 异步API方法 - 系统设置
  loadSystemSettings: () => Promise<boolean>
  saveSystemSettings: (settings: Partial<SystemSettings>) => Promise<boolean>
  resetSystemSettings: () => Promise<boolean>
  updateCategorySettings: (category: string, categorySettings: Record<string, any>) => Promise<boolean>
  
  // 操作方法 - UI状态
  setLoading: (loading: boolean) => void
  setSelectedPackageId: (id: string | null) => void
  setUploadProgress: (progress: number) => void
  
  // 业务逻辑方法
  calculateConversionRate: (firstChargeCount: number, phoneCount: number) => number
  getPackageGrade: (conversionRate: number) => 'A' | 'B' | 'C' | 'D' | 'E'
  getRatingScore: (rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D') => number
  getFinalGrade: (averageScore: number) => 'A' | 'B' | 'C' | 'D' | 'E'
}

// 创建store
export const useAppStore = create<AppState>((set, get) => ({
  // 初始数据
  packages: [],
  phoneRatings: [],
  phoneScores: [],
  reports: [],
  settings: {
    packageGradeThresholds: {
      'A': { min: 90, max: 100 },
      'B': { min: 80, max: 89 },
      'C': { min: 70, max: 79 },
      'D': { min: 60, max: 69 },
      'E': { min: 0, max: 59 }
    },
    breakEvenConfig: {
      threshold: 16,
      warningLine: 12,
      dangerLine: 8,
      unit: '万分之',
      description: '基于万分转化数的保本线配置'
    },
    finalGradeConfig: [
      { name: 'A', minScore: 90, maxScore: 100, color: '#4ade80' },
      { name: 'B', minScore: 80, maxScore: 89, color: '#60a5fa' },
      { name: 'C', minScore: 70, maxScore: 79, color: '#fbbf24' },
      { name: 'D', minScore: 60, maxScore: 69, color: '#f87171' },
      { name: 'E', minScore: 0, maxScore: 59, color: '#ef4444' }
    ],
    scoringAlgorithm: {
      type: 'weighted',
      weights: {
        ratingScore: 0.6,
        packageSize: 0.3,
        timeDecay: 0.1
      }
    },
    countryOptions: [
      { value: 'CN', label: '中国' },
      { value: 'US', label: '美国' },
      { value: 'UK', label: '英国' },
      { value: 'JP', label: '日本' },
      { value: 'KR', label: '韩国' }
    ],
    ratingOptions: [
      { value: 'SS', label: 'SS级 - 优秀' },
      { value: 'S', label: 'S级 - 良好' },
      { value: 'A', label: 'A级 - 一般' },
      { value: 'B', label: 'B级 - 较差' },
      { value: 'C', label: 'C级 - 很差' },
      { value: 'D', label: 'D级 - 极差' }
    ],
    minRatingCount: 3,
    timeDecayFactor: 0.01,
    ratingScoreMap: {
      'SS': 100,
      'S': 90,
      'A': 80,
      'B': 70,
      'C': 60,
      'D': 50
    }
  },
  
  // 初始UI状态
  loading: false,
  selectedPackageId: null,
  uploadProgress: 0,
  
  // 操作方法 - 号码包管理
  setPackages: (packages) => set({ packages }),
  addPackage: (pkg) => set((state) => ({ 
    packages: [...state.packages, pkg] 
  })),
  updatePackage: (id, updates) => set((state) => ({
    packages: state.packages.map(pkg => 
      pkg.id === id ? { ...pkg, ...updates } : pkg
    )
  })),
  deletePackage: (id) => set((state) => ({
    packages: state.packages.filter(pkg => pkg.id !== id)
  })),
  
  // 异步API方法 - 号码包管理
  loadPackages: async (country) => {
    try {
      set({ loading: true })
      const packages = await PackageService.getAllPackages(country)
      set({ packages, loading: false })
      return true
    } catch (error) {
      log.error('加载号码包失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  createPackage: async (packageData) => {
    try {
      set({ loading: true })
      // 转换为CreatePackageForm格式
      const createForm = {
        name: packageData.name,
        fileName: packageData.file_name,
        countryCode: packageData.country_code,
        smsProvider: packageData.sms_provider,
        source: packageData.source,
        gamePlatform: packageData.game_platform,
        sendTime: packageData.send_time,
        totalPhoneCount: packageData.phone_count,
        firstChargeCount: packageData.first_charge_count,
        conversionRate: packageData.conversion_rate,
        grade: packageData.grade,
        description: packageData.description,
        phoneNumbers: packageData.phoneNumbers
      }
      const response = await PackageService.createPackage(createForm)
      if (response.success && response.package) {
        set((state) => ({ 
          packages: [...state.packages, response.package!],
          loading: false 
        }))
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('创建号码包失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  updatePackageAsync: async (id, updates) => {
    try {
      set({ loading: true })
      const response = await PackageService.updatePackage(id, updates)
      if (response.success && response.package) {
        set((state) => ({
          packages: state.packages.map(pkg => 
            pkg.id === id ? response.package! : pkg
          ),
          loading: false
        }))
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('更新号码包失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  deletePackageAsync: async (id) => {
    try {
      set({ loading: true })
      const response = await PackageService.deletePackage(id)
      if (response.success) {
        set((state) => ({
          packages: state.packages.filter(pkg => pkg.id !== id),
          loading: false
        }))
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('删除号码包失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  uploadPackageFile: async (file, packageId) => {
    try {
      set({ uploadProgress: 0 })
      const response = await FileUploadService.uploadPackageFile(file, packageId)
      if (response.success && response.data) {
        set({ uploadProgress: 100 })
        return response.data
      } else {
        set({ uploadProgress: 0 })
        return null
      }
    } catch (error) {
      log.error('文件上传失败', error, 'AppStore')
      set({ uploadProgress: 0 })
      return null
    }
  },
  
  // 操作方法 - 号码评级历史
  setPhoneRatings: (phoneRatings) => set({ phoneRatings }),
  addPhoneRating: (rating) => set((state) => ({ 
    phoneRatings: [...state.phoneRatings, rating] 
  })),
  getPhoneRatingHistory: (phoneNumber) => {
    const state = get()
    return state.phoneRatings.filter(rating => rating.phoneNumber === phoneNumber)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },
  
  // 异步API方法 - 号码评级历史
  loadPhoneRatings: async (phoneNumber, packageId) => {
    try {
      set({ loading: true })
      const ratings = await PackageService.getPhoneRatings(phoneNumber, packageId)
      set({ phoneRatings: ratings, loading: false })
      return true
    } catch (error) {
      log.error('加载号码评级失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  createPhoneRating: async (rating) => {
    try {
      set({ loading: true })
      const newRating = await PackageService.addPhoneRating(rating)
      if (newRating) {
        set((state) => ({ 
          phoneRatings: [...state.phoneRatings, newRating],
          loading: false 
        }))
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('创建号码评级失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  // 号码综合评分管理
  setPhoneScores: (phoneScores) => set({ phoneScores }),
  addPhoneScore: (score) => set((state) => ({ 
    phoneScores: [...state.phoneScores, score] 
  })),
  updatePhoneScore: (phoneNumber, updates) => set((state) => ({
    phoneScores: state.phoneScores.map(score => 
      score.phone_number === phoneNumber ? { ...score, ...updates } : score
    )
  })),
  calculatePhoneScore: (phoneNumber) => {
    const state = get()
    const ratings = state.phoneRatings.filter(r => r.phone_number === phoneNumber)
    
    if (ratings.length < state.settings.minRatingCount) {
      // 评级次数不足，更新状态为待评级
      const existingScore = state.phoneScores.find(s => s.phone_number === phoneNumber)
      if (existingScore) {
        state.updatePhoneScore(phoneNumber, { 
          status: 'pending',
          rating_count: ratings.length 
        })
      }
      return
    }
    
    // 计算综合评分
    let averageScore = 0
    const algorithm = state.settings.scoringAlgorithm
    
    if (algorithm.type === 'simple') {
      // 简单平均
      averageScore = ratings.reduce((sum, r) => sum + r.rating_score, 0) / ratings.length
    } else if (algorithm.type === 'weighted') {
      // 加权平均（基于包规模）
      let totalWeightedScore = 0
      let totalWeight = 0
      ratings.forEach(r => {
        const weight = r.package_size / 10000
        totalWeightedScore += r.rating_score * weight
        totalWeight += weight
      })
      averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0
    } else if (algorithm.type === 'timeDecay') {
      // 时间衰减
      const currentDate = new Date()
      let totalWeightedScore = 0
      let totalWeight = 0
      ratings.forEach(r => {
        const daysDiff = Math.floor((currentDate.getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24))
        const timeWeight = Math.exp(-state.settings.timeDecayFactor * daysDiff)
        totalWeightedScore += r.rating_score * timeWeight
        totalWeight += timeWeight
      })
      averageScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0
    }
    
    const finalGrade = get().getFinalGrade(averageScore)
    const status = 'active' as const
    
    // 更新或添加评分记录
    const existingScore = state.phoneScores.find(s => s.phone_number === phoneNumber)
    if (existingScore) {
      get().updatePhoneScore(phoneNumber, {
        rating_count: ratings.length,
        average_score: averageScore,
        weighted_score: averageScore,
        time_decay_score: averageScore,
        final_grade: finalGrade,
        status,
        last_calculated: new Date().toISOString(),
        algorithm_type: algorithm.type
      })
    } else {
      set((state) => ({
        phoneScores: [...state.phoneScores, {
          id: Math.random().toString(36).substr(2, 9),
          phone_number: phoneNumber,
          country_code: ratings.length > 0 ? ratings[0].country_code : 'BR',
          rating_count: ratings.length,
          average_score: averageScore,
          weighted_score: averageScore, // 使用平均分作为加权分
          time_decay_score: averageScore, // 使用平均分作为时间衰减分
          final_grade: finalGrade,
          status: 'active',
          algorithm_type: algorithm.type,
          last_calculated: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // 保留旧字段名以兼容
          phoneNumber,
          country: ratings.length > 0 ? ratings[0].country_code : 'BR',
          ratingCount: ratings.length,
          averageScore,
          weightedScore: averageScore,
          timeDecayScore: averageScore,
          finalGrade,
          algorithmType: algorithm.type,
          lastCalculated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      }))
    }
  },
  getPhonesByGrade: (grade) => {
    const state = get()
    return state.phoneScores.filter(score => score.final_grade === grade && score.status === 'active')
  },
  
  // 异步API方法 - 号码综合评分
  loadPhoneScores: async (country, grade) => {
    try {
      set({ loading: true })
      const scores = await PackageService.getPhoneScores(country, grade)
      set({ phoneScores: scores, loading: false })
      return true
    } catch (error) {
      log.error('加载号码评分失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  updatePhoneScoreAsync: async (phoneNumber, updates) => {
    try {
      set({ loading: true })
      const updatedScore = await PackageService.updatePhoneScore(phoneNumber, updates)
      if (updatedScore) {
        set((state) => ({
          phoneScores: state.phoneScores.map(score => 
            score.phone_number === phoneNumber ? updatedScore : score
          ),
          loading: false
        }))
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('更新号码评分失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  savePhoneScore: async (score) => {
    try {
      set({ loading: true })
      const savedScore = await PackageService.upsertPhoneScore(score)
      if (savedScore) {
        set((state) => {
          const existingIndex = state.phoneScores.findIndex(s => s.phone_number === savedScore.phone_number)
          if (existingIndex >= 0) {
            return {
              phoneScores: state.phoneScores.map((s, i) => 
                i === existingIndex ? savedScore : s
              ),
              loading: false
            }
          } else {
            return {
              phoneScores: [...state.phoneScores, savedScore],
              loading: false
            }
          }
        })
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('保存号码评分失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  // 操作方法 - 报告管理
  setReports: (reports) => set({ reports }),
  addReport: (report) => set((state) => ({ 
    reports: [...state.reports, report] 
  })),
  
  // 异步API方法 - 报告管理
  loadReports: async (filter) => {
    try {
      set({ loading: true })
      const response = await ReportService.getAllReports(filter)
      if (response.success && response.data) {
        set({ reports: response.data, loading: false })
        return true
      } else {
        log.error('加载报告失败', response.error, 'AppStore')
        set({ loading: false })
        return false
      }
    } catch (error) {
      log.error('加载报告失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  generateReport: async (request) => {
    try {
      set({ loading: true })
      const response = await ReportService.generateReport(request)
      if (response.success && response.data) {
        set((state) => ({ 
          reports: [response.data!, ...state.reports],
          loading: false 
        }))
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('生成报告失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },

  deleteReportAsync: async (reportId) => {
    try {
      set({ loading: true })
      const response = await ReportService.deleteReport(reportId)
      if (response.success) {
        set((state) => ({
          reports: state.reports.filter(report => report.id !== reportId),
          loading: false
        }))
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('删除报告失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },

  downloadReport: async (reportId) => {
    try {
      const response = await ReportService.downloadReport(reportId)
      if (response.success && response.data) {
        return response.data
      }
      return null
    } catch (error) {
      log.error('下载报告失败', error, 'AppStore')
      return null
    }
  },
  
  getReportStats: async () => {
    try {
      return await ReportService.getReportStats()
    } catch (error) {
      log.error('获取报告统计失败', error, 'AppStore')
      return null
    }
  },
  
  // 操作方法 - 系统设置
  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
  
  // 异步API方法 - 系统设置
  loadSystemSettings: async () => {
    try {
      set({ loading: true })
      const settings = await SettingsService.getSystemSettings()
      if (settings) {
        set({ settings, loading: false })
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('加载系统设置失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  saveSystemSettings: async (settings) => {
    try {
      set({ loading: true })
      const updatedSettings = await SettingsService.updateSystemSettings(settings)
      if (updatedSettings) {
        set({ settings: updatedSettings, loading: false })
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('保存系统设置失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  resetSystemSettings: async () => {
    try {
      set({ loading: true })
      const defaultSettings = await SettingsService.resetSystemSettings()
      if (defaultSettings) {
        set({ settings: defaultSettings, loading: false })
        return true
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('重置系统设置失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  updateCategorySettings: async (category, categorySettings) => {
    try {
      set({ loading: true })
      const success = await SettingsService.updateCategorySettings(category, categorySettings)
      if (success) {
        // 重新加载设置以获取最新数据
        const updatedSettings = await SettingsService.getSystemSettings()
        if (updatedSettings) {
          set({ settings: updatedSettings, loading: false })
        } else {
          set({ loading: false })
        }
        return success
      }
      set({ loading: false })
      return false
    } catch (error) {
      log.error('更新分类设置失败', error, 'AppStore')
      set({ loading: false })
      return false
    }
  },
  
  // 操作方法 - UI状态
  setLoading: (loading) => set({ loading }),
  setSelectedPackageId: (id) => set({ selectedPackageId: id }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  
  // 业务逻辑方法
  calculateConversionRate: (firstChargeCount, phoneCount) => {
    if (phoneCount === 0) return 0
    return (firstChargeCount / phoneCount) * 10000
  },
  
  getPackageGrade: (conversionRate) => {
    const state = get()
    const thresholds = state.settings.packageGradeThresholds
    
    // 适应新的阈值结构 {A: {min: 90, max: 100}, ...}
    if (conversionRate >= thresholds.A.min) return 'A'
    if (conversionRate >= thresholds.B.min) return 'B'
    if (conversionRate >= thresholds.C.min) return 'C'
    if (conversionRate >= thresholds.D.min) return 'D'
    return 'E'
  },
  
  getRatingScore: (rating) => {
    const state = get()
    return state.settings.ratingScoreMap[rating] || 0
  },
  
  getFinalGrade: (averageScore) => {
    const state = get()
    const gradeConfig = state.settings.finalGradeConfig
    
    for (const grade of gradeConfig) {
      if (averageScore >= grade.minScore && averageScore <= grade.maxScore) {
        return grade.name as 'A' | 'B' | 'C' | 'D' | 'E'
      }
    }
    return 'E'
  }
}))

// 选择器函数
export const usePackages = () => useAppStore((state) => state.packages)
export const usePhoneRatings = () => useAppStore((state) => state.phoneRatings)
export const usePhoneScores = () => useAppStore((state) => state.phoneScores)
export const useReports = () => useAppStore((state) => state.reports)
export const useSettings = () => useAppStore((state) => state.settings)
export const useLoading = () => useAppStore((state) => state.loading)
export const useSelectedPackageId = () => useAppStore((state) => state.selectedPackageId)
export const useUploadProgress = () => useAppStore((state) => state.uploadProgress)

// 业务逻辑选择器
export const usePackageActions = () => useAppStore((state) => ({
  addPackage: state.addPackage,
  updatePackage: state.updatePackage,
  deletePackage: state.deletePackage,
  calculateConversionRate: state.calculateConversionRate,
  getPackageGrade: state.getPackageGrade,
  // 异步API方法
  loadPackages: state.loadPackages,
  createPackage: state.createPackage,
  updatePackageAsync: state.updatePackageAsync,
  deletePackageAsync: state.deletePackageAsync,
  uploadPackageFile: state.uploadPackageFile
}))

export const usePhoneActions = () => useAppStore((state) => ({
  addPhoneRating: state.addPhoneRating,
  addPhoneScore: state.addPhoneScore,
  getPhoneRatingHistory: state.getPhoneRatingHistory,
  calculatePhoneScore: state.calculatePhoneScore,
  updatePhoneScore: state.updatePhoneScore,
  getPhonesByGrade: state.getPhonesByGrade,
  getRatingScore: state.getRatingScore,
  getFinalGrade: state.getFinalGrade,
  // 异步API方法
  loadPhoneRatings: state.loadPhoneRatings,
  createPhoneRating: state.createPhoneRating,
  loadPhoneScores: state.loadPhoneScores,
  updatePhoneScoreAsync: state.updatePhoneScoreAsync,
  savePhoneScore: state.savePhoneScore
}))

export const useUIActions = () => useAppStore((state) => ({
  setLoading: state.setLoading,
  setSelectedPackageId: state.setSelectedPackageId,
  setUploadProgress: state.setUploadProgress
}))

export const useReportActions = () => useAppStore((state) => ({
  addReport: state.addReport,
  // 异步API方法
  loadReports: state.loadReports,
  generateReport: state.generateReport,
  deleteReportAsync: state.deleteReportAsync,
  downloadReport: state.downloadReport,
  getReportStats: state.getReportStats
}))

export const useSettingsActions = () => useAppStore((state) => ({
  updateSettings: state.updateSettings,
  // 异步API方法
  loadSystemSettings: state.loadSystemSettings,
  saveSystemSettings: state.saveSystemSettings,
  resetSystemSettings: state.resetSystemSettings,
  updateCategorySettings: state.updateCategorySettings
}))