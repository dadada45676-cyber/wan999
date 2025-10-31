import { supabase } from '../lib/supabase'
import { ConfigService } from './configService'
import { APIUtils } from '../utils/api'
import { log as logger } from '../utils/logger'

export interface AntiFalsePositiveResult {
  shouldCalculateScore: boolean
  reason: string
  packageCount: number
  ratingCount: number
  threshold: number
  minRatingCount: number
}

export interface PhoneRatingHistory {
  id: string
  phone_number: string
  package_id: string
  rating: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'
  rating_score: number
  created_at: string
  updated_at: string
}

/**
 * 防误杀机制服务
 * 负责检查号码是否应该进行评分计算，避免误判优质号码
 */
export class AntiFalsePositiveService {
  private static instance: AntiFalsePositiveService
  private configService: ConfigService

  private constructor() {
    this.configService = ConfigService.getInstance()
  }

  public static getInstance(): AntiFalsePositiveService {
    if (!AntiFalsePositiveService.instance) {
      AntiFalsePositiveService.instance = new AntiFalsePositiveService()
    }
    return AntiFalsePositiveService.instance
  }

  /**
   * 检查号码是否应该进行评分计算
   * @param phoneNumber 号码
   * @param packageId 可选的包ID，用于排除当前包的评级
   * @returns 防误杀检查结果
   */
  async checkAntiFalsePositive(phoneNumber: string, packageId?: string): Promise<AntiFalsePositiveResult> {
    try {
      // 获取防误杀配置和算法配置
      const [antiFalsePositiveConfig, algorithmConfig] = await Promise.all([
        this.configService.getAntiFalsePositiveConfig(),
        this.configService.getScoringAlgorithmConfig()
      ])

      // 获取该号码的评级历史
      const ratingHistory = await this.getPhoneRatingHistory(phoneNumber, packageId)

      // 计算唯一包数量
      const uniquePackages = new Set(ratingHistory.map(r => r.package_id))
      const packageCount = uniquePackages.size
      const ratingCount = ratingHistory.length

      // 检查是否启用防误杀机制
      if (!antiFalsePositiveConfig.enabled) {
        return {
          shouldCalculateScore: true,
          reason: '防误杀机制已禁用',
          packageCount,
          ratingCount,
          threshold: antiFalsePositiveConfig.threshold,
          minRatingCount: algorithmConfig.minRatingCount
        }
      }

      // 检查包数量阈值
      if (packageCount < antiFalsePositiveConfig.threshold) {
        return {
          shouldCalculateScore: false,
          reason: `号码在不同包中出现次数 (${packageCount}) 未达到防误杀阈值 (${antiFalsePositiveConfig.threshold})`,
          packageCount,
          ratingCount,
          threshold: antiFalsePositiveConfig.threshold,
          minRatingCount: algorithmConfig.minRatingCount
        }
      }

      // 检查最小评级次数
      if (ratingCount < algorithmConfig.minRatingCount) {
        return {
          shouldCalculateScore: false,
          reason: `号码评级次数 (${ratingCount}) 未达到最小要求 (${algorithmConfig.minRatingCount})`,
          packageCount,
          ratingCount,
          threshold: antiFalsePositiveConfig.threshold,
          minRatingCount: algorithmConfig.minRatingCount
        }
      }

      // 通过所有检查
      return {
        shouldCalculateScore: true,
        reason: '通过防误杀检查',
        packageCount,
        ratingCount,
        threshold: antiFalsePositiveConfig.threshold,
        minRatingCount: algorithmConfig.minRatingCount
      }

    } catch (error) {
      logger.error('防误杀检查失败', error, 'AntiFalsePositiveService')
      
      // 出错时默认允许计算，避免阻塞正常流程
      return {
        shouldCalculateScore: true,
        reason: `防误杀检查出错: ${error instanceof Error ? error.message : '未知错误'}`,
        packageCount: 0,
        ratingCount: 0,
        threshold: 3,
        minRatingCount: 3
      }
    }
  }

