import { PhonePackage, PhoneRating, PhoneScore, Report } from '../types'
import { COUNTRIES } from '../store/country'

// 工具函数
const generateId = () => Math.random().toString(36).substr(2, 9)

// 生成随机日期（过去N天内）
const generateRandomDate = (daysAgo: number) => {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  return date.toISOString()
}

// 生成随机时间字符串
const generateRandomTime = (daysAgo: number) => {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60))
  return date.toISOString()
}

// 根据转化率计算包等级
const calculatePackageGrade = (conversionRate: number): 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' => {
  if (conversionRate >= 0.8) return 'SS'
  if (conversionRate >= 0.6) return 'S'
  if (conversionRate >= 0.4) return 'A'
  if (conversionRate >= 0.2) return 'B'
  if (conversionRate >= 0.1) return 'C'
  return 'D'
}

// 根据评级获取分数
const getRatingScore = (rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'): number => {
  const scoreMap = {
    'SS': 100,
    'S': 90,
    'A': 80,
    'B': 70,
    'C': 60,
    'D': 50
  }
  return scoreMap[rating]
}

// 计算最终等级
const calculateFinalGrade = (averageScore: number): 'A' | 'B' | 'C' | 'D' | 'E' => {
  if (averageScore >= 90) return 'A'
  if (averageScore >= 80) return 'B'
  if (averageScore >= 70) return 'C'
  if (averageScore >= 60) return 'D'
  return 'E'
}

// 模拟数据常量
const smsProviders = ['短信商A', '短信商B', '短信商C', '短信商D']
const sources = ['电商平台', '社交媒体', '线下活动', '合作伙伴', '自然流量']
const gamePlatforms = ['平台A', '平台B', '平台C', '平台D']

// 为指定国家生成手机号码
const generatePhoneForCountry = (countryCode: string): string => {
  const country = COUNTRIES.find(c => c.code === countryCode)
  if (!country) {
    return generateBrazilianPhone()
  }

  const prefix = country.phonePrefix
  const minLength = Math.min(...country.phoneLength)
  const maxLength = Math.max(...country.phoneLength)
  
  const targetLength = minLength + Math.floor(Math.random() * (maxLength - minLength + 1))
  const remainingDigits = targetLength - prefix.length
  
  let number = ''
  for (let i = 0; i < remainingDigits; i++) {
    const digit = i === 0 ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 10)
    number += digit.toString()
  }
  
  return `${prefix}${number}`
}

// 生成巴西号码
const generateBrazilianPhone = (): string => {
  const countryCode = '55'
  const areaCode = ['11', '21', '31', '41', '51', '61', '71', '81', '85'][Math.floor(Math.random() * 9)]
  const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0')
  return `${countryCode}${areaCode}${number}`
}

