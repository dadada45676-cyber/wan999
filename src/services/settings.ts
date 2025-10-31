import { supabase } from '../lib/supabase'
import { APIUtils } from '../utils/api'
import { log as logger } from '../utils/logger'
import type { SystemSettings, ServiceResponse } from '../types'
import { RATING_GRADES } from '../constants'
import { configService } from './configService'

export interface SettingsUpdateRequest {
  category: string
  settings: Record<string, any>
}

export class SettingsService {
  private static readonly SETTINGS_ID = 'default'

  // 获取系统设置 - 使用configService统一管理
  static async getSettings(): Promise<ServiceResponse<SystemSettings>> {
    const result = await APIUtils.apiCall(
      async () => {
        try {
          // 使用configService获取所有配置
          const configs = await configService.getAllConfigs()
          
          // 获取其他系统设置（非核心配置）
          const { data: otherSettings, error } = await supabase
            .from('system_settings')
            .select('setting_key, setting_value')
            .not('setting_key', 'in', '(packageGradeThresholds,ratingScoreMap,finalGradeConfig,antiFalsePositiveConfig,scoringAlgorithm)')

          let additionalSettings = {}
          if (!error && otherSettings) {
            additionalSettings = this.mapAdditionalSettings(otherSettings)
          }

          // 组合所有配置
          const settings: SystemSettings = {
            packageGradeThresholds: this.convertPackageGradeThresholds(configs.package_grade_thresholds),
            finalGradeConfig: configs.final_grade_config as Array<{
              name: 'A' | 'B' | 'C' | 'D' | 'E'
              minScore: number
              maxScore: number
              color: string
            }>,
            ratingScoreMap: this.convertRatingScoreMap(configs.rating_score_mapping),
            antiFalsePositiveConfig: {
              threshold: configs.anti_false_positive_config.threshold,
              enabled: configs.anti_false_positive_config.enabled,
              description: '防误杀配置'
            },
            scoringAlgorithm: this.convertScoringAlgorithm(configs.scoring_algorithm_config),
            ...additionalSettings,
            // 提供默认的其他设置
            breakEvenConfig: (additionalSettings as any).breakEvenConfig || {
              threshold: 16,
              warningLine: 12,
              dangerLine: 8,
              unit: '万分转化数',
              description: '基于万分转化数的保本线配置'
            },
            countryOptions: (additionalSettings as any).countryOptions || ['中国', '美国', '英国', '日本', '韩国'],
            ratingOptions: (additionalSettings as any).ratingOptions || ['1星', '2星', '3星', '4星', '5星'],
            smsProviders: (additionalSettings as any).smsProviders || ['移动', '联通', '电信', '虚拟运营商'],
            sources: (additionalSettings as any).sources || ['来源1', '来源2', '来源3', '来源4'],
            gamePlatforms: (additionalSettings as any).gamePlatforms || ['平台A', '平台B', '平台C', '平台D'],
            minRatingCount: (additionalSettings as any).minRatingCount ?? 5,
            timeDecayFactor: (additionalSettings as any).timeDecayFactor ?? 0.95
          }

          return { success: true, data: settings }
        } catch (error) {
          logger.error('[SettingsService] 获取系统设置失败:', error)
          throw error
        }
      },
      {
        cache: false,
        timeout: 10000,
        retries: 2,
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

      const settings = this.mapDatabaseRecordsToSettings(data);
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

        // 构建更新数组 - 使用正确的 upsert 语法，指定冲突解决策略
        const updatePromises: any[] = []
        
        if (updates.packageGradeThresholds) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'package_grade_thresholds', setting_value: updates.packageGradeThresholds, category: 'package' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.breakEvenConfig) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'break_even_config', setting_value: updates.breakEvenConfig, category: 'package' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.finalGradeConfig) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'final_grade_config', setting_value: updates.finalGradeConfig, category: 'grade' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.scoringAlgorithm) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'scoring_algorithm', setting_value: updates.scoringAlgorithm, category: 'algorithm' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.countryOptions) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'country_options', setting_value: updates.countryOptions, category: 'dropdown' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.ratingOptions) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'rating_options', setting_value: updates.ratingOptions, category: 'dropdown' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.smsProviders) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'sms_providers', setting_value: updates.smsProviders, category: 'dropdown' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.sources) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'sources', setting_value: updates.sources, category: 'dropdown' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.gamePlatforms) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'game_platforms', setting_value: updates.gamePlatforms, category: 'dropdown' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.minRatingCount !== undefined) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'min_rating_count', setting_value: updates.minRatingCount, category: 'algorithm' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.timeDecayFactor !== undefined) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'time_decay_factor', setting_value: updates.timeDecayFactor, category: 'algorithm' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.ratingScoreMap) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'rating_score_map', setting_value: updates.ratingScoreMap, category: 'algorithm' },
                { onConflict: 'setting_key' }
              )
              .select()
          )
        }
        if (updates.antiFalsePositiveConfig) {
          updatePromises.push(
            supabase
              .from('system_settings')
              .upsert(
                { setting_key: 'anti_false_positive_config', setting_value: updates.antiFalsePositiveConfig, category: 'security' },
                { onConflict: 'setting_key' }
              )
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
        case 'security':
          return {
            antiFalsePositiveConfig: settings.antiFalsePositiveConfig
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

      const updates: Partial<SystemSettings> = {}

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
        case 'security':
          if (categorySettings.antiFalsePositiveConfig) {
            updates.antiFalsePositiveConfig = categorySettings.antiFalsePositiveConfig
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
      { setting_key: 'rating_score_map', setting_value: defaultSettings.ratingScoreMap, category: 'algorithm' },
      { setting_key: 'anti_false_positive_config', setting_value: defaultSettings.antiFalsePositiveConfig, category: 'security' }
    ]

    const { data, error } = await supabase
      .from('system_settings')
      .upsert(settingsArray, { onConflict: 'setting_key' })
      .select('setting_key, setting_value')

    if (error) {
      throw new Error(error.message)
    }

    const settings = this.mapDatabaseRecordsToSettings(data)
    return { success: true, data: settings }
  }

  // 配置转换辅助方法
  private static convertPackageGradeThresholds(thresholds: any): any {
    // 将configService的格式转换为SystemSettings期望的格式
    if (!thresholds) return {}
    
    const converted = {}
    Object.keys(thresholds).forEach(grade => {
      if (thresholds[grade] && typeof thresholds[grade].min === 'number') {
        converted[grade] = {
          min: thresholds[grade].min,
          max: grade === 'SS' ? 100 : (thresholds[grade].max || thresholds[grade].min + 10)
        }
      }
    })
    return converted
  }

  private static convertRatingScoreMap(scoreMap: any): any {
    // 确保评级分数映射格式正确
    return scoreMap || {}
  }

  private static convertScoringAlgorithm(algorithmConfig: any): any {
    // 转换评分算法配置
    if (!algorithmConfig) {
      return {
        type: 'weighted',
        weights: {
          ratingScore: 0.6,
          packageSize: 0.3,
          timeDecay: 0.1
        }
      }
    }

    return {
      type: algorithmConfig.type || 'weighted',
      weights: algorithmConfig.weights || {
        ratingScore: 0.6,
        packageSize: 0.3,
        timeDecay: 0.1
      }
    }
  }

  private static mapAdditionalSettings(records: any[]): any {
    const settings = {}
    records.forEach(record => {
      const key = record.setting_key
      const value = record.setting_value
      
      switch (key) {
        case 'break_even_config':
          settings['breakEvenConfig'] = value
          break
        case 'country_options':
          settings['countryOptions'] = value
          break
        case 'rating_options':
          settings['ratingOptions'] = value
          break
        case 'sms_providers':
          settings['smsProviders'] = value
          break
        case 'sources':
          settings['sources'] = value
          break
        case 'game_platforms':
          settings['gamePlatforms'] = value
          break
        case 'min_rating_count':
          settings['minRatingCount'] = value
          break
        case 'time_decay_factor':
          settings['timeDecayFactor'] = value
          break
      }
    })
    return settings
  }

  // 获取默认设置（已弃用，保留用于向后兼容）
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
      minRatingCount: 5,
      timeDecayFactor: 0.95,
      ratingScoreMap: {
        1: 20,
        2: 40,
        3: 60,
        4: 80,
        5: 100
      },
      antiFalsePositiveConfig: {
        threshold: 3,
        enabled: true,
        description: '号码需要在N个不同的号码包中出现才会触发综合评分计算'
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
        case 'rating_score_mapping':
          settings.ratingScoreMap = value || defaultSettings.ratingScoreMap
          break
        case 'anti_false_positive_config':
          settings.antiFalsePositiveConfig = value || defaultSettings.antiFalsePositiveConfig
          break
      }
    })

    return settings
  }

  // 获取评级分数映射配置 - 使用configService
  static async getRatingScoreMapping(): Promise<ServiceResponse<{ [key: string]: number }>> {
    const result = await APIUtils.apiCall(
      async () => {
        try {
          const ratingScoreMap = await configService.getRatingScoreMap()
          logger.info('[SettingsService] 成功获取评级分数映射')
          return { success: true, data: ratingScoreMap }
        } catch (error) {
          logger.error('[SettingsService] 获取评级分数映射失败:', error)
          throw error
        }
      },
      {
        cache: false,
        timeout: 5000,
        retries: 2,
        operation: 'getRatingScoreMapping'
      }
    )
    
    return {
      success: result.success,
      data: result.data?.data as unknown as { [key: string]: number },
      error: result.error?.message
    }
  }

  // 更新评级分数映射配置 - 使用configService
  static async updateRatingScoreMapping(scoreMap: { [key: string]: number }): Promise<ServiceResponse<{ [key: string]: number }>> {
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
          throw new Error('权限不足：只有管理员可以修改评级分数映射配置')
        }

        logger.info('[SettingsService] 开始更新评级分数映射配置，用户权限验证通过', { userId: user.id, role: userProfile.role })

        // 使用configService更新配置
        const updateResult = await configService.updateConfig(
          'ratingScoreMap',
          scoreMap,
          configService.validateConfig.bind(configService, 'rating_score_map')
        )

        if (!updateResult.success) {
          throw new Error(`更新评级分数映射失败: ${updateResult.validation?.errors?.join(', ') || '未知错误'}`)
        }

        // 清除相关缓存
        configService.clearCache('ratingScoreMap')
        APIUtils.cache.delete('settings:get')
        
        logger.info('[SettingsService] 评级分数映射配置更新成功')
        return { success: true, data: scoreMap }
      },
      {
        cache: false,
        retries: 2,
        operation: 'updateRatingScoreMapping'
      }
    )
    
    return {
      success: result.success,
      data: result.success ? scoreMap : undefined,
      error: result.error?.message
    }
  }

  // 重置评级分数映射为默认值
  static async resetRatingScoreMappingToDefault(): Promise<ServiceResponse<{ [key: string]: number }>> {
    const defaultMap = { 'SS': 100, 'S': 85, 'A': 70, 'B': 55, 'C': 40, 'D': 25 };
    return await this.updateRatingScoreMapping(defaultMap);
  }

  // 验证评级分数映射配置
  static validateRatingScoreMapping(scoreMap: { [key: string]: number }): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const ratings = RATING_GRADES;
    const scores = ratings.map(r => scoreMap[r]);
    
    // 范围验证
    const ranges = {
      'SS': [80, 100], 'S': [70, 95], 'A': [60, 85],
      'B': [45, 70], 'C': [30, 55], 'D': [10, 40]
    };
    
    ratings.forEach(rating => {
      const score = scoreMap[rating];
      const [min, max] = ranges[rating as keyof typeof ranges];
      if (score < min || score > max) {
        errors[rating] = `分数必须在${min}-${max}分之间`;
      }
    });
    
    // 严格递减验证
    for (let i = 0; i < scores.length - 1; i++) {
      if (scores[i] <= scores[i + 1]) {
        errors[ratings[i]] = `分数必须高于${ratings[i + 1]}级`;
      }
    }
    
    // 最小差距验证
    for (let i = 0; i < scores.length - 1; i++) {
      if (scores[i] - scores[i + 1] < 5) {
        errors[ratings[i]] = `与${ratings[i + 1]}级差距不能小于5分`;
      }
    }
    
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  // 获取防误杀配置 - 使用configService
  static async getAntiFalsePositiveConfig(): Promise<ServiceResponse<{ threshold: number; enabled: boolean; description: string }>> {
    const result = await APIUtils.apiCall(
      async () => {
        try {
          const config = await configService.getAntiFalsePositiveConfig()
          const formattedConfig = {
            threshold: config.threshold,
            enabled: config.enabled,
            description: '号码需要在N个不同的号码包中出现才会触发综合评分计算'
          }
          logger.info('[SettingsService] 成功获取防误杀配置')
          return { success: true, data: formattedConfig }
        } catch (error) {
          logger.error('[SettingsService] 获取防误杀配置失败:', error)
          throw error
        }
      },
      {
        cache: false,
        timeout: 5000,
        retries: 2,
        operation: 'getAntiFalsePositiveConfig'
      }
    )
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 更新防误杀配置 - 使用configService
  static async updateAntiFalsePositiveConfig(config: { threshold: number; enabled: boolean; description: string }): Promise<ServiceResponse<{ threshold: number; enabled: boolean; description: string }>> {
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
          throw new Error('权限不足：只有管理员可以修改防误杀配置')
        }

        logger.info('[SettingsService] 开始更新防误杀配置，用户权限验证通过', { userId: user.id, role: userProfile.role })

        // 使用configService更新配置
        const updateConfig = {
          threshold: config.threshold,
          enabled: config.enabled
        }
        
        await configService.updateAntiFalsePositiveConfig(updateConfig)
        
        logger.info('[SettingsService] 防误杀配置更新成功')
        return { success: true, data: config }
      },
      {
        cache: false,
        retries: 2,
        operation: 'updateAntiFalsePositiveConfig'
      }
    )
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 重置防误杀配置为默认值
  static async resetAntiFalsePositiveConfigToDefault(): Promise<ServiceResponse<{ threshold: number; enabled: boolean; description: string }>> {
    const defaultConfig = { threshold: 3, enabled: true, description: '号码需要在N个不同的号码包中出现才会触发综合评分计算' };
    return await this.updateAntiFalsePositiveConfig(defaultConfig);
  }

  // 验证防误杀配置
  static validateAntiFalsePositiveConfig(config: { threshold: number; enabled: boolean; description: string }): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    
    // 阈值验证
    if (config.threshold < 1 || config.threshold > 10) {
      errors.threshold = '防误杀阈值必须在1-10之间';
    }
    
    // 描述验证
    if (!config.description || config.description.trim().length === 0) {
      errors.description = '描述不能为空';
    }
    
    return { isValid: Object.keys(errors).length === 0, errors };
  }

}