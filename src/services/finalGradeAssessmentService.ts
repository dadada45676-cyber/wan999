// 最终等级评定服务 - 基于综合评分和配置标准自动评定最终等级

import { supabase } from '../lib/supabase'
import { logger } from '../utils/logger'
import { APIUtils } from '../utils/api'
import { configService } from './configService'
import { comprehensiveScoringService, type ComprehensiveScoringResult } from './comprehensiveScoringService'

export interface FinalGradeAssessmentResult {
  phoneNumber: string
  comprehensiveScore: number
  finalGrade: 'A' | 'B' | 'C' | 'D' | 'E'
  gradeReason: string
  gradeConfig: {
    name: string
    minScore: number
    maxScore: number
    color: string
  }
  assessmentDetails: {
    isAntiFalsePositiveTriggered: boolean
    ratingCount: number
    packageCount: number
    calculationMethod: string
    previousGrade?: 'A' | 'B' | 'C' | 'D' | 'E'
    gradeChanged: boolean
  }
}

export interface BatchGradeAssessmentRequest {
  phoneNumbers: string[]
  packageId?: string
  updateDatabase?: boolean
  forceRecalculation?: boolean
}

export interface BatchGradeAssessmentResult {
  results: FinalGradeAssessmentResult[]
  summary: {
    totalProcessed: number
    successCount: number
    failureCount: number
    gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
    averageScore: number
    gradeChanges: number
  }
}

export interface GradeStatistics {
  totalNumbers: number
  gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
  averageScore: number
  scoreDistribution: Record<string, number>
  gradePercentages: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
}

