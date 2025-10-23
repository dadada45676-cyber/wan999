import { supabase } from '../lib/supabase'
import { APIUtils } from '../utils/api'
import { log } from '../utils/logger'
import type { SystemSettings, ServiceResponse } from '../types'

export interface SettingsUpdateRequest {
  category: string
  settings: Record<string, any>
}

export class SettingsService {
  private static readonly SETTINGS_ID = 'default'

  // 获取系统设置
  static async getSettings(): Promise<ServiceResponse<SystemSettings>> {
    const result = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', this.SETTINGS_ID)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            // 设置不存在，创建默认设置
            return this.createDefaultSettings()
          }
          throw new Error(error.message)
        }

        const settings = this.mapDatabaseToSettings(data)
        return { success: true, data: settings }
      },
      {
        cache: true,
        cacheTTL: 60000 // 1分钟缓存
      }
    )
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 获取系统设置（别名方法）
  static async getSystemSettings(): Promise<SystemSettings | null> {
    try {
      const result = await this.getSettings()
      return result.success ? result.data : null
    } catch (error) {
      log.error('SettingsService.getSystemSettings error', error, 'SettingsService')
      return null
    }
  }

  // 更新系统设置
  static async updateSettings(updates: Partial<SystemSettings>): Promise<ServiceResponse<SystemSettings>> {
    const result = await APIUtils.apiCall(
      async () => {
        const updateData: any = {}
        
        if (updates.packageGradeThresholds) {
          updateData.package_grade_thresholds = updates.packageGradeThresholds
        }
        if (updates.breakEvenConfig) {
          updateData.break_even_config = updates.breakEvenConfig
        }
        if (updates.finalGradeConfig) {
          updateData.final_grade_config = updates.finalGradeConfig
        }
        if (updates.scoringAlgorithm) {
          updateData.scoring_algorithm = updates.scoringAlgorithm
        }
        if (updates.countryOptions) {
          updateData.country_options = updates.countryOptions
        }
        if (updates.ratingOptions) {
          updateData.rating_options = updates.ratingOptions
        }
        if (updates.minRatingCount !== undefined) {
          updateData.min_rating_count = updates.minRatingCount
        }
        if (updates.timeDecayFactor !== undefined) {
          updateData.time_decay_factor = updates.timeDecayFactor
        }
        if (updates.ratingScoreMap) {
          updateData.rating_score_map = updates.ratingScoreMap
        }

        const { data, error } = await supabase
          .from('system_settings')
          .update(updateData)
          .eq('id', this.SETTINGS_ID)
          .select()
          .single()

        if (error) {
          throw new Error(error.message)
        }

        // 清除缓存
        APIUtils.cache.delete('settings:get')

        const settings = this.mapDatabaseToSettings(data)
        return { success: true, data: settings }
      },
      {
        cache: false,
        retries: 2
      }
    )
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 更新系统设置（别名方法）
  static async updateSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings | null> {
    try {
      const result = await this.updateSettings(updates)
      return result.success ? result.data : null
    } catch (error) {
      log.error('SettingsService.updateSystemSettings error', error, 'SettingsService')
      return null
    }
  }

  // 重置为默认设置
  static async resetToDefault(): Promise<ServiceResponse<SystemSettings>> {
    const result = await APIUtils.apiCall(
      async () => {
        const defaultSettings = this.getDefaultSettings()
        const settingsData = this.mapSettingsToDatabase(defaultSettings)

        const { data, error } = await supabase
          .from('system_settings')
          .upsert([{
            id: this.SETTINGS_ID,
            ...settingsData
          }])
          .select()
          .single()

        if (error) {
          throw new Error(error.message)
        }

        // 清除缓存
        APIUtils.cache.delete('settings:get')

        const settings = this.mapDatabaseToSettings(data)
        return { success: true, data: settings }
      },
      {
        cache: false,
        retries: 2
      }
    )
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 重置系统设置（别名方法）
  static async resetSystemSettings(): Promise<SystemSettings | null> {
    try {
      const result = await this.resetToDefault()
      return result.success ? result.data : null
    } catch (error) {
      log.error('SettingsService.resetSystemSettings error', error, 'SettingsService')
      return null
    }
  }

  // 获取特定分类的设置
  static async getCategorySettings(category: string): Promise<Record<string, any> | null> {
    try {
      const settings = await this.getSystemSettings()
      if (!settings) return null

      switch (category) {
        case 'packageGrade':
          return {
            packageGradeThresholds: settings.packageGradeThresholds,
            breakEvenConfig: settings.breakEvenConfig
          }
        case 'finalGrade':
          return {
            finalGradeConfig: settings.finalGradeConfig
          }
        case 'algorithm':
          return {
            scoringAlgorithm: settings.scoringAlgorithm,
            minRatingCount: settings.minRatingCount,
            timeDecayFactor: settings.timeDecayFactor,
            ratingScoreMap: settings.ratingScoreMap
          }
        case 'dropdown':
          return {
            countryOptions: settings.countryOptions,
            ratingOptions: settings.ratingOptions
          }
        default:
          return null
      }
    } catch (error) {
      log.error('SettingsService.getCategorySettings error', error, 'SettingsService')
      throw error
    }
  }

  // 更新特定分类的设置
  static async updateCategorySettings(category: string, categorySettings: Record<string, any>): Promise<boolean> {
    try {
      const currentSettings = await this.getSystemSettings()
      if (!currentSettings) return false

      let updates: Partial<SystemSettings> = {}

      switch (category) {
        case 'packageGrade':
          if (categorySettings.packageGradeThresholds) {
            updates.packageGradeThresholds = categorySettings.packageGradeThresholds
          }
          if (categorySettings.breakEvenConfig) {
            updates.breakEvenConfig = categorySettings.breakEvenConfig
          }
          break
        case 'finalGrade':
          if (categorySettings.finalGradeConfig) {
            updates.finalGradeConfig = categorySettings.finalGradeConfig
          }
          break
        case 'algorithm':
          if (categorySettings.scoringAlgorithm) {
            updates.scoringAlgorithm = categorySettings.scoringAlgorithm
          }
          if (categorySettings.minRatingCount !== undefined) {
            updates.minRatingCount = categorySettings.minRatingCount
          }
          if (categorySettings.timeDecayFactor !== undefined) {
            updates.timeDecayFactor = categorySettings.timeDecayFactor
          }
          if (categorySettings.ratingScoreMap) {
            updates.ratingScoreMap = categorySettings.ratingScoreMap
          }
          break
        case 'dropdown':
          if (categorySettings.countryOptions) {
            updates.countryOptions = categorySettings.countryOptions
          }
          if (categorySettings.ratingOptions) {
            updates.ratingOptions = categorySettings.ratingOptions
          }
          break
        default:
          return false
      }

      const result = await this.updateSettings(updates)
      return result.success
    } catch (error) {
      log.error('SettingsService.updateCategorySettings error', error, 'SettingsService')
      return false
    }
  }

  // 创建默认设置
  private static async createDefaultSettings(): Promise<{ success: boolean; data: SystemSettings }> {
    const defaultSettings = this.getDefaultSettings()
    const settingsData = this.mapSettingsToDatabase(defaultSettings)

    const { data, error } = await supabase
      .from('system_settings')
      .insert([{
        id: this.SETTINGS_ID,
        ...settingsData
      }])
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    const settings = this.mapDatabaseToSettings(data)
    return { success: true, data: settings }
  }

  // 获取默认设置
  private static getDefaultSettings(): SystemSettings {
    return {
      packageGradeThresholds: {
        A: { min: 90, max: 100 },
        B: { min: 80, max: 89 },
        C: { min: 70, max: 79 },
        D: { min: 60, max: 69 },
        E: { min: 0, max: 59 }
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
        { value: '1', label: '1星 - 很差' },
        { value: '2', label: '2星 - 较差' },
        { value: '3', label: '3星 - 一般' },
        { value: '4', label: '4星 - 较好' },
        { value: '5', label: '5星 - 很好' }
      ],
      minRatingCount: 5,
      timeDecayFactor: 0.95,
      ratingScoreMap: {
        1: 20,
        2: 40,
        3: 60,
        4: 80,
        5: 100
      }
    }
  }

  // 映射数据库记录到设置对象
  private static mapDatabaseToSettings(data: any): SystemSettings {
    return {
      packageGradeThresholds: data.package_grade_thresholds || this.getDefaultSettings().packageGradeThresholds,
      breakEvenConfig: data.break_even_config || this.getDefaultSettings().breakEvenConfig,
      finalGradeConfig: data.final_grade_config || this.getDefaultSettings().finalGradeConfig,
      scoringAlgorithm: data.scoring_algorithm || this.getDefaultSettings().scoringAlgorithm,
      countryOptions: data.country_options || this.getDefaultSettings().countryOptions,
      ratingOptions: data.rating_options || this.getDefaultSettings().ratingOptions,
      minRatingCount: data.min_rating_count ?? this.getDefaultSettings().minRatingCount,
      timeDecayFactor: data.time_decay_factor ?? this.getDefaultSettings().timeDecayFactor,
      ratingScoreMap: data.rating_score_map || this.getDefaultSettings().ratingScoreMap
    }
  }

  // 映射设置对象到数据库记录
  private static mapSettingsToDatabase(settings: SystemSettings): any {
    return {
      package_grade_thresholds: settings.packageGradeThresholds,
      break_even_config: settings.breakEvenConfig,
      final_grade_config: settings.finalGradeConfig,
      scoring_algorithm: settings.scoringAlgorithm,
      country_options: settings.countryOptions,
      rating_options: settings.ratingOptions,
      min_rating_count: settings.minRatingCount,
      time_decay_factor: settings.timeDecayFactor,
      rating_score_map: settings.ratingScoreMap
    }
  }
}