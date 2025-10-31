/**
 * 统一配置服务
 * 负责从数据库获取和缓存所有系统配置
 * 消除硬编码配置，实现配置驱动的业务逻辑
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import ConfigValidator, { ValidationResult } from './configValidator';

// 配置缓存接口
interface ConfigCache {
  data: any;
  timestamp: number;
  ttl: number; // 缓存生存时间（毫秒）
}

// 配置项类型定义
export interface PackageGradeThresholds {
  SS: { min: number };
  S: { min: number };
  A: { min: number };
  B: { min: number };
  C: { min: number };
  D: { min: number };
}

export interface RatingScoreMap {
  SS: number;
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
}

export interface FinalGradeConfig {
  name: string;
  minScore: number;
  maxScore: number;
  color: string;
}

export interface AntiFalsePositiveConfig {
  threshold: number;
  enabled: boolean;
}

export interface ScoringAlgorithmConfig {
  type: 'simple' | 'weighted' | 'time_decay';
  minRatingCount: number;
  timeDecayFactor?: number;
  weights?: {
    recent: number;
    historical: number;
  };
}

export class ConfigService {
  private static instance: ConfigService;
  private cache: Map<string, ConfigCache> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分钟缓存

  // 默认配置值
  private readonly DEFAULT_PACKAGE_GRADE_THRESHOLDS: PackageGradeThresholds = {
    SS: { min: 50 },
    S: { min: 30 },
    A: { min: 20 },
    B: { min: 16 },
    C: { min: 10 },
    D: { min: 0 }
  };

  private readonly DEFAULT_RATING_SCORE_MAP: RatingScoreMap = {
    SS: 100,
    S: 85,
    A: 70,
    B: 55,
    C: 40,
    D: 25
  };

  private readonly DEFAULT_FINAL_GRADE_CONFIG: FinalGradeConfig[] = [
    { name: 'A', minScore: 80, maxScore: 100, color: '#10b981' },
    { name: 'B', minScore: 60, maxScore: 79, color: '#3b82f6' },
    { name: 'C', minScore: 40, maxScore: 59, color: '#f59e0b' },
    { name: 'D', minScore: 20, maxScore: 39, color: '#f97316' },
    { name: 'E', minScore: 0, maxScore: 19, color: '#ef4444' }
  ];

  private readonly DEFAULT_ANTI_FALSE_POSITIVE_CONFIG: AntiFalsePositiveConfig = {
    threshold: 3,
    enabled: true
  };

  private readonly DEFAULT_SCORING_ALGORITHM_CONFIG: ScoringAlgorithmConfig = {
    type: 'weighted',
    minRatingCount: 3,
    timeDecayFactor: 0.1
  };

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < cached.ttl;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * 获取缓存
   */
  private getCache(key: string): any | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)?.data || null;
    }
    return null;
  }

  /**
   * 清除指定配置的缓存
   */
  public clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      logger.info(`已清除配置缓存: ${key}`);
    } else {
      this.cache.clear();
      logger.info('已清除所有配置缓存');
    }
  }

  /**
   * 从数据库获取配置并验证
   */
  private async fetchConfigFromDB<T>(
    settingKey: string,
    defaultValue: T,
    validator?: (config: any) => ValidationResult
  ): Promise<T> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', settingKey)
        .eq('is_active', true)
        .single();

      if (error) {
        logger.warn(`获取配置失败，使用默认值: ${settingKey}`, error);
        return defaultValue;
      }

      if (!data?.setting_value) {
        logger.warn(`配置为空，使用默认值: ${settingKey}`);
        return defaultValue;
      }

      const config = data.setting_value;

      // 验证配置
      if (validator) {
        const validation = validator(config);
        if (!validation.isValid) {
          logger.error(`配置验证失败: ${settingKey}`, {
            errors: validation.errors,
            warnings: validation.warnings
          });
          return defaultValue;
        }
        
        if (validation.warnings.length > 0) {
          logger.warn(`配置验证警告: ${settingKey}`, validation.warnings);
        }
      }

      return config as T;
    } catch (error) {
      logger.error(`获取配置异常: ${settingKey}`, error);
      return defaultValue;
    }
  }

  /**
   * 获取号码包评级阈值配置
   */
  async getPackageGradeThresholds(): Promise<PackageGradeThresholds> {
    const cacheKey = 'packageGradeThresholds';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const config = await this.fetchConfigFromDB(
      'packageGradeThresholds',
      this.DEFAULT_PACKAGE_GRADE_THRESHOLDS,
      ConfigValidator.validatePackageGradeThresholds
    );

    this.setCache(cacheKey, config);
    return config;
  }

  /**
   * 获取号码包评级配置（别名方法，兼容测试）
   */
  async getPackageGradeConfig(): Promise<PackageGradeThresholds> {
    return this.getPackageGradeThresholds();
  }

  /**
   * 获取所有配置
   */
  async getAllConfigs(): Promise<{
    package_grade_thresholds: PackageGradeThresholds;
    rating_score_mapping: RatingScoreMap;
    final_grade_config: FinalGradeConfig[];
    anti_false_positive_config: AntiFalsePositiveConfig;
    scoring_algorithm_config: ScoringAlgorithmConfig;
  }> {
    const [
      packageGradeThresholds,
      ratingScoreMap,
      finalGradeConfig,
      antiFalsePositiveConfig,
      scoringAlgorithmConfig
    ] = await Promise.all([
      this.getPackageGradeThresholds(),
      this.getRatingScoreMap(),
      this.getFinalGradeConfig(),
      this.getAntiFalsePositiveConfig(),
      this.getScoringAlgorithmConfig()
    ]);

    return {
      package_grade_thresholds: packageGradeThresholds,
      rating_score_mapping: ratingScoreMap,
      final_grade_config: finalGradeConfig,
      anti_false_positive_config: antiFalsePositiveConfig,
      scoring_algorithm_config: scoringAlgorithmConfig
    };
  }

  /**
   * 验证单个配置
   */
  async validateConfig(configKey: string, configValue: any): Promise<ValidationResult> {
    try {
      switch (configKey) {
        case 'package_grade_thresholds':
          return ConfigValidator.validatePackageGradeThresholds(configValue);
        case 'rating_score_map':
          return ConfigValidator.validateRatingScoreMap(configValue);
        case 'final_grade_config':
          return ConfigValidator.validateFinalGradeConfig(configValue);
        case 'anti_false_positive_config':
          return ConfigValidator.validateAntiFalsePositiveConfig(configValue);
        case 'scoring_algorithm_config':
          return ConfigValidator.validateScoringAlgorithmConfig(configValue);
        default:
          return {
            isValid: false,
            errors: [`未知的配置类型: ${configKey}`],
            warnings: []
          };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [`配置验证异常: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * 获取评级分数映射配置
   */
  async getRatingScoreMap(): Promise<RatingScoreMap> {
    const cacheKey = 'ratingScoreMap';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const config = await this.fetchConfigFromDB(
      'ratingScoreMap',
      this.DEFAULT_RATING_SCORE_MAP,
      ConfigValidator.validateRatingScoreMap
    );

    this.setCache(cacheKey, config);
    return config;
  }

  /**
   * 获取最终等级配置
   */
  async getFinalGradeConfig(): Promise<FinalGradeConfig[]> {
    const cacheKey = 'finalGradeConfig';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const config = await this.fetchConfigFromDB(
      'finalGradeConfig',
      this.DEFAULT_FINAL_GRADE_CONFIG,
      ConfigValidator.validateFinalGradeConfig
    );

    this.setCache(cacheKey, config);
    return config;
  }

  /**
   * 获取防误杀配置
   */
  async getAntiFalsePositiveConfig(): Promise<AntiFalsePositiveConfig> {
    const cacheKey = 'antiFalsePositiveConfig';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('anti_false_positive_config')
        .select('threshold, enabled')
        .eq('enabled', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let config: AntiFalsePositiveConfig;
      if (error || !data) {
        logger.warn('获取防误杀配置失败，使用默认值', error);
        config = this.DEFAULT_ANTI_FALSE_POSITIVE_CONFIG;
      } else {
        config = {
          threshold: data.threshold,
          enabled: data.enabled
        };

        // 验证配置
        const validation = ConfigValidator.validateAntiFalsePositiveConfig(config);
        if (!validation.isValid) {
          logger.error('防误杀配置验证失败', validation.errors);
          config = this.DEFAULT_ANTI_FALSE_POSITIVE_CONFIG;
        } else if (validation.warnings.length > 0) {
          logger.warn('防误杀配置验证警告', validation.warnings);
        }
      }

      this.setCache(cacheKey, config);
      return config;
    } catch (error) {
      logger.error('获取防误杀配置异常', error);
      return this.DEFAULT_ANTI_FALSE_POSITIVE_CONFIG;
    }
  }

  /**
   * 获取评分算法配置
   */
  async getScoringAlgorithmConfig(): Promise<ScoringAlgorithmConfig> {
    const cacheKey = 'scoringAlgorithmConfig';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const config = await this.fetchConfigFromDB(
      'scoringAlgorithm',
      this.DEFAULT_SCORING_ALGORITHM_CONFIG,
      ConfigValidator.validateScoringAlgorithmConfig
    );

    this.setCache(cacheKey, config);
    return config;
  }

  /**
   * 更新配置并验证
   */
  async updateConfig(
    settingKey: string,
    newValue: any,
    validator?: (config: any) => ValidationResult
  ): Promise<{ success: boolean; validation?: ValidationResult }> {
    try {
      // 先验证配置
      if (validator) {
        const validation = validator(newValue);
        if (!validation.isValid) {
          logger.error(`配置验证失败，拒绝更新: ${settingKey}`, validation.errors);
          return { success: false, validation };
        }
        
        if (validation.warnings.length > 0) {
          logger.warn(`配置验证警告: ${settingKey}`, validation.warnings);
        }
      }

      // 更新数据库
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: settingKey,
          setting_value: newValue,
          is_active: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        logger.error(`更新配置失败: ${settingKey}`, error);
        return { success: false };
      }

      // 清除相关缓存
      this.clearCache(settingKey);
      
      logger.info(`配置更新成功: ${settingKey}`);
      return { success: true, validation: validator ? validator(newValue) : undefined };
    } catch (error) {
      logger.error(`更新配置异常: ${settingKey}`, error);
      return { success: false };
    }
  }

  /**
   * 更新防误杀配置
   */
  async updateAntiFalsePositiveConfig(config: AntiFalsePositiveConfig): Promise<{ success: boolean; validation?: ValidationResult }> {
    try {
      // 验证配置
      const validation = ConfigValidator.validateAntiFalsePositiveConfig(config);
      if (!validation.isValid) {
        logger.error('防误杀配置验证失败', validation.errors);
        return { success: false, validation };
      }

      // 先禁用所有现有配置
      await supabase
        .from('anti_false_positive_config')
        .update({ enabled: false })
        .eq('enabled', true);

      // 插入新配置
      const { error } = await supabase
        .from('anti_false_positive_config')
        .insert({
          threshold: config.threshold,
          enabled: config.enabled,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('更新防误杀配置失败', error);
        return { success: false };
      }

      // 清除缓存
      this.clearCache('antiFalsePositiveConfig');
      
      logger.info('防误杀配置更新成功', config);
      return { success: true, validation };
    } catch (error) {
      logger.error('更新防误杀配置异常', error);
      return { success: false };
    }
  }

  /**
   * 批量验证所有配置
   */
  async validateAllConfigs(): Promise<{
    overall: ValidationResult;
    details: Record<string, ValidationResult>;
  }> {
    const configs = {
      packageGradeThresholds: await this.getPackageGradeThresholds(),
      ratingScoreMap: await this.getRatingScoreMap(),
      finalGradeConfig: await this.getFinalGradeConfig(),
      antiFalsePositiveConfig: await this.getAntiFalsePositiveConfig(),
      scoringAlgorithmConfig: await this.getScoringAlgorithmConfig()
    };

    return ConfigValidator.validateAllConfigs(configs);
  }

  /**
   * 获取配置状态概览
   */
  async getConfigStatus(): Promise<{
    cacheStatus: Record<string, boolean>;
    lastUpdated: Record<string, string>;
    validation: {
      overall: ValidationResult;
      details: Record<string, ValidationResult>;
    };
  }> {
    const configKeys = [
      'packageGradeThresholds',
      'ratingScoreMap', 
      'finalGradeConfig',
      'antiFalsePositiveConfig',
      'scoringAlgorithmConfig'
    ];

    const cacheStatus: Record<string, boolean> = {};
    const lastUpdated: Record<string, string> = {};

    // 检查缓存状态
    configKeys.forEach(key => {
      cacheStatus[key] = this.isCacheValid(key);
    });

    // 获取最后更新时间
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_key, updated_at')
        .in('setting_key', configKeys.slice(0, -2)); // 排除防误杀和算法配置

      data?.forEach(item => {
        lastUpdated[item.setting_key] = item.updated_at;
      });

      // 获取防误杀配置更新时间
      const { data: afpData } = await supabase
        .from('anti_false_positive_config')
        .select('created_at')
        .eq('enabled', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (afpData) {
        lastUpdated.antiFalsePositiveConfig = afpData.created_at;
      }
    } catch (error) {
      logger.error('获取配置更新时间失败', error);
    }

    // 验证所有配置
    const validation = await this.validateAllConfigs();

    return {
      cacheStatus,
      lastUpdated,
      validation
    };
  }

  /**
   * 触发配置重新加载
   */
  async reloadConfigs(): Promise<void> {
    this.clearCache();
    
    // 预加载所有配置
    await Promise.all([
      this.getPackageGradeThresholds(),
      this.getRatingScoreMap(),
      this.getFinalGradeConfig(),
      this.getAntiFalsePositiveConfig(),
      this.getScoringAlgorithmConfig()
    ]);

    logger.info('配置重新加载完成');
  }
}

// 导出单例实例
export const configService = ConfigService.getInstance();
export default configService;