// 生成模拟号码包数据
export const generateMockPackages = (count: number = 20): PhonePackage[] => {
  const packages: PhonePackage[] = []
  
  for (let i = 0; i < count; i++) {
    const totalPhones = Math.floor(Math.random() * 10000) + 1000
    const validPhones = Math.floor(totalPhones * (0.7 + Math.random() * 0.25))
    const invalidPhones = Math.floor((totalPhones - validPhones) * 0.6)
    const duplicatePhones = totalPhones - validPhones - invalidPhones
    const conversionRate = Math.random() * 0.15 + 0.01
    const packageRating = calculatePackageGrade(conversionRate)
    
    const visitCount = Math.floor(validPhones * (0.3 + Math.random() * 0.4))
    const registerCount = Math.floor(visitCount * (0.1 + Math.random() * 0.3))
    const firstChargeCount = Math.floor(registerCount * conversionRate)
    const totalAmount = firstChargeCount * (Math.random() * 500 + 50)
    
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
    
    packages.push({
      id: generateId(),
      name: `号码包${i + 1}`,
      fileName: `package_${i + 1}.csv`,
      country: country.code,
      totalPhones,
      validPhones,
      invalidPhones,
      duplicatePhones,
      conversionRate: Number(conversionRate.toFixed(4)),
      packageRating,
      sendTime: generateRandomTime(30),
      smsProvider: smsProviders[Math.floor(Math.random() * smsProviders.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      gamePlatform: gamePlatforms[Math.floor(Math.random() * gamePlatforms.length)],
      visitCount,
      registerCount,
      firstChargeCount,
      totalAmount: Number(totalAmount.toFixed(2)),
      status: Math.random() > 0.1 ? 'completed' : (Math.random() > 0.5 ? 'processing' : 'failed'),
      uploadProgress: 100,
      createdAt: generateRandomDate(30),
      updatedAt: generateRandomDate(5)
    })
  }
  
  return packages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// 生成号码评级历史数据
export const generateMockPhoneRatings = (packages: PhonePackage[], phoneCount: number = 500): PhoneRating[] => {
  const ratings: PhoneRating[] = []
  const phoneNumbers: string[] = []
  
  // 为每个国家生成号码列表
  const phoneCountPerCountry = Math.ceil(phoneCount / COUNTRIES.length)
  COUNTRIES.forEach(country => {
    for (let i = 0; i < phoneCountPerCountry && phoneNumbers.length < phoneCount; i++) {
      phoneNumbers.push(generatePhoneForCountry(country.code))
    }
  })
  
  // 为每个号码包生成评级记录
  packages.forEach(pkg => {
    if (pkg.status === 'completed') {
      const packagePhoneCount = Math.min(pkg.totalPhones, Math.floor(Math.random() * 100) + 50)
      const selectedPhones = phoneNumbers.slice(0, packagePhoneCount)
      
      selectedPhones.forEach(phone => {
        ratings.push({
          id: generateId(),
          phoneNumber: phone,
          packageId: pkg.id,
          country: pkg.country,
          rating: pkg.packageRating,
          ratingScore: getRatingScore(pkg.packageRating),
          packageSize: pkg.totalPhones,
          conversionRate: pkg.conversionRate,
          createdAt: pkg.sendTime,
          updatedAt: pkg.updatedAt
        })
      })
    }
  })
  
  return ratings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// 评分算法实现
const calculateSimpleAverage = (ratings: PhoneRating[]): number => {
  const totalScore = ratings.reduce((sum, rating) => sum + rating.ratingScore, 0)
  return totalScore / ratings.length
}

const calculateWeightedAverage = (ratings: PhoneRating[]): number => {
  let totalWeightedScore = 0
  let totalWeight = 0
  
  ratings.forEach(rating => {
    const weight = rating.packageSize / 10000
    totalWeightedScore += rating.ratingScore * weight
    totalWeight += weight
  })
  
  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0
}

const calculateTimeDecayAverage = (ratings: PhoneRating[], decayFactor: number = 0.01): number => {
  const currentDate = new Date()
  let totalWeightedScore = 0
  let totalWeight = 0
  
  ratings.forEach(rating => {
    const daysDiff = Math.floor((currentDate.getTime() - new Date(rating.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    const timeWeight = Math.exp(-decayFactor * daysDiff)
    
    totalWeightedScore += rating.ratingScore * timeWeight
    totalWeight += timeWeight
  })
  
  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0
}

// 生成号码综合评分数据
export const generateMockPhoneScores = (ratings: PhoneRating[], minRatingCount: number = 3): PhoneScore[] => {
  const scores: PhoneScore[] = []
  const phoneGroups = new Map<string, PhoneRating[]>()
  
  // 按号码分组评级记录
  ratings.forEach(rating => {
    if (!phoneGroups.has(rating.phoneNumber)) {
      phoneGroups.set(rating.phoneNumber, [])
    }
    phoneGroups.get(rating.phoneNumber)!.push(rating)
  })
  
  // 计算每个号码的综合评分
  phoneGroups.forEach((phoneRatings, phoneNumber) => {
    const ratingCount = phoneRatings.length
    let status: 'pending' | 'processing' | 'active' = 'pending'
    let averageScore = 0
    let weightedScore = 0
    let timeDecayScore = 0
    let finalGrade: 'A' | 'B' | 'C' | 'D' | 'E' = 'E'
    let algorithm: 'simple' | 'weighted' | 'timeDecay' = 'weighted'
    
    if (ratingCount >= minRatingCount) {
      const algorithms = ['simple', 'weighted', 'timeDecay'] as const
      algorithm = algorithms[Math.floor(Math.random() * algorithms.length)]
      
      averageScore = calculateSimpleAverage(phoneRatings)
      weightedScore = calculateWeightedAverage(phoneRatings)
      timeDecayScore = calculateTimeDecayAverage(phoneRatings)
      
      let finalScore = averageScore
      switch (algorithm) {
        case 'weighted':
          finalScore = weightedScore
          break
        case 'timeDecay':
          finalScore = timeDecayScore
          break
      }
      
      finalGrade = calculateFinalGrade(finalScore)
      status = 'active'
    } else if (ratingCount > 0) {
      status = 'processing'
      averageScore = calculateSimpleAverage(phoneRatings)
      finalGrade = calculateFinalGrade(averageScore)
    }
    
    scores.push({
      id: generateId(),
      phoneNumber,
      country: phoneRatings.length > 0 ? phoneRatings[0].country : 'BR',
      ratingCount,
      averageScore,
      weightedScore,
      timeDecayScore,
      finalGrade,
      status,
      algorithmType: algorithm,
      lastCalculated: phoneRatings.length > 0 ? phoneRatings[0].createdAt : new Date().toISOString(),
      createdAt: phoneRatings.length > 0 ? phoneRatings[0].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  })
  
  return scores.sort((a, b) => b.averageScore - a.averageScore)
}

// 生成模拟报告数据
export const generateMockReports = (count: number = 15): Report[] => {
  const reports: Report[] = []
  const reportTypes: Array<'daily' | 'weekly' | 'monthly' | 'custom'> = ['daily', 'weekly', 'monthly', 'custom']
  const formats: Array<'pdf' | 'excel' | 'csv'> = ['pdf', 'excel', 'csv']
  
  for (let i = 0; i < count; i++) {
    const type = reportTypes[Math.floor(Math.random() * reportTypes.length)]
    const format = formats[Math.floor(Math.random() * formats.length)]
    const status = Math.random() > 0.1 ? 'completed' : (Math.random() > 0.5 ? 'generating' : 'failed')
    const generatedAt = generateRandomTime(30)
    const fileSize = Math.floor(Math.random() * 10000) + 1000
    const downloadCount = Math.floor(Math.random() * 50)
    
    // 生成数据范围
    const endDate = new Date(generatedAt)
    const startDate = new Date(endDate)
    
    switch (type) {
      case 'daily':
        startDate.setDate(endDate.getDate() - 1)
        break
      case 'weekly':
        startDate.setDate(endDate.getDate() - 7)
        break
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - 1)
        break
      case 'custom':
        startDate.setDate(endDate.getDate() - Math.floor(Math.random() * 30))
        break
    }
    
    reports.push({
      id: generateId(),
      name: `${type === 'daily' ? '日报' : type === 'weekly' ? '周报' : type === 'monthly' ? '月报' : '自定义报告'}_${String(i + 1).padStart(3, '0')}`,
      type,
      format,
      status,
      generatedAt,
      dataRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)].code,
      includeCharts: Math.random() > 0.5,
      includeDetails: Math.random() > 0.3,
      fileSize: status === 'completed' ? fileSize : undefined,
      downloadCount: status === 'completed' ? downloadCount : 0
    })
  }
  
  return reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
}

// 生成仪表盘统计数据
export const generateDashboardStats = () => {
  const todayPackages = Math.floor(Math.random() * 20) + 10
  const totalPhones = Math.floor(Math.random() * 1000000) + 2000000
  const avgConversion = Math.floor(Math.random() * 100) + 200
  const ssPackages = Math.floor(Math.random() * 10) + 5
  
  return {
    todayPackages,
    totalPhones,
    avgConversion,
    ssPackages,
    todayChange: {
      packages: (Math.random() * 20 - 10).toFixed(1),
      phones: (Math.random() * 20 - 10).toFixed(1),
      conversion: (Math.random() * 10 - 5).toFixed(1),
      ssPackages: Math.floor(Math.random() * 3) - 1
    }
  }
}