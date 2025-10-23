// 通用数据类型定义

// 基础实体接口，包含国家信息
export interface BaseEntity {
  id: string;
  country: string; // 国家代码，如 'BR', 'US', 'CN'
  createdAt: string;
  updatedAt: string;
}

// 号码包接口
export interface Package extends BaseEntity {
  name: string;
  fileName: string;
  totalPhones: number;
  validPhones: number;
  invalidPhones: number;
  duplicatePhones: number;
  conversionRate: number; // 万分转化数
  packageRating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  sendTime: string;
  smsProvider: string;
  source: string;
  gamePlatform: string;
  visitCount: number;
  registerCount: number;
  firstChargeCount: number;
  totalAmount: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  uploadProgress: number;
}

// 号码评级历史接口
export interface PhoneRating extends BaseEntity {
  phoneNumber: string;
  packageId: string;
  rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  ratingScore: number;
  packageSize: number;
  conversionRate: number;
}

// 号码综合评分接口
export interface PhoneScore extends BaseEntity {
  phoneNumber: string;
  ratingCount: number;
  averageScore: number;
  weightedScore: number;
  timeDecayScore: number;
  finalGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  status: 'pending' | 'processing' | 'active';
  algorithmType: 'simple' | 'weighted' | 'timeDecay';
  lastCalculated: string;
}

// 排行榜数据接口
export interface RankingData extends BaseEntity {
  name: string;
  conversionRate: number;
  totalPhones: number;
  firstChargeCount: number;
  packageCount?: number;
  rank: number;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
}

// 号码包排行榜
export interface PackageRanking extends RankingData {
  packageId: string;
  smsProvider: string;
  source: string;
  gamePlatform: string;
  sendTime: string;
}

// 短信商排行榜
export interface SmsProviderRanking extends RankingData {
  providerId: string;
  packageCount: number;
  averagePackageSize: number;
}

// 游戏平台排行榜
export interface GamePlatformRanking extends RankingData {
  platformId: string;
  packageCount: number;
  averageConversionRate: number;
}

// 来源排行榜
export interface SourceRanking extends RankingData {
  sourceId: string;
  packageCount: number;
  qualityScore: number;
}

// 时间筛选选项
export type TimeFilter = 'yesterday' | '3days' | '7days' | '15days' | '30days';

// 筛选条件接口
export interface FilterOptions {
  country?: string;
  timeFilter?: TimeFilter;
  smsProvider?: string;
  source?: string;
  gamePlatform?: string;
  rating?: string;
  status?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// 统计数据接口
export interface Statistics {
  country: string;
  totalPackages: number;
  totalPhones: number;
  totalFirstCharges: number;
  averageConversionRate: number;
  totalAmount: number;
  packageRatingDistribution: {
    SS: number;
    S: number;
    A: number;
    B: number;
    C: number;
    D: number;
  };
  phoneGradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
  };
  timeRange: {
    start: string;
    end: string;
  };
}

// 报告数据接口
export interface ReportData extends BaseEntity {
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  format: 'pdf' | 'excel' | 'csv';
  statistics: Statistics;
  rankings: {
    packages: PackageRanking[];
    smsProviders: SmsProviderRanking[];
    gamePlatforms: GamePlatformRanking[];
    sources: SourceRanking[];
  };
  generatedBy: string;
  downloadUrl?: string;
  status: 'generating' | 'completed' | 'failed';
}

// API响应接口
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 分页请求参数
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 搜索参数
export interface SearchParams extends PaginationParams {
  keyword?: string;
  filters?: FilterOptions;
}