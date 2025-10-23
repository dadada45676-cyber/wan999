// 统一类型导出文件
export * from './auth'
export * from './common'

// 服务响应接口
export interface ServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 系统设置接口
export interface SystemSettings {
  packageGradeThresholds: {
    [key: string]: { min: number; max: number }
  }
  breakEvenConfig: {
    threshold: number
    warningLine: number
    dangerLine: number
    unit: string
    description: string
  }
  finalGradeConfig: Array<{
    name: 'A' | 'B' | 'C' | 'D' | 'E'
    minScore: number
    maxScore: number
    color: string
  }>
  scoringAlgorithm: {
    type: 'simple' | 'weighted' | 'timeDecay'
    weights: {
      ratingScore: number
      packageSize: number
      timeDecay: number
    }
  }
  countryOptions: Array<{ value: string; label: string }>
  ratingOptions: Array<{ value: string; label: string }>
  minRatingCount: number
  timeDecayFactor: number
  ratingScoreMap: {
    [key: string]: number
  }
}

// 号码包相关类型
export interface PhonePackage {
  id: string
  name: string
  fileName: string
  country: string
  totalPhones: number
  validPhones: number
  invalidPhones: number
  duplicatePhones: number
  conversionRate: number
  packageRating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  sendTime: string
  smsProvider: string
  source: string
  gamePlatform: string
  visitCount: number
  registerCount: number
  firstChargeCount: number
  totalAmount: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  uploadProgress: number
  createdAt: string
  updatedAt: string
  // 添加缺失的属性
  grade?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  phoneCount?: number
  description?: string
  fileSize?: number
  uploadTime?: string
  phoneNumbers?: string[]
}

export interface CreatePackageForm {
  name: string
  country: string
  smsProvider: string
  source: string
  gamePlatform: string
  sendTime: string
  description?: string
  price?: number
  cost?: number
}

export interface EditPackageForm {
  name: string
  smsProvider: string
  source: string
  gamePlatform: string
  sendTime: string
  description?: string
  price?: number
  cost?: number
  status?: 'uploading' | 'processing' | 'completed' | 'failed'
}

export interface PhoneRating {
  id: string
  phoneNumber: string
  packageId: string
  country: string
  rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  ratingScore: number
  packageSize: number
  conversionRate: number
  createdAt: string
  updatedAt: string
}

export interface PhoneScore {
  id: string
  phoneNumber: string
  country: string
  ratingCount: number
  averageScore: number
  weightedScore: number
  timeDecayScore: number
  finalGrade: 'A' | 'B' | 'C' | 'D' | 'E'
  status: 'pending' | 'processing' | 'active'
  algorithmType: 'simple' | 'weighted' | 'timeDecay'
  lastCalculated: string
  createdAt: string
  updatedAt: string
}

// 报告相关类型
export interface Report {
  id: string
  name: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  format: 'pdf' | 'excel' | 'csv'
  status: 'generating' | 'completed' | 'failed'
  generatedAt: string
  dataRange: {
    startDate: string
    endDate: string
  }
  country?: string
  packageIds?: string[]
  includeCharts?: boolean
  includeDetails?: boolean
  fileUrl?: string
  fileSize?: number
  downloadCount: number
  description?: string
}