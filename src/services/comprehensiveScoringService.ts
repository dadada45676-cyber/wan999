// 综合评分计算服务 - 为触发防误杀的号码计算简单平均值评分

import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { APIUtils } from '../utils/api'
import { antiFalsePositiveService } from './antiFalsePositiveService'
import { configService } from './configService'

export interface ComprehensiveScoringResult {
  phoneNumber: string
  comprehensiveScore: number
  ratingCount: number
  packageCount: number
  calculationMethod: 'simple_average' | 'weighted_average' | 'time_decay'
  isAntiFalsePositiveTriggered: boolean
  details: {
    rawScores: number[]
    averageScore: number
    adjustedScore?: number
    reason?: string
  }
}

export interface BatchScoringRequest {
  phoneNumbers: string[]
  packageId?: string
  forceRecalculation?: boolean
}

export interface BatchScoringResult {
  results: ComprehensiveScoringResult[]
  summary: {
    totalProcessed: number
    successCount: number
    failureCount: number
    antiFalsePositiveTriggered: number
    averageScore: number
  }
}

export class ComprehensiveScoringService {
  /**
   * 为单个号码计算综合评分
   * @param phoneNumber 号码
   * @param packageId 可选的包ID
   * @returns 综合评分结果
   */
  static async calculateComprehensiveScore(
    phoneNumber: string, 
    packageId?: string
  ): Promise<ComprehensiveScoringResult> {
    try {
      // 1. 检查防误杀机制
      const antiFalsePositiveResult = await antiFalsePositiveService.checkAntiFalsePositive(
        phoneNumber, 
        packageId
      )

      // 2. 获取号码的所有评级记录
      const response = await APIUtils.apiCall(
        async () => {
          const { data, error } = await supabase
            .from('phone_ratings')
            .select('rating_score, package_id, created_at')
            .eq('phone_number', phoneNumber)
            .order('created_at', { ascending: false })

          if (error) throw error
          return data || []
        },
        {
          cache: true,
          cacheTTL: 2 * 60 * 1000, // 2分钟缓存
          operation: `get_phone_ratings_${phoneNumber}`
        }
      )

      if (!response.success) {
        throw new Error(response.error?.message || '获取号码评级失败')
      }

      const ratings = response.data
      const rawScores = ratings.map(r => r.rating_score)
      const packageCount = new Set(ratings.map(r => r.package_id)).size

      // 3. 根据防误杀结果决定计算方法
      let comprehensiveScore = 0
      let calculationMethod: 'simple_average' | 'weighted_average' | 'time_decay' = 'simple_average'
      let adjustedScore: number | undefined
      let reason: string | undefined

      if (!antiFalsePositiveResult.shouldCalculateScore) {
        // 未触发防误杀，使用默认评分或返回0
        comprehensiveScore = 0
        reason = antiFalsePositiveResult.reason
      } else {
        // 触发防误杀，计算综合评分
        if (rawScores.length === 0) {
          comprehensiveScore = 0
          reason = '无评级记录'
        } else {
          // 获取评分算法配置
          const algorithmConfig = await configService.getScoringAlgorithmConfig()
          
          switch (algorithmConfig.type) {
            case 'simple':
              // 简单平均值
              comprehensiveScore = rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length
              calculationMethod = 'simple_average'
              break

            case 'weighted':
              // 加权平均（最近的评级权重更高）
              const weights = algorithmConfig.weights || { recent: 0.7, historical: 0.3 }
              const recentCount = Math.ceil(ratings.length * 0.3)
              
              const recentRatings = ratings.slice(0, recentCount)
              const historicalRatings = ratings.slice(recentCount)
              
              const recentAvg = recentRatings.reduce((sum, r) => sum + r.rating_score, 0) / recentRatings.length
              const historicalAvg = historicalRatings.length > 0 
                ? historicalRatings.reduce((sum, r) => sum + r.rating_score, 0) / historicalRatings.length 
                : recentAvg
              
              comprehensiveScore = recentAvg * weights.recent + historicalAvg * weights.historical
              calculationMethod = 'weighted_average'
              break

            case 'time_decay':
              // 时间衰减算法
              const decayFactor = algorithmConfig.timeDecayFactor || 0.1
              const now = new Date()
              let totalWeight = 0
              let weightedSum = 0
              
              ratings.forEach(rating => {
                const daysDiff = Math.floor((now.getTime() - new Date(rating.created_at).getTime()) / (1000 * 60 * 60 * 24))
                const weight = Math.exp(-decayFactor * daysDiff)
                weightedSum += rating.rating_score * weight
                totalWeight += weight
              })
              
              comprehensiveScore = totalWeight > 0 ? weightedSum / totalWeight : 0
              calculationMethod = 'time_decay'
              break

            default:
              // 默认简单平均
              comprehensiveScore = rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length
              calculationMethod = 'simple_average'
          }

          // 保留两位小数
          comprehensiveScore = Math.round(comprehensiveScore * 100) / 100
        }
      }

      const result: ComprehensiveScoringResult = {
        phoneNumber,
        comprehensiveScore,
        ratingCount: rawScores.length,
        packageCount,
        calculationMethod,
        isAntiFalsePositiveTriggered: antiFalsePositiveResult.shouldCalculateScore,
        details: {
          rawScores,
          averageScore: rawScores.length > 0 ? rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length : 0,
          adjustedScore,
          reason
        }
      }

      logger.info(`号码 ${phoneNumber} 综合评分计算完成`, {
        comprehensiveScore,
        ratingCount: rawScores.length,
        packageCount,
        isAntiFalsePositiveTriggered: antiFalsePositiveResult.shouldCalculateScore,
        calculationMethod
      })

      return result

    } catch (error) {
      logger.error(`计算号码 ${phoneNumber} 综合评分失败`, error)
      
      // 返回默认结果
      return {
        phoneNumber,
        comprehensiveScore: 0,
        ratingCount: 0,
        packageCount: 0,
        calculationMethod: 'simple_average',
        isAntiFalsePositiveTriggered: false,
        details: {
          rawScores: [],
          averageScore: 0,
          reason: `计算失败: ${error instanceof Error ? error.message : '未知错误'}`
        }
      }
    }
  }

