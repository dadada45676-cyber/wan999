import { create } from 'zustand'
import { PackageService, FileUploadService } from '../services/package'
import { ReportService } from '../services/report'
import { SettingsService } from '../services/settings'
import { log as logger } from '../utils/logger'
import type { 
  PhonePackage, 
  PhoneRating, 
  PhoneScore, 
  Report, 
  SystemSettings,
  EditPackageForm
} from '../types'
import { ConfigService } from '../services/configService'
import { ConfigHotReloadManager } from '../services/configHotReloadManager'
import { antiFalsePositiveService } from '../services/antiFalsePositiveService'
import { comprehensiveScoringService, type ComprehensiveScoringResult, type BatchScoringRequest } from '../services/comprehensiveScoringService'
import { finalGradeAssessmentService, type FinalGradeAssessmentResult, type BatchGradeAssessmentRequest } from '../services/finalGradeAssessmentService'
import { supabase } from '../lib/supabase'

// 创建配置服务实例
const configService = ConfigService.getInstance()

// 创建热更新管理器实例
const hotReloadManager = ConfigHotReloadManager.getInstance({
  enableAutoRecalculation: true,
  enableNotifications: true,
  maxConcurrentRecalculations: 2,
  watcher: {
    enableRealTimeUpdates: true,
    pollInterval: 5000
  },
  recalculation: {
    batchSize: 100,
    maxConcurrency: 3,
    enableProgressReporting: true
  }
})

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
  calculatePhoneScore: (phoneNumber: string, packageId?: string) => Promise<number>
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
  loadSystemSettings: () => Promise<SystemSettings | null>
  saveSystemSettings: (settings: Partial<SystemSettings>) => Promise<SystemSettings>
  resetSystemSettings: () => Promise<SystemSettings>
  updateCategorySettings: (category: string, categorySettings: Record<string, any>) => Promise<SystemSettings | null>
  
  // 评级分数映射相关方法
  loadRatingScoreMapping: () => Promise<Record<string, number>>
  updateRatingScoreMapping: (scoreMap: Record<string, number>) => Promise<Record<string, number>>
  resetRatingScoreMappingToDefault: () => Promise<Record<string, number>>
  validateRatingScoreMapping: (scoreMap: Record<string, number>) => { isValid: boolean; errors: Record<string, string> }
  
  // 配置验证相关方法
  validateAllConfigs: () => Promise<{
    overall: { isValid: boolean; errors: string[]; warnings: string[] };
    details: Record<string, { isValid: boolean; errors: string[]; warnings: string[] }>;
  }>
  getConfigStatus: () => Promise<{
    cacheStatus: Record<string, boolean>;
    lastUpdated: Record<string, string>;
    validation: {
      overall: { isValid: boolean; errors: string[]; warnings: string[] };
      details: Record<string, { isValid: boolean; errors: string[]; warnings: string[] }>;
    };
  }>
  reloadConfigs: () => Promise<void>
  
  // 配置热更新相关方法
  startConfigHotReload: () => Promise<void>
  stopConfigHotReload: () => Promise<void>
  getHotReloadStatus: () => {
    isActive: boolean;
    watcherStatus: any;
    activeRecalculations: any[];
    lastConfigChange?: Date;
    totalConfigChanges: number;
    totalRecalculations: number;
  }
  triggerManualRecalculation: (configTypes?: ('package_grades' | 'phone_ratings' | 'final_grades' | 'all')[]) => Promise<void>
  
  // 防误杀机制相关方法
  checkAntiFalsePositive: (phoneNumber: string, packageId?: string) => Promise<{
    shouldCalculateScore: boolean
    reason: string
    packageCount: number
    ratingCount: number
    threshold: number
    minRatingCount: number
  }>
  batchCheckAntiFalsePositive: (phoneNumbers: string[], packageId?: string) => Promise<Record<string, any>>
  getAntiFalsePositiveStats: (packageId?: string) => Promise<{
    totalPhones: number
    passedPhones: number
    blockedPhones: number
    passRate: number
    blockedReasons: Record<string, number>
  }>
  validateAntiFalsePositiveConfig: (config: { threshold: number; enabled: boolean; description: string }) => {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }
  
  // 综合评分计算相关方法
  calculateComprehensiveScore: (phoneNumber: string, packageId?: string) => Promise<ComprehensiveScoringResult>
  batchCalculateComprehensiveScore: (request: BatchScoringRequest) => Promise<{
    results: ComprehensiveScoringResult[]
    summary: {
      totalProcessed: number
      successCount: number
      failureCount: number
      antiFalsePositiveTriggered: number
      averageScore: number
    }
  }>
  getComprehensiveScoringStats: (packageId?: string) => Promise<{
    totalNumbers: number
    scoredNumbers: number
    averageScore: number
    maxScore: number
    minScore: number
    scoreDistribution: Record<string, number>
  }>
  
  // 最终等级评定相关方法
  assessFinalGrade: (phoneNumber: string, packageId?: string, updateDatabase?: boolean) => Promise<FinalGradeAssessmentResult>
  batchAssessFinalGrade: (request: BatchGradeAssessmentRequest) => Promise<{
    results: FinalGradeAssessmentResult[]
    summary: {
      totalProcessed: number
      successCount: number
      failureCount: number
      gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
      averageScore: number
      gradeChanges: number
    }
  }>
  getGradeStatistics: (packageId?: string) => Promise<{
    totalNumbers: number
    gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
    averageScore: number
    scoreDistribution: Record<string, number>
    gradePercentages: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
  }>
  reassessAllGrades: (packageId?: string) => Promise<{
    totalProcessed: number
    successCount: number
    failureCount: number
    gradeChanges: number
  }>
  
  // 操作方法 - UI状态
  setLoading: (loading: boolean) => void
  setSelectedPackageId: (id: string | null) => void
  setUploadProgress: (progress: number) => void
  
  // 业务逻辑方法（现在都是异步的）
  calculateConversionRate: (firstChargeCount: number, phoneCount: number) => number
  getPackageGrade: (conversionRate: number) => Promise<'A' | 'B' | 'C' | 'D' | 'E'>
  getRatingScore: (rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D') => Promise<number>
  getFinalGrade: (averageScore: number) => Promise<'A' | 'B' | 'C' | 'D' | 'E'>
  
  // 异步业务逻辑方法
  getPackageGradeAsync: (conversionRate: number) => Promise<'A' | 'B' | 'C' | 'D' | 'E'>
  getRatingScoreAsync: (rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D') => Promise<number>
  getFinalGradeAsync: (averageScore: number) => Promise<'A' | 'B' | 'C' | 'D' | 'E'>
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
      unit: '万分转化数',
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
    countryOptions: ['中国', '美国', '英国', '日本', '韩国'],
    ratingOptions: ['1星', '2星', '3星', '4星', '5星'],
    smsProviders: ['移动', '联通', '电信', '虚拟运营商'],
    sources: ['来源1', '来源2', '来源3', '来源4'],
    gamePlatforms: ['平台A', '平台B', '平台C', '平台D'],
    minRatingCount: 3,
    timeDecayFactor: 0.01,
    ratingScoreMap: {
      'SS': 100,
      'S': 90,
      'A': 80,
      'B': 70,
      'C': 60,
      'D': 50
    },
    antiFalsePositiveConfig: {
      threshold: 0.8,
      enabled: true,
      description: '防误判配置，用于提高评级准确性'
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
      logger.error('加载号码包失败', error, 'AppStore')
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
      logger.error('创建号码包失败', error, 'AppStore')
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
      logger.error('更新号码包失败', error, 'AppStore')
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
      logger.error('删除号码包失败', error, 'AppStore')
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
      logger.error('文件上传失败', error, 'AppStore')
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
      logger.error('加载号码评级失败', error, 'AppStore')
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
      logger.error('创建号码评级失败', error, 'AppStore')
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
      logger.error('加载号码评分失败', error, 'AppStore')
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
      logger.error('更新号码评分失败', error, 'AppStore')
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
      logger.error('保存号码评分失败', error, 'AppStore')
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
        logger.error('加载报告失败', response.error, 'AppStore')
        set({ loading: false })
        return false
      }
    } catch (error) {
      logger.error('加载报告失败', error, 'AppStore')
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
      logger.error('生成报告失败', error, 'AppStore')
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
      logger.error('删除报告失败', error, 'AppStore')
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
      logger.error('下载报告失败', error, 'AppStore')
      return null
    }
  },
  
  getReportStats: async () => {
    try {
      return await ReportService.getReportStats()
    } catch (error) {
      logger.error('获取报告统计失败', error, 'AppStore')
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
      set({ settings, loading: false })
      return settings
    } catch (error) {
      logger.error('加载系统设置失败', error, 'Store')
      set({ loading: false })
      throw error
    }
  },

  saveSystemSettings: async (settings: Partial<SystemSettings>) => {
    try {
      set({ loading: true })
      const updatedSettings = await SettingsService.updateSystemSettings(settings)
      set({ settings: updatedSettings, loading: false })
      return updatedSettings
    } catch (error) {
      logger.error('保存系统设置失败', error, 'Store')
      set({ loading: false })
      throw error
    }
  },

  resetSystemSettings: async () => {
    try {
      set({ loading: true })
      const defaultSettings = await SettingsService.resetSystemSettings()
      set({ settings: defaultSettings, loading: false })
      return defaultSettings
    } catch (error) {
      logger.error('重置系统设置失败', error, 'Store')
      set({ loading: false })
      throw error
    }
  },

  updateCategorySettings: async (category: string, categorySettings: Record<string, any>) => {
    try {
      set({ loading: true })
      const success = await SettingsService.updateCategorySettings(category, categorySettings)
      if (success) {
        // 重新获取完整的设置
        const updatedSettings = await SettingsService.getSystemSettings()
        if (updatedSettings) {
          set({ settings: updatedSettings, loading: false })
          return updatedSettings
        }
      }
      set({ loading: false })
      return null
    } catch (error) {
      logger.error('更新分类设置失败', error, 'AppStore')
      set({ loading: false })
      return null
    }
  },

  // 评级分数映射相关方法
  loadRatingScoreMapping: async () => {
    try {
      const scoreMap = await configService.getRatingScoreMap()
      // 转换为 Record<string, number> 格式
      return {
        'SS': scoreMap.SS,
        'S': scoreMap.S,
        'A': scoreMap.A,
        'B': scoreMap.B,
        'C': scoreMap.C,
        'D': scoreMap.D
      }
    } catch (error) {
      logger.error('加载评级分数映射失败', error, 'Store')
      // 返回默认映射
      return {
        'SS': 100, 'S': 90, 'A': 80, 'B': 70, 'C': 60, 'D': 50
      }
    }
  },

  updateRatingScoreMapping: async (scoreMap: Record<string, number>) => {
    try {
      await configService.updateConfig('rating_score_map', scoreMap)
      return scoreMap
    } catch (error) {
      logger.error('更新评级分数映射失败', error, 'Store')
      throw error
    }
  },

  resetRatingScoreMappingToDefault: async () => {
    try {
      const defaultScoreMap = {
        'SS': 100, 'S': 90, 'A': 80, 'B': 70, 'C': 60, 'D': 50
      }
      await configService.updateConfig('rating_score_map', defaultScoreMap)
      return defaultScoreMap
    } catch (error) {
      logger.error('重置评级分数映射失败', error, 'Store')
      throw error
    }
  },

  validateRatingScoreMapping: (scoreMap: Record<string, number>) => {
    const errors: Record<string, string> = {}
    const requiredRatings = ['SS', 'S', 'A', 'B', 'C', 'D']
    
    // 检查必需的评级是否存在
    for (const rating of requiredRatings) {
      if (!(rating in scoreMap)) {
        errors[rating] = `缺少评级 ${rating} 的分数配置`
      } else if (typeof scoreMap[rating] !== 'number' || scoreMap[rating] < 0 || scoreMap[rating] > 100) {
        errors[rating] = `评级 ${rating} 的分数必须是 0-100 之间的数字`
      }
    }
    
    // 检查分数是否递减
    const ratings = ['SS', 'S', 'A', 'B', 'C', 'D']
    for (let i = 0; i < ratings.length - 1; i++) {
      const current = ratings[i]
      const next = ratings[i + 1]
      if (scoreMap[current] && scoreMap[next] && scoreMap[current] <= scoreMap[next]) {
        errors[current] = `评级 ${current} 的分数应该高于 ${next}`
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  },

  // UI状态操作方法
  setLoading: (loading: boolean) => set({ loading }),
  setSelectedPackageId: (id: string | null) => set({ selectedPackageId: id }),
  setUploadProgress: (progress: number) => set({ uploadProgress: progress }),
  
  // 业务逻辑方法
  calculateConversionRate: (firstChargeCount: number, phoneCount: number) => {
    if (phoneCount === 0) return 0
    return (firstChargeCount / phoneCount) * 100
  },
  
  // 业务逻辑函数 - 统一使用配置服务
  getPackageGrade: async (conversionRate: number): Promise<'A' | 'B' | 'C' | 'D' | 'E'> => {
    try {
      const thresholds = await configService.getPackageGradeThresholds()
      
      // 按照从高到低的顺序检查阈值
      if (conversionRate >= thresholds.A.min) return 'A'
      if (conversionRate >= thresholds.B.min) return 'B'
      if (conversionRate >= thresholds.C.min) return 'C'
      if (conversionRate >= thresholds.D.min) return 'D'
      return 'E'
    } catch (error) {
      logger.error('获取号码包评级失败', error)
      // 使用默认阈值作为后备
      if (conversionRate >= 50) return 'A'
      if (conversionRate >= 30) return 'B'
      if (conversionRate >= 20) return 'C'
      if (conversionRate >= 16) return 'D'
      return 'E'
    }
  },
  
  // 保留同步版本以兼容现有代码，但标记为已弃用
  getPackageGradeSync: (conversionRate: number) => {
    // 使用默认阈值进行同步计算
    if (conversionRate >= 50) return 'A'
    if (conversionRate >= 30) return 'B'
    if (conversionRate >= 20) return 'C'
    if (conversionRate >= 16) return 'D'
    return 'E'
  },
  
  getPackageGradeAsync: async (conversionRate: number): Promise<'A' | 'B' | 'C' | 'D' | 'E'> => {
    // 重定向到主要的异步方法
    return get().getPackageGrade(conversionRate)
  },
  
  getRatingScore: async (rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'): Promise<number> => {
    try {
      const scoreMap = await configService.getRatingScoreMap()
      return scoreMap[rating] || 0
    } catch (error) {
      logger.error('获取评级分数失败', error)
      // 使用默认分数映射作为后备
      const defaultScores: Record<string, number> = {
        'SS': 100, 'S': 90, 'A': 80, 'B': 70, 'C': 60, 'D': 50
      }
      return defaultScores[rating] || 0
    }
  },

  // 保留同步版本以兼容现有代码，但标记为已弃用
  getRatingScoreSync: (rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D') => {
    // 使用默认分数映射进行同步计算
    const defaultScores: Record<string, number> = {
      'SS': 100, 'S': 90, 'A': 80, 'B': 70, 'C': 60, 'D': 50
    }
    return defaultScores[rating] || 0
  },

  getRatingScoreAsync: async (rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'): Promise<number> => {
    // 重定向到主要的异步方法
    return get().getRatingScore(rating)
  },
  
  getFinalGrade: async (averageScore: number): Promise<'A' | 'B' | 'C' | 'D' | 'E'> => {
    try {
      const gradeConfig = await configService.getFinalGradeConfig()
      
      for (const grade of gradeConfig) {
        if (averageScore >= grade.minScore && averageScore <= grade.maxScore) {
          return grade.name as 'A' | 'B' | 'C' | 'D' | 'E'
        }
      }
      return 'E'
    } catch (error) {
      logger.error('获取最终等级失败', error)
      // 使用默认等级配置作为后备
      if (averageScore >= 90) return 'A'
      if (averageScore >= 80) return 'B'
      if (averageScore >= 70) return 'C'
      if (averageScore >= 60) return 'D'
      return 'E'
    }
  },

  // 保留同步版本以兼容现有代码，但标记为已弃用
  getFinalGradeSync: (averageScore: number) => {
    // 使用默认等级配置进行同步计算
    if (averageScore >= 90) return 'A'
    if (averageScore >= 80) return 'B'
    if (averageScore >= 70) return 'C'
    if (averageScore >= 60) return 'D'
    return 'E'
  },

  getFinalGradeAsync: async (averageScore: number): Promise<'A' | 'B' | 'C' | 'D' | 'E'> => {
    // 重定向到主要的异步方法
    return get().getFinalGrade(averageScore)
  },

  calculatePhoneScore: async (phoneNumber: string, packageId?: string): Promise<number> => {
    try {
      // 使用防误杀服务检查是否应该计算评分
      const antiFalsePositiveResult = await antiFalsePositiveService.checkAntiFalsePositive(phoneNumber, packageId)
      
      if (!antiFalsePositiveResult.shouldCalculateScore) {
        logger.info(`号码 ${phoneNumber} 防误杀检查未通过: ${antiFalsePositiveResult.reason}`)
        return 0
      }

      // 获取算法配置
      const algorithmConfig = await configService.getScoringAlgorithmConfig()
  
      // 获取该号码的评级历史
      const { data: ratingHistory, error } = await supabase
        .from('phone_ratings')
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: false })
  
      if (error) {
        logger.error('获取号码评级历史失败', error)
        return 0
      }
  
      if (!ratingHistory || ratingHistory.length === 0) {
        return 0 // 没有评级历史
      }
  
      // 根据算法类型计算分数
      let finalScore = 0
  
      switch (algorithmConfig.type) {
        case 'simple':
          // 简单平均
          finalScore = ratingHistory.reduce((sum, r) => sum + r.rating_score, 0) / ratingHistory.length
          break
  
        case 'weighted':
          // 加权平均（最近的评级权重更高）
          const weights = algorithmConfig.weights || { recent: 0.7, historical: 0.3 }
          const recentCount = Math.ceil(ratingHistory.length * 0.3) // 最近30%的评级
          
          const recentRatings = ratingHistory.slice(0, recentCount)
          const historicalRatings = ratingHistory.slice(recentCount)
          
          const recentAvg = recentRatings.reduce((sum, r) => sum + r.rating_score, 0) / recentRatings.length
          const historicalAvg = historicalRatings.length > 0 
            ? historicalRatings.reduce((sum, r) => sum + r.rating_score, 0) / historicalRatings.length 
            : recentAvg
          
          finalScore = recentAvg * weights.recent + historicalAvg * weights.historical
          break
  
        case 'time_decay':
          // 时间衰减算法
          const decayFactor = algorithmConfig.timeDecayFactor || 0.1
          const now = new Date()
          let totalWeight = 0
          let weightedSum = 0
          
          ratingHistory.forEach(rating => {
            const daysDiff = Math.floor((now.getTime() - new Date(rating.created_at).getTime()) / (1000 * 60 * 60 * 24))
            const weight = Math.exp(-decayFactor * daysDiff)
            weightedSum += rating.rating_score * weight
            totalWeight += weight
          })
          
          finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0
          break
  
        default:
          // 默认使用简单平均
          finalScore = ratingHistory.reduce((sum, r) => sum + r.rating_score, 0) / ratingHistory.length
      }

      logger.info(`号码 ${phoneNumber} 评分计算完成`, {
        finalScore,
        ratingCount: ratingHistory.length,
        packageCount: antiFalsePositiveResult.packageCount,
        algorithm: algorithmConfig.type
      })
  
      return Math.round(finalScore * 100) / 100 // 保留两位小数
    } catch (error) {
      logger.error('计算号码评分失败', error)
      return 0
    }
  },

  // 配置验证相关方法
  validateAllConfigs: async () => {
    try {
      return await configService.validateAllConfigs()
    } catch (error) {
      logger.error('验证所有配置失败', error, 'AppStore')
      return {
        overall: {
          isValid: false,
          errors: ['配置验证失败'],
          warnings: []
        },
        details: {}
      }
    }
  },

  getConfigStatus: async () => {
    try {
      return await configService.getConfigStatus()
    } catch (error) {
      logger.error('获取配置状态失败', error, 'AppStore')
      return {
        cacheStatus: {},
        lastUpdated: {},
        validation: {
          overall: {
            isValid: false,
            errors: ['获取配置状态失败'],
            warnings: []
          },
          details: {}
        }
      }
    }
  },

  reloadConfigs: async () => {
    try {
      set({ loading: true })
      await configService.reloadConfigs()
      logger.info('配置重新加载成功', {}, 'AppStore')
      set({ loading: false })
    } catch (error) {
      logger.error('重新加载配置失败', error, 'AppStore')
      set({ loading: false })
      throw error
    }
  },

  // 配置热更新相关方法
  startConfigHotReload: async () => {
    try {
      await hotReloadManager.start()
      logger.info('配置热更新已启动', {}, 'AppStore')
    } catch (error) {
      logger.error('启动配置热更新失败', error, 'AppStore')
      throw error
    }
  },

  stopConfigHotReload: async () => {
    try {
      await hotReloadManager.stop()
      logger.info('配置热更新已停止', {}, 'AppStore')
    } catch (error) {
      logger.error('停止配置热更新失败', error, 'AppStore')
      throw error
    }
  },

  getHotReloadStatus: () => {
    return hotReloadManager.getStatus()
  },

  triggerManualRecalculation: async (configTypes) => {
    try {
      set({ loading: true })
      
      if (!configTypes || configTypes.length === 0) {
        // 默认触发所有类型的重算
        await hotReloadManager.triggerRecalculation('all')
      } else {
        // 逐个触发每种类型的重算
        for (const type of configTypes) {
          await hotReloadManager.triggerRecalculation(type)
        }
      }
      
      logger.info('手动重算触发成功', { configTypes }, 'AppStore')
      set({ loading: false })
    } catch (error) {
      logger.error('手动重算触发失败', error, 'AppStore')
      set({ loading: false })
      throw error
    }
  },

  // 防误杀机制相关方法
  checkAntiFalsePositive: async (phoneNumber: string, packageId?: string) => {
    try {
      return await antiFalsePositiveService.checkAntiFalsePositive(phoneNumber, packageId)
    } catch (error) {
      logger.error('防误杀检查失败', error, 'AppStore')
      throw error
    }
  },

  batchCheckAntiFalsePositive: async (phoneNumbers: string[], packageId?: string) => {
    try {
      return await antiFalsePositiveService.batchCheckAntiFalsePositive(phoneNumbers, packageId)
    } catch (error) {
      logger.error('批量防误杀检查失败', error, 'AppStore')
      throw error
    }
  },

  getAntiFalsePositiveStats: async (packageId?: string) => {
    try {
      return await antiFalsePositiveService.getAntiFalsePositiveStats(packageId)
    } catch (error) {
      logger.error('获取防误杀统计失败', error, 'AppStore')
      throw error
    }
  },

  validateAntiFalsePositiveConfig: (config: { threshold: number; enabled: boolean; description: string }) => {
    try {
      return antiFalsePositiveService.validateAntiFalsePositiveConfig(config)
    } catch (error) {
      logger.error('验证防误杀配置失败', error, 'AppStore')
      return {
        isValid: false,
        errors: ['验证防误杀配置失败'],
        warnings: []
      }
    }
  },

  // 综合评分计算相关方法
  calculateComprehensiveScore: async (phoneNumber: string, packageId?: string): Promise<ComprehensiveScoringResult> => {
    try {
      return await comprehensiveScoringService.calculateComprehensiveScore(phoneNumber, packageId)
    } catch (error) {
      logger.error('计算综合评分失败', error, 'AppStore')
      throw error
    }
  },

  batchCalculateComprehensiveScore: async (request: BatchScoringRequest) => {
    try {
      set({ loading: true })
      const result = await comprehensiveScoringService.batchCalculateComprehensiveScore(request)
      set({ loading: false })
      return result
    } catch (error) {
      logger.error('批量计算综合评分失败', error, 'AppStore')
      set({ loading: false })
      throw error
    }
  },

  getComprehensiveScoringStats: async (packageId?: string) => {
    try {
      return await comprehensiveScoringService.getComprehensiveScoringStats(packageId)
    } catch (error) {
      logger.error('获取综合评分统计失败', error, 'AppStore')
      throw error
    }
  },

  // 最终等级评定相关方法
  assessFinalGrade: async (phoneNumber: string, packageId?: string, updateDatabase: boolean = false): Promise<FinalGradeAssessmentResult> => {
    try {
      return await finalGradeAssessmentService.assessFinalGrade(phoneNumber, packageId, updateDatabase)
    } catch (error) {
      logger.error('评定最终等级失败', error, 'AppStore')
      throw error
    }
  },

  batchAssessFinalGrade: async (request: BatchGradeAssessmentRequest) => {
    try {
      set({ loading: true })
      const result = await finalGradeAssessmentService.batchAssessFinalGrade(request)
      set({ loading: false })
      return result
    } catch (error) {
      logger.error('批量评定最终等级失败', error, 'AppStore')
      set({ loading: false })
      throw error
    }
  },

  getGradeStatistics: async (packageId?: string) => {
    try {
      return await finalGradeAssessmentService.getGradeStatistics(packageId)
    } catch (error) {
      logger.error('获取等级统计失败', error, 'AppStore')
      throw error
    }
  },

  reassessAllGrades: async (packageId?: string) => {
    try {
      set({ loading: true })
      const result = await finalGradeAssessmentService.reassessAllGrades(packageId)
      set({ loading: false })
      return result
    } catch (error) {
      logger.error('重新评定所有等级失败', error, 'AppStore')
      set({ loading: false })
      throw error
    }
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
  updateCategorySettings: state.updateCategorySettings,
  // 评级分数映射相关方法
  loadRatingScoreMapping: state.loadRatingScoreMapping,
  updateRatingScoreMapping: state.updateRatingScoreMapping,
  resetRatingScoreMappingToDefault: state.resetRatingScoreMappingToDefault,
  validateRatingScoreMapping: state.validateRatingScoreMapping,
  // 配置验证相关方法
  validateAllConfigs: state.validateAllConfigs,
  getConfigStatus: state.getConfigStatus,
  reloadConfigs: state.reloadConfigs,
  // 配置热更新相关方法
  startConfigHotReload: state.startConfigHotReload,
  stopConfigHotReload: state.stopConfigHotReload,
  getHotReloadStatus: state.getHotReloadStatus,
  triggerManualRecalculation: state.triggerManualRecalculation,
  // 防误杀机制相关方法
  checkAntiFalsePositive: state.checkAntiFalsePositive,
  batchCheckAntiFalsePositive: state.batchCheckAntiFalsePositive,
  getAntiFalsePositiveStats: state.getAntiFalsePositiveStats,
  validateAntiFalsePositiveConfig: state.validateAntiFalsePositiveConfig,
  // 综合评分计算相关方法
  calculateComprehensiveScore: state.calculateComprehensiveScore,
  batchCalculateComprehensiveScore: state.batchCalculateComprehensiveScore,
  getComprehensiveScoringStats: state.getComprehensiveScoringStats,
  // 最终等级评定相关方法
  assessFinalGrade: state.assessFinalGrade,
  batchAssessFinalGrade: state.batchAssessFinalGrade,
  getGradeStatistics: state.getGradeStatistics,
  reassessAllGrades: state.reassessAllGrades
}))