  /**
   * 获取号码的评级历史
   * @param phoneNumber 号码
   * @param excludePackageId 要排除的包ID
   * @returns 评级历史记录
   */
  private async getPhoneRatingHistory(phoneNumber: string, excludePackageId?: string): Promise<PhoneRatingHistory[]> {
    const response = await APIUtils.apiCall(
      async () => {
        let query = supabase
          .from('phone_ratings')
          .select('*')
          .eq('phone_number', phoneNumber)
          .order('created_at', { ascending: false })

        // 如果指定了要排除的包ID，则排除该包的评级
        if (excludePackageId) {
          query = query.neq('package_id', excludePackageId)
        }

        const { data, error } = await query

        if (error) {
          throw new Error(`获取号码评级历史失败: ${error.message}`)
        }

        return data || []
      },
      {
        cache: true,
        timeout: 5000,
        retries: 2,
        operation: 'getPhoneRatingHistory'
      }
    )

    if (!response.success) {
      throw new Error(response.error?.message || '获取号码评级历史失败')
    }

    return response.data
  }

  /**
   * 批量检查多个号码的防误杀状态
   * @param phoneNumbers 号码列表
   * @param packageId 可选的包ID
   * @returns 防误杀检查结果映射
   */
  async batchCheckAntiFalsePositive(
    phoneNumbers: string[], 
    packageId?: string
  ): Promise<Record<string, AntiFalsePositiveResult>> {
    const results: Record<string, AntiFalsePositiveResult> = {}

    // 并发检查，但限制并发数量避免过载
    const batchSize = 10
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize)
      const batchPromises = batch.map(async (phoneNumber) => {
        const result = await this.checkAntiFalsePositive(phoneNumber, packageId)
        return { phoneNumber, result }
      })

      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(({ phoneNumber, result }) => {
        results[phoneNumber] = result
      })
    }

    return results
  }

  /**
   * 获取防误杀统计信息
   * @param packageId 可选的包ID，用于获取特定包的统计
   * @returns 统计信息
   */
  async getAntiFalsePositiveStats(packageId?: string): Promise<{
    totalPhones: number
    passedPhones: number
    blockedPhones: number
    passRate: number
    blockedReasons: Record<string, number>
  }> {
    try {
      // 获取要检查的号码列表
      let phoneNumbers: string[] = []

      if (packageId) {
        // 获取特定包的号码
        const { data, error } = await supabase
          .from('phone_ratings')
          .select('phone_number')
          .eq('package_id', packageId)

        if (error) {
          throw new Error(`获取包号码失败: ${error.message}`)
        }

        phoneNumbers = [...new Set(data?.map(r => r.phone_number) || [])]
      } else {
        // 获取所有号码
        const { data, error } = await supabase
          .from('phone_ratings')
          .select('phone_number')

        if (error) {
          throw new Error(`获取所有号码失败: ${error.message}`)
        }

        phoneNumbers = [...new Set(data?.map(r => r.phone_number) || [])]
      }

      // 批量检查防误杀状态
      const results = await this.batchCheckAntiFalsePositive(phoneNumbers, packageId)

      // 统计结果
      const totalPhones = phoneNumbers.length
      let passedPhones = 0
      let blockedPhones = 0
      const blockedReasons: Record<string, number> = {}

      Object.values(results).forEach(result => {
        if (result.shouldCalculateScore) {
          passedPhones++
        } else {
          blockedPhones++
          blockedReasons[result.reason] = (blockedReasons[result.reason] || 0) + 1
        }
      })

      const passRate = totalPhones > 0 ? (passedPhones / totalPhones) * 100 : 0

      return {
        totalPhones,
        passedPhones,
        blockedPhones,
        passRate: Math.round(passRate * 100) / 100,
        blockedReasons
      }

    } catch (error) {
      logger.error('获取防误杀统计失败', error, 'AntiFalsePositiveService')
      return {
        totalPhones: 0,
        passedPhones: 0,
        blockedPhones: 0,
        passRate: 0,
        blockedReasons: {}
      }
    }
  }

  /**
   * 验证防误杀配置的合理性
   * @param config 防误杀配置
   * @returns 验证结果
   */
  validateAntiFalsePositiveConfig(config: {
    threshold: number
    enabled: boolean
    description: string
  }): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    // 阈值验证
    if (config.threshold < 1) {
      errors.push('防误杀阈值不能小于1')
    } else if (config.threshold > 10) {
      warnings.push('防误杀阈值过高可能导致大量号码无法获得评分')
    }

    // 描述验证
    if (!config.description || config.description.trim().length === 0) {
      errors.push('防误杀配置描述不能为空')
    }

    // 合理性检查
    if (config.enabled && config.threshold >= 5) {
      warnings.push('防误杀阈值较高，建议设置为3-4以平衡准确性和覆盖率')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}

// 导出单例实例
export const antiFalsePositiveService = AntiFalsePositiveService.getInstance()