  /**
   * 批量计算综合评分
   * @param request 批量评分请求
   * @returns 批量评分结果
   */
  static async batchCalculateComprehensiveScore(
    request: BatchScoringRequest
  ): Promise<BatchScoringResult> {
    const { phoneNumbers, packageId, forceRecalculation = false } = request
    const results: ComprehensiveScoringResult[] = []
    let successCount = 0
    let failureCount = 0
    let antiFalsePositiveTriggered = 0
    let totalScore = 0

    logger.info(`开始批量计算综合评分`, {
      phoneCount: phoneNumbers.length,
      packageId,
      forceRecalculation
    })

    // 分批处理，避免一次性处理过多数据
    const batchSize = 50
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (phoneNumber) => {
        try {
          const result = await this.calculateComprehensiveScore(phoneNumber, packageId)
          
          if (result.comprehensiveScore > 0) {
            successCount++
            totalScore += result.comprehensiveScore
            
            if (result.isAntiFalsePositiveTriggered) {
              antiFalsePositiveTriggered++
            }
          } else {
            failureCount++
          }
          
          return result
        } catch (error) {
          failureCount++
          logger.error(`批量计算中号码 ${phoneNumber} 失败`, error)
          
          return {
            phoneNumber,
            comprehensiveScore: 0,
            ratingCount: 0,
            packageCount: 0,
            calculationMethod: 'simple_average' as const,
            isAntiFalsePositiveTriggered: false,
            details: {
              rawScores: [],
              averageScore: 0,
              reason: `批量计算失败: ${error instanceof Error ? error.message : '未知错误'}`
            }
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // 添加小延迟，避免过度负载
      if (i + batchSize < phoneNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const summary = {
      totalProcessed: phoneNumbers.length,
      successCount,
      failureCount,
      antiFalsePositiveTriggered,
      averageScore: successCount > 0 ? Math.round((totalScore / successCount) * 100) / 100 : 0
    }

    logger.info(`批量综合评分计算完成`, summary)

    return {
      results,
      summary
    }
  }

  /**
   * 获取综合评分统计信息
   * @param packageId 可选的包ID
   * @returns 统计信息
   */
  static async getComprehensiveScoringStats(packageId?: string) {
    try {
      const response = await APIUtils.apiCall(
        async () => {
          let query = supabase
            .from('phone_scores')
            .select('score, phone_number')

          if (packageId) {
            // 如果指定了包ID，需要关联phone_ratings表
            const { data: packageData, error: packageError } = await supabase
              .from('phone_ratings')
              .select('phone_number')
              .eq('package_id', packageId)

            if (packageError) throw packageError

            const phoneNumbers = packageData?.map(item => item.phone_number) || []
            
            if (phoneNumbers.length === 0) {
              return []
            }

            const { data: scoreData, error: scoreError } = await supabase
              .from('phone_scores')
              .select('score, phone_number')
              .in('phone_number', phoneNumbers)

            if (scoreError) throw scoreError
            return scoreData || []
          }

          const { data, error } = await query

          if (error) throw error
          return data || []
        },
        {
          cache: true,
          cacheTTL: 5 * 60 * 1000, // 5分钟缓存
          operation: `comprehensive_scoring_stats_${packageId || 'all'}`
        }
      )

      if (!response.success) {
        throw new Error(response.error?.message || '获取统计信息失败')
      }

      const data = response.data
      const scores = packageId 
        ? data.map((item: any) => item.phone_scores.score)
        : data.map((item: any) => item.score)

      const validScores = scores.filter((score: number) => score > 0)

      return {
        totalNumbers: data.length,
        scoredNumbers: validScores.length,
        averageScore: validScores.length > 0 
          ? Math.round((validScores.reduce((sum: number, score: number) => sum + score, 0) / validScores.length) * 100) / 100 
          : 0,
        maxScore: validScores.length > 0 ? Math.max(...validScores) : 0,
        minScore: validScores.length > 0 ? Math.min(...validScores) : 0,
        scoreDistribution: this.calculateScoreDistribution(validScores)
      }

    } catch (error) {
      logger.error('获取综合评分统计信息失败', error)
      return {
        totalNumbers: 0,
        scoredNumbers: 0,
        averageScore: 0,
        maxScore: 0,
        minScore: 0,
        scoreDistribution: {}
      }
    }
  }

  /**
   * 计算评分分布
   * @param scores 评分数组
   * @returns 分布统计
   */
  private static calculateScoreDistribution(scores: number[]) {
    const distribution: Record<string, number> = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    }

    scores.forEach(score => {
      if (score <= 20) distribution['0-20']++
      else if (score <= 40) distribution['21-40']++
      else if (score <= 60) distribution['41-60']++
      else if (score <= 80) distribution['61-80']++
      else distribution['81-100']++
    })

    return distribution
  }
}

// 导出单例实例
export const comprehensiveScoringService = ComprehensiveScoringService