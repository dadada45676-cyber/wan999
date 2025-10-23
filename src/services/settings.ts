import { supabase } from '../lib/supabase'
import { APIUtils } from '../utils/api'
import { log as logger } from '../utils/logger'
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
        // 查询所有系统设置
        const { data, error } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')

        if (error) {
          throw new Error(error.message)
        }

        if (!data || data.length === 0) {
          // 设置不存在，创建默认设置
          return this.createDefaultSettings()
        }

        // 将数据库记录转换为 SystemSettings 对象
        const settings = this.mapDatabaseRecordsToSettings(data)
        return { success: true, data: settings }
      },
      {
        cache: false, // 暂时禁用缓存
        timeout: 10000, // 增加超时时间到10秒
        retries: 1, // 减少重试次数
        operation: 'getSystemSettings'
      }
    )
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 获取系统设置（别名方法）
  static async getSystemSettings(): Promise<SystemSettings> {
    logger.info('[SettingsService] 开始直接查询系统设置...');
    
    try {
      // 减少超时时间到2秒，避免长时间等待
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('查询超时')), 2000);
      });

      const queryPromise = supabase
        .from('system_settings')
        .select('*');

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) {
        logger.error('[SettingsService] 查询系统设置失败:', error);
        logger.info('[SettingsService] 返回默认设置');
        return this.getDefaultSettings();
      }

      if (!data || data.length === 0) {
        logger.info('[SettingsService] 未找到系统设置，返回默认设置');
        return this.getDefaultSettings();
      }

      logger.info('[SettingsService] 成功获取系统设置，记录数:', data.length);
      const settings = this.mapDatabaseRecordsToSettings(data);
      logger.info('[SettingsService] 系统设置转换完成');
      return settings;

    } catch (error) {
      logger.error('[SettingsService] SettingsService.getSystemSettings 异常，返回默认设置', error);
      return this.getDefaultSettings();
    }
  }

  // 更新系统设置
  static async updateSettings(updates: Partial<SystemSettings>): Promise<ServiceResponse<SystemSettings>> {
    const result = await APIUtils.apiCall(
      async () => {
        // 验证用户权限
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('用户未登录')
        }

        // 检查用户是否为管理员
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError || !userProfile || userProfile.role !== 'admin') {
          throw new Error('权限不足：只有管理员可以修改系统设置')
        }

        logger.info('[SettingsService] 开始更新系统设置，用户权限验证通过', { userId: user.id, role: userProfile.role })

        // 构建更新数组
        const updatePromises: any[] = []
        
        if (updates.packageGradeThresholds) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'package_grade_thresholds', setting_value: updates.packageGradeThresholds, category: 'package' })
              .select()
          )
        }
        if (updates.breakEvenConfig) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'break_even_config', setting_value: updates.breakEvenConfig, category: 'package' })
              .select()
          )
        }
        if (updates.finalGradeConfig) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'final_grade_config', setting_value: updates.finalGradeConfig, category: 'grade' })
              .select()
          )
        }
        if (updates.scoringAlgorithm) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'scoring_algorithm', setting_value: updates.scoringAlgorithm, category: 'algorithm' })
              .select()
          )
        }
        if (updates.countryOptions) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'country_options', setting_value: updates.countryOptions, category: 'dropdown' })
              .select()
          )
        }
        if (updates.ratingOptions) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'rating_options', setting_value: updates.ratingOptions, category: 'dropdown' })
              .select()
          )
        }
        if (updates.smsProviders) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'sms_providers', setting_value: updates.smsProviders, category: 'dropdown' })
              .select()
          )
        }
        if (updates.sources) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'sources', setting_value: updates.sources, category: 'dropdown' })
              .select()
          )
        }
        if (updates.gamePlatforms) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'game_platforms', setting_value: updates.gamePlatforms, category: 'dropdown' })
              .select()
          )
        }
        if (updates.minRatingCount !== undefined) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'min_rating_count', setting_value: updates.minRatingCount, category: 'algorithm' })
              .select()
          )
        }
        if (updates.timeDecayFactor !== undefined) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'time_decay_factor', setting_value: updates.timeDecayFactor, category: 'algorithm' })
              .select()
          )
        }
        if (updates.ratingScoreMap) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert({ setting_key: 'rating_score_map', setting_value: updates.ratingScoreMap, category: 'algorithm' })
              .select()
          )
        }

        // 执行所有更新
        const results = await Promise.all(updatePromises)
        
        // 检查是否有错误
        for (const result of results) {
          if (result.error) {
            throw new Error(result.error.message)
          }
        }

        // 清除缓存
        APIUtils.cache.delete('settings:get')

        // 重新获取设置
        const { data, error } = await supabase
          .from('system_settings')
          .select('setting_key, setting_value')

        if (error) {
          throw new Error(error.message)
        }

        const settings = this.mapDatabaseRecordsToSettings(data)
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
      logger.error('SettingsService.updateSystemSettings error', error, 'SettingsService')
      return null
    }
  }

  // 重置为默认设置
  static async resetToDefault(): Promise<ServiceResponse<SystemSettings>> {
    const result = await APIUtils.apiCall(
      async () => {
        // 先删除所有现有设置
        await supabase
          .from('system_settings')
          .delete()
          .neq('setting_key', '')

        // 创建默认设置
        const defaultResult = await this.createDefaultSettings()
        return defaultResult
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
      logger.error('SettingsService.resetSystemSettings error', error, 'SettingsService')
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
            ratingOptions: settings.ratingOptions,
            smsProviders: settings.smsProviders,
            sources: settings.sources,
            gamePlatforms: settings.gamePlatforms
          }
        default:
          return null
      }
    } catch (error) {
      logger.error('SettingsService.getCategorySettings error', error, 'SettingsService')
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
          if (categorySettings.smsProviders) {
            updates.smsProviders = categorySettings.smsProviders
          }
          if (categorySettings.sources) {
            updates.sources = categorySettings.sources
          }
          if (categorySettings.gamePlatforms) {
            updates.gamePlatforms = categorySettings.gamePlatforms
          }
          break
        default:
          return false
      }

      const result = await this.updateSettings(updates)
      return result.success
    } catch (error) {
      logger.error('SettingsService.updateCategorySettings error', error, 'SettingsService')
      return false
    }
  }

  // 创建默认设置
  private static async createDefaultSettings(): Promise<{ success: boolean; data: SystemSettings }> {
    const defaultSettings = this.getDefaultSettings()
    
    // 将设置转换为键值对数组
    const settingsArray = [
      { setting_key: 'package_grade_thresholds', setting_value: defaultSettings.packageGradeThresholds, category: 'package' },
      { setting_key: 'break_even_config', setting_value: defaultSettings.breakEvenConfig, category: 'package' },
      { setting_key: 'final_grade_config', setting_value: defaultSettings.finalGradeConfig, category: 'grade' },
      { setting_key: 'scoring_algorithm', setting_value: defaultSettings.scoringAlgorithm, category: 'algorithm' },
      { setting_key: 'country_options', setting_value: defaultSettings.countryOptions, category: 'dropdown' },
      { setting_key: 'rating_options', setting_value: defaultSettings.ratingOptions, category: 'dropdown' },
      { setting_key: 'sms_providers', setting_value: defaultSettings.smsProviders, category: 'dropdown' },
      { setting_key: 'sources', setting_value: defaultSettings.sources, category: 'dropdown' },
      { setting_key: 'game_platforms', setting_value: defaultSettings.gamePlatforms, category: 'dropdown' },
      { setting_key: 'min_rating_count', setting_value: defaultSettings.minRatingCount, category: 'algorithm' },
      { setting_key: 'time_decay_factor', setting_value: defaultSettings.timeDecayFactor, category: 'algorithm' },
      { setting_key: 'rating_score_map', setting_value: defaultSettings.ratingScoreMap, category: 'algorithm' }
    ]

    const { data, error } = await supabase
      .from('system_settings')
      .insert(settingsArray)
      .select('setting_key, setting_value')

    if (error) {
      throw new Error(error.message)
    }

    const settings = this.mapDatabaseRecordsToSettings(data)
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
      smsProviders: ['移动', '联通', '电信', '虚拟运营商'],
      sources: ['来源1', '来源2', '来源3', '来源4'],
      gamePlatforms: ['平台A', '平台B', '平台C', '平台D'],
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



  // 映射多条数据库记录到设置对象
  private static mapDatabaseRecordsToSettings(records: any[]): SystemSettings {
    const defaultSettings = this.getDefaultSettings()
    const settings: SystemSettings = { ...defaultSettings }

    // 遍历所有记录，根据 setting_key 字段组合设置
    records.forEach(record => {
      const key = record.setting_key
      const value = record.setting_value

      switch (key) {
        case 'package_grade_thresholds':
          settings.packageGradeThresholds = value || defaultSettings.packageGradeThresholds
          break
        case 'break_even_config':
          settings.breakEvenConfig = value || defaultSettings.breakEvenConfig
          break
        case 'final_grade_config':
          settings.finalGradeConfig = value || defaultSettings.finalGradeConfig
          break
        case 'scoring_algorithm':
          settings.scoringAlgorithm = value || defaultSettings.scoringAlgorithm
          break
        case 'country_options':
          settings.countryOptions = value || defaultSettings.countryOptions
          break
        case 'rating_options':
          settings.ratingOptions = value || defaultSettings.ratingOptions
          break
        case 'sms_providers':
          settings.smsProviders = value || defaultSettings.smsProviders
          break
        case 'sources':
          settings.sources = value || defaultSettings.sources
          break
        case 'game_platforms':
          settings.gamePlatforms = value || defaultSettings.gamePlatforms
          break
        case 'min_rating_count':
          settings.minRatingCount = value ?? defaultSettings.minRatingCount
          break
        case 'time_decay_factor':
          settings.timeDecayFactor = value ?? defaultSettings.timeDecayFactor
          break
        case 'rating_score_map':
          settings.ratingScoreMap = value || defaultSettings.ratingScoreMap
          break
      }
    })

    return settings
  }


}