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
  countryOptions: string[]
  ratingOptions: string[]
  smsProviders?: string[]
  sources?: string[]
  gamePlatforms?: string[]
  minRatingCount: number
  timeDecayFactor: number
  ratingScoreMap: {
    [key: string]: number
  }
  antiFalsePositiveConfig: {
    threshold: number
    enabled: boolean
    description: string
  }
}

// 号码包相关类型
export interface PhonePackage {
  id: string
  name: string
  file_name: string
  country_code: string
  phone_count: number
  valid_phones: number
  invalid_phones: number
  duplicate_phones: number
  conversion_rate: number
  grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  send_time: string
  sms_provider: string
  source: string
  game_platform: string
  first_charge_count: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  upload_progress: number
  upload_time: string
  created_at: string
  updated_at: string
  user_id: string
  description?: string
  // 兼容旧字段名（用于前端显示）
  fileName?: string
  country?: string
  totalPhones?: number
  validPhones?: number
  invalidPhones?: number
  duplicatePhones?: number
  conversionRate?: number
  packageRating?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  phoneCount?: number
  firstChargeCount?: number
  smsProvider?: string
  gamePlatform?: string
  sendTime?: string
  uploadProgress?: number
  createdAt?: string
  updatedAt?: string
  uploadTime?: string
  phoneNumbers?: string[]
}

export interface CreatePackageForm {
  name: string
  fileName: string
  countryCode: string
  smsProvider: string
  source: string
  gamePlatform: string
  sendTime: string
  totalPhoneCount: number
  firstChargeCount: number
  conversionRate: number
  grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  description?: string
  phoneNumbers?: string[]
}

export interface EditPackageForm {
  name?: string
  description?: string
  status?: 'uploading' | 'processing' | 'completed' | 'failed'
  grade?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  smsProvider?: string
  source?: string
  gamePlatform?: string
  phoneCount?: number
  firstChargeCount?: number
  conversionRate?: number
  validPhones?: number
  invalidPhones?: number
  duplicatePhones?: number
  uploadProgress?: number
}

export interface PhoneRating {
  id: string
  phone_number: string
  package_id: string
  country_code: string
  rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  rating_score: number
  package_size: number
  conversion_rate: number
  created_at: string
  updated_at: string
  // 兼容旧字段名
  phoneNumber?: string
  packageId?: string
  country?: string
  ratingScore?: number
  packageSize?: number
  conversionRate?: number
  createdAt?: string
  updatedAt?: string
}

export interface PhoneScore {
  id: string
  phone_number: string
  country_code: string
  rating_count: number
  average_score: number
  weighted_score: number
  time_decay_score: number
  final_grade: 'A' | 'B' | 'C' | 'D' | 'E'
  status: 'pending' | 'processing' | 'active'
  algorithm_type: 'simple' | 'weighted' | 'timeDecay'
  last_calculated: string
  created_at: string
  updated_at: string
  // 兼容旧字段名
  phoneNumber?: string
  country?: string
  ratingCount?: number
  averageScore?: number
  weightedScore?: number
  timeDecayScore?: number
  finalGrade?: 'A' | 'B' | 'C' | 'D' | 'E'
  algorithmType?: 'simple' | 'weighted' | 'timeDecay'
  lastCalculated?: string
  createdAt?: string
  updatedAt?: string
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