export class FinalGradeAssessmentService {
  /**
   * 为单个号码评定最终等级
   * @param phoneNumber 号码
   * @param packageId 可选的包ID
   * @param updateDatabase 是否更新数据库
   * @returns 最终等级评定结果
   */
  static async assessFinalGrade(
    phoneNumber: string,
    packageId?: string,
    updateDatabase: boolean = false
  ): Promise<FinalGradeAssessmentResult> {
    try {
      // 1. 获取综合评分
      const scoringResult = await comprehensiveScoringService.calculateComprehensiveScore(
        phoneNumber,
        packageId
      )

      // 2. 获取最终等级配置
      const finalGradeConfig = await configService.getFinalGradeConfig()

      // 3. 获取当前号码的等级（如果存在）
      let previousGrade: 'A' | 'B' | 'C' | 'D' | 'E' | undefined
      const response = await APIUtils.apiCall(
        async () => {
          const { data, error } = await supabase
            .from('phone_scores')
            .select('grade')
            .eq('phone_number', phoneNumber)
            .single()

          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error
          }
          return data
        },
        {
          cache: true,
          cacheTTL: 1 * 60 * 1000, // 1分钟缓存
          operation: `get_phone_grade_${phoneNumber}`
        }
      )

      if (response.success && response.data) {
        previousGrade = response.data.grade
      }

      // 4. 根据综合评分确定最终等级
      const { finalGrade, gradeConfig, gradeReason } = this.determineGradeFromScore(
        scoringResult.comprehensiveScore,
        finalGradeConfig
      )

      // 5. 检查等级是否发生变化
      const gradeChanged = previousGrade !== undefined && previousGrade !== finalGrade

      // 6. 如果需要，更新数据库
      if (updateDatabase) {
        await this.updatePhoneGradeInDatabase(phoneNumber, finalGrade, scoringResult.comprehensiveScore)
      }

      const result: FinalGradeAssessmentResult = {
        phoneNumber,
        comprehensiveScore: scoringResult.comprehensiveScore,
        finalGrade,
        gradeReason,
        gradeConfig,
        assessmentDetails: {
          isAntiFalsePositiveTriggered: scoringResult.isAntiFalsePositiveTriggered,
          ratingCount: scoringResult.ratingCount,
          packageCount: scoringResult.packageCount,
          calculationMethod: scoringResult.calculationMethod,
          previousGrade,
          gradeChanged
        }
      }

      logger.info(`号码 ${phoneNumber} 最终等级评定完成`, {
        finalGrade,
        comprehensiveScore: scoringResult.comprehensiveScore,
        gradeChanged,
        previousGrade
      })

      return result

    } catch (error) {
      logger.error(`评定号码 ${phoneNumber} 最终等级失败`, error)
      
      // 返回默认结果
      return {
        phoneNumber,
        comprehensiveScore: 0,
        finalGrade: 'E',
        gradeReason: `评定失败: ${error instanceof Error ? error.message : '未知错误'}`,
        gradeConfig: {
          name: 'E',
          minScore: 0,
          maxScore: 59,
          color: '#ef4444'
        },
        assessmentDetails: {
          isAntiFalsePositiveTriggered: false,
          ratingCount: 0,
          packageCount: 0,
          calculationMethod: 'simple_average',
          gradeChanged: false
        }
      }
    }
  }

  /**
   * 批量评定最终等级
   * @param request 批量评定请求
   * @returns 批量评定结果
   */
  static async batchAssessFinalGrade(
    request: BatchGradeAssessmentRequest
  ): Promise<BatchGradeAssessmentResult> {
    const { phoneNumbers, packageId, updateDatabase = false, forceRecalculation = false } = request
    const results: FinalGradeAssessmentResult[] = []
    let successCount = 0
    let failureCount = 0
    let gradeChanges = 0
    let totalScore = 0
    const gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = {
      'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0
    }

    logger.info(`开始批量最终等级评定`, {
      phoneCount: phoneNumbers.length,
      packageId,
      updateDatabase,
      forceRecalculation
    })

    // 分批处理，避免一次性处理过多数据
    const batchSize = 30
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (phoneNumber) => {
        try {
          const result = await this.assessFinalGrade(phoneNumber, packageId, updateDatabase)
          
          successCount++
          totalScore += result.comprehensiveScore
          gradeDistribution[result.finalGrade]++
          
          if (result.assessmentDetails.gradeChanged) {
            gradeChanges++
          }
          
          return result
        } catch (error) {
          failureCount++
          logger.error(`批量评定中号码 ${phoneNumber} 失败`, error)
          
          return {
            phoneNumber,
            comprehensiveScore: 0,
            finalGrade: 'E' as const,
            gradeReason: `批量评定失败: ${error instanceof Error ? error.message : '未知错误'}`,
            gradeConfig: {
              name: 'E',
              minScore: 0,
              maxScore: 59,
              color: '#ef4444'
            },
            assessmentDetails: {
              isAntiFalsePositiveTriggered: false,
              ratingCount: 0,
              packageCount: 0,
              calculationMethod: 'simple_average',
              gradeChanged: false
            }
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // 添加小延迟，避免过度负载
      if (i + batchSize < phoneNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    const summary = {
      totalProcessed: phoneNumbers.length,
      successCount,
      failureCount,
      gradeDistribution,
      averageScore: successCount > 0 ? Math.round((totalScore / successCount) * 100) / 100 : 0,
      gradeChanges
    }

    logger.info(`批量最终等级评定完成`, summary)

    return {
      results,
      summary
    }
  }

  /**
   * 获取等级统计信息
   * @param packageId 可选的包ID
   * @returns 等级统计
   */
  static async getGradeStatistics(packageId?: string): Promise<GradeStatistics> {
    try {
      const response = await APIUtils.apiCall(
        async () => {
          let query = supabase
            .from('phone_scores')
            .select('grade, score')

          if (packageId) {
            // 如果指定了包ID，需要关联phone_ratings表
            const { data: packagePhones, error: packageError } = await supabase
              .from('phone_ratings')
              .select('phone_number')
              .eq('package_id', packageId)

            if (packageError) throw packageError

            const phoneNumbers = packagePhones?.map(item => item.phone_number) || []
            
            if (phoneNumbers.length === 0) {
              return []
            }

            query = query.in('phone_number', phoneNumbers)
          }

          const { data, error } = await query

          if (error) throw error
          return data || []
        },
        {
          cache: true,
          cacheTTL: 3 * 60 * 1000, // 3分钟缓存
          operation: `grade_statistics_${packageId || 'all'}`
        }
      )

      if (!response.success) {
        throw new Error(response.error?.message || '获取等级统计失败')
      }

      const data = response.data
      const totalNumbers = data.length

      // 计算等级分布
      const gradeDistribution: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = {
        'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0
      }

      // 计算评分分布
      const scoreDistribution: Record<string, number> = {
        '0-20': 0,
        '21-40': 0,
        '41-60': 0,
        '61-80': 0,
        '81-100': 0
      }

      let totalScore = 0

      data.forEach((item: any) => {
        const grade = item.grade as 'A' | 'B' | 'C' | 'D' | 'E'
        const score = item.score || 0

        if (grade && gradeDistribution.hasOwnProperty(grade)) {
          gradeDistribution[grade]++
        }

        totalScore += score

        // 评分分布
        if (score <= 20) scoreDistribution['0-20']++
        else if (score <= 40) scoreDistribution['21-40']++
        else if (score <= 60) scoreDistribution['41-60']++
        else if (score <= 80) scoreDistribution['61-80']++
        else scoreDistribution['81-100']++
      })

      // 计算等级百分比
      const gradePercentages: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = {
        'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0
      }

      if (totalNumbers > 0) {
        Object.keys(gradeDistribution).forEach(grade => {
          const gradeKey = grade as 'A' | 'B' | 'C' | 'D' | 'E'
          gradePercentages[gradeKey] = Math.round((gradeDistribution[gradeKey] / totalNumbers) * 100 * 100) / 100
        })
      }

      return {
        totalNumbers,
        gradeDistribution,
        averageScore: totalNumbers > 0 ? Math.round((totalScore / totalNumbers) * 100) / 100 : 0,
        scoreDistribution,
        gradePercentages
      }

    } catch (error) {
      logger.error('获取等级统计信息失败', error)
      return {
        totalNumbers: 0,
        gradeDistribution: { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 },
        averageScore: 0,
        scoreDistribution: { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 },
        gradePercentages: { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0 }
      }
    }
  }

  /**
   * 根据评分确定等级
   * @param score 综合评分
   * @param gradeConfig 等级配置
   * @returns 等级信息
   */
  private static determineGradeFromScore(
    score: number,
    gradeConfig: Array<{ name: string; minScore: number; maxScore: number; color: string }>
  ) {
    // 按分数从高到低排序配置
    const sortedConfig = [...gradeConfig].sort((a, b) => b.minScore - a.minScore)

    for (const config of sortedConfig) {
      if (score >= config.minScore && score <= config.maxScore) {
        return {
          finalGrade: config.name as 'A' | 'B' | 'C' | 'D' | 'E',
          gradeConfig: config,
          gradeReason: `评分 ${score} 符合 ${config.name} 级标准 (${config.minScore}-${config.maxScore})`
        }
      }
    }

    // 如果没有匹配的配置，默认为最低等级
    const lowestGrade = sortedConfig[sortedConfig.length - 1] || {
      name: 'E',
      minScore: 0,
      maxScore: 59,
      color: '#ef4444'
    }

    return {
      finalGrade: lowestGrade.name as 'A' | 'B' | 'C' | 'D' | 'E',
      gradeConfig: lowestGrade,
      gradeReason: `评分 ${score} 低于所有等级标准，默认为 ${lowestGrade.name} 级`
    }
  }

  /**
   * 更新数据库中的号码等级
   * @param phoneNumber 号码
   * @param grade 等级
   * @param score 评分
   */
  private static async updatePhoneGradeInDatabase(
    phoneNumber: string,
    grade: 'A' | 'B' | 'C' | 'D' | 'E',
    score: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('phone_scores')
        .upsert({
          phone_number: phoneNumber,
          score,
          grade,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'phone_number'
        })

      if (error) {
        throw error
      }

      // 清除相关缓存
      await APIUtils.clearCache()

      logger.info(`号码 ${phoneNumber} 等级已更新到数据库`, { grade, score })

    } catch (error) {
      logger.error(`更新号码 ${phoneNumber} 等级到数据库失败`, error)
      throw error
    }
  }

  /**
   * 重新评定所有号码的等级
   * @param packageId 可选的包ID，如果提供则只重新评定该包的号码
   * @returns 重新评定结果
   */
  static async reassessAllGrades(packageId?: string) {
    try {
      logger.info('开始重新评定所有号码等级', { packageId })

      // 获取需要重新评定的号码列表
      const response = await APIUtils.apiCall(
        async () => {
          let query = supabase
            .from('phone_scores')
            .select('phone_number')

          if (packageId) {
            const { data: packagePhones, error: packageError } = await supabase
              .from('phone_ratings')
              .select('phone_number')
              .eq('package_id', packageId)

            if (packageError) throw packageError

            const phoneNumbers = packagePhones?.map(item => item.phone_number) || []
            
            if (phoneNumbers.length === 0) {
              return []
            }

            query = query.in('phone_number', phoneNumbers)
          }

          const { data, error } = await query

          if (error) throw error
          return data || []
        },
        {
          operation: `get_phones_for_reassessment_${packageId || 'all'}`
        }
      )

      if (!response.success) {
        throw new Error(response.error?.message || '获取号码列表失败')
      }

      const phoneNumbers = response.data.map((item: any) => item.phone_number)

      if (phoneNumbers.length === 0) {
        logger.info('没有找到需要重新评定的号码')
        return {
          totalProcessed: 0,
          successCount: 0,
          failureCount: 0,
          gradeChanges: 0
        }
      }

      // 批量重新评定
      const result = await this.batchAssessFinalGrade({
        phoneNumbers,
        packageId,
        updateDatabase: true,
        forceRecalculation: true
      })

      logger.info('重新评定所有号码等级完成', result.summary)

      return result.summary

    } catch (error) {
      logger.error('重新评定所有号码等级失败', error)
      throw error
    }
  }
}

// 导出单例实例
export const finalGradeAssessmentService = FinalGradeAssessmentService