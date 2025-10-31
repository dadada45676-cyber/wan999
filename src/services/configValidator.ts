/**
 * 配置验证服务
 * 确保所有配置项的有效性和业务规则一致性
 */

import { logger } from '../utils/logger';

// 配置验证结果接口
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 号码包评级阈值验证
export interface PackageGradeThresholds {
  SS: { min: number };
  S: { min: number };
  A: { min: number };
  B: { min: number };
  C: { min: number };
  D: { min: number };
}

// 评级分数映射验证
export interface RatingScoreMap {
  SS: number;
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
}

// 最终等级配置验证
export interface FinalGradeConfig {
  name: string;
  minScore: number;
  maxScore: number;
  color: string;
}

// 防误杀配置验证
export interface AntiFalsePositiveConfig {
  threshold: number;
  enabled: boolean;
}

// 评分算法配置验证
export interface ScoringAlgorithmConfig {
  type: 'simple' | 'weighted' | 'time_decay';
  minRatingCount: number;
  timeDecayFactor?: number;
  weights?: {
    recent: number;
    historical: number;
  };
}

export class ConfigValidator {
  /**
   * 验证号码包评级阈值配置
   */
  static validatePackageGradeThresholds(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 检查必需字段
      const requiredGrades = ['SS', 'S', 'A', 'B', 'C', 'D'];
      for (const grade of requiredGrades) {
        if (!config[grade] || typeof config[grade].min !== 'number') {
          result.errors.push(`缺少或无效的评级阈值: ${grade}`);
        }
      }

      if (result.errors.length > 0) {
        result.isValid = false;
        return result;
      }

      // 检查阈值递减逻辑
      const thresholds = [
        config.SS.min,
        config.S.min,
        config.A.min,
        config.B.min,
        config.C.min,
        config.D.min
      ];

      for (let i = 0; i < thresholds.length - 1; i++) {
        if (thresholds[i] <= thresholds[i + 1]) {
          result.errors.push(`评级阈值必须递减: ${requiredGrades[i]} (${thresholds[i]}) 应大于 ${requiredGrades[i + 1]} (${thresholds[i + 1]})`);
        }
      }

      // 检查合理范围
      for (let i = 0; i < thresholds.length; i++) {
        if (thresholds[i] < 0 || thresholds[i] > 100) {
          result.warnings.push(`评级阈值 ${requiredGrades[i]} (${thresholds[i]}) 超出合理范围 [0-100]`);
        }
      }

      // 检查D级阈值应为0
      if (config.D.min !== 0) {
        result.warnings.push(`D级阈值建议设为0，当前值: ${config.D.min}`);
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`配置格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 验证评级分数映射配置
   */
  static validateRatingScoreMap(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 检查必需字段
      const requiredGrades = ['SS', 'S', 'A', 'B', 'C', 'D'];
      for (const grade of requiredGrades) {
        if (typeof config[grade] !== 'number') {
          result.errors.push(`缺少或无效的评级分数: ${grade}`);
        }
      }

      if (result.errors.length > 0) {
        result.isValid = false;
        return result;
      }

      // 检查分数递减逻辑
      const scores = [
        config.SS,
        config.S,
        config.A,
        config.B,
        config.C,
        config.D
      ];

      for (let i = 0; i < scores.length - 1; i++) {
        if (scores[i] <= scores[i + 1]) {
          result.errors.push(`评级分数必须递减: ${requiredGrades[i]} (${scores[i]}) 应大于 ${requiredGrades[i + 1]} (${scores[i + 1]})`);
        }
      }

      // 检查分数范围
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] < 0 || scores[i] > 100) {
          result.errors.push(`评级分数 ${requiredGrades[i]} (${scores[i]}) 必须在 [0-100] 范围内`);
        }
      }

      // 检查合理性建议
      if (config.SS < 90) {
        result.warnings.push(`SS级分数 (${config.SS}) 建议设置为90以上`);
      }
      if (config.D > 30) {
        result.warnings.push(`D级分数 (${config.D}) 建议设置为30以下`);
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`配置格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 验证最终等级配置
   */
  static validateFinalGradeConfig(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      if (!Array.isArray(config)) {
        result.errors.push('最终等级配置必须是数组格式');
        result.isValid = false;
        return result;
      }

      // 检查每个等级配置
      const gradeNames = new Set<string>();
      let totalRange = 0;

      for (let i = 0; i < config.length; i++) {
        const grade = config[i];
        
        // 检查必需字段
        if (!grade.name || typeof grade.minScore !== 'number' || typeof grade.maxScore !== 'number' || !grade.color) {
          result.errors.push(`等级配置 ${i + 1} 缺少必需字段 (name, minScore, maxScore, color)`);
          continue;
        }

        // 检查颜色格式
        if (typeof grade.color !== 'string' || !grade.color.match(/^#[0-9a-fA-F]{6}$/)) {
          result.warnings.push(`等级 ${grade.name} 的颜色格式建议使用十六进制格式 (如: #ff0000)`);
        }

        // 检查等级名称唯一性
        if (gradeNames.has(grade.name)) {
          result.errors.push(`重复的等级名称: ${grade.name}`);
        }
        gradeNames.add(grade.name);

        // 检查分数范围有效性
        if (grade.minScore > grade.maxScore) {
          result.errors.push(`等级 ${grade.name} 的最小分数 (${grade.minScore}) 不能大于最大分数 (${grade.maxScore})`);
        }

        // 检查分数范围
        if (grade.minScore < 0 || grade.maxScore > 100) {
          result.errors.push(`等级 ${grade.name} 的分数范围必须在 [0-100] 内`);
        }

        totalRange += (grade.maxScore - grade.minScore + 1);
      }

      // 检查是否覆盖完整分数范围
      const sortedGrades = [...config].sort((a, b) => a.minScore - b.minScore);
      for (let i = 0; i < sortedGrades.length - 1; i++) {
        if (sortedGrades[i].maxScore + 1 !== sortedGrades[i + 1].minScore) {
          result.warnings.push(`等级 ${sortedGrades[i].name} 和 ${sortedGrades[i + 1].name} 之间存在分数间隙`);
        }
      }

      // 检查是否从0开始，到100结束
      if (sortedGrades[0].minScore !== 0) {
        result.warnings.push('等级配置建议从分数0开始');
      }
      if (sortedGrades[sortedGrades.length - 1].maxScore !== 100) {
        result.warnings.push('等级配置建议到分数100结束');
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`配置格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 验证防误杀配置
   */
  static validateAntiFalsePositiveConfig(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 检查必需字段
      if (typeof config.threshold !== 'number') {
        result.errors.push('防误杀阈值必须是数字');
      }
      if (typeof config.enabled !== 'boolean') {
        result.errors.push('防误杀启用状态必须是布尔值');
      }

      if (result.errors.length > 0) {
        result.isValid = false;
        return result;
      }

      // 检查阈值合理性
      if (config.threshold < 1) {
        result.errors.push('防误杀阈值不能小于1');
      }
      if (config.threshold > 10) {
        result.warnings.push(`防误杀阈值 (${config.threshold}) 较高，可能影响数据统计效果`);
      }

      // 建议值检查
      if (config.threshold < 3 && config.enabled) {
        result.warnings.push('防误杀阈值建议设置为3或以上，以确保统计准确性');
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`配置格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 验证评分算法配置
   */
  static validateScoringAlgorithmConfig(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 检查算法类型
      const validTypes = ['simple', 'weighted', 'time_decay'];
      if (!validTypes.includes(config.type)) {
        result.errors.push(`无效的算法类型: ${config.type}，支持的类型: ${validTypes.join(', ')}`);
      }

      // 检查最小评级次数
      if (typeof config.minRatingCount !== 'number' || config.minRatingCount < 1) {
        result.errors.push('最小评级次数必须是大于0的数字');
      }

      // 根据算法类型检查特定配置
      if (config.type === 'time_decay') {
        if (typeof config.timeDecayFactor !== 'number' || config.timeDecayFactor < 0 || config.timeDecayFactor > 1) {
          result.errors.push('时间衰减因子必须是 [0-1] 范围内的数字');
        }
      }

      if (config.type === 'weighted' && config.weights) {
        if (typeof config.weights.recent !== 'number' || typeof config.weights.historical !== 'number') {
          result.errors.push('权重配置必须包含 recent 和 historical 数字字段');
        } else {
          const totalWeight = config.weights.recent + config.weights.historical;
          if (Math.abs(totalWeight - 1) > 0.01) {
            result.warnings.push(`权重总和 (${totalWeight}) 建议等于1`);
          }
        }
      }

      // 合理性检查
      if (config.minRatingCount > 10) {
        result.warnings.push(`最小评级次数 (${config.minRatingCount}) 较高，可能导致很多号码无法获得评分`);
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`配置格式错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 验证所有配置的一致性
   */
  static validateConfigConsistency(configs: {
    packageGradeThresholds?: any;
    ratingScoreMap?: any;
    finalGradeConfig?: any;
    antiFalsePositiveConfig?: any;
    scoringAlgorithmConfig?: any;
  }): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 检查号码包评级阈值与评级分数映射的一致性
      if (configs.packageGradeThresholds && configs.ratingScoreMap) {
        const thresholdGrades = Object.keys(configs.packageGradeThresholds);
        const scoreGrades = Object.keys(configs.ratingScoreMap);
        
        const missingInScore = thresholdGrades.filter(grade => !scoreGrades.includes(grade));
        const missingInThreshold = scoreGrades.filter(grade => !thresholdGrades.includes(grade));
        
        if (missingInScore.length > 0) {
          result.errors.push(`评级分数映射中缺少等级: ${missingInScore.join(', ')}`);
        }
        if (missingInThreshold.length > 0) {
          result.errors.push(`号码包评级阈值中缺少等级: ${missingInThreshold.join(', ')}`);
        }
      }

      // 检查防误杀配置与评分算法配置的一致性
      if (configs.antiFalsePositiveConfig && configs.scoringAlgorithmConfig) {
        if (configs.antiFalsePositiveConfig.enabled && 
            configs.antiFalsePositiveConfig.threshold > configs.scoringAlgorithmConfig.minRatingCount) {
          result.warnings.push(
            `防误杀阈值 (${configs.antiFalsePositiveConfig.threshold}) 大于最小评级次数 (${configs.scoringAlgorithmConfig.minRatingCount})，可能影响评分效果`
          );
        }
      }

      // 检查最终等级配置与评级分数的对应关系
      if (configs.finalGradeConfig && configs.ratingScoreMap) {
        const maxRatingScore = Math.max(...Object.values(configs.ratingScoreMap) as number[]);
        const maxGradeScore = Math.max(...configs.finalGradeConfig.map((g: any) => g.maxScore));
        
        if (maxRatingScore > maxGradeScore) {
          result.warnings.push(
            `最高评级分数 (${maxRatingScore}) 超出最终等级配置的最高分数 (${maxGradeScore})`
          );
        }
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(`一致性检查错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return result;
  }

  /**
   * 批量验证所有配置
   */
  static async validateAllConfigs(configs: {
    packageGradeThresholds?: any;
    ratingScoreMap?: any;
    finalGradeConfig?: any;
    antiFalsePositiveConfig?: any;
    scoringAlgorithmConfig?: any;
  }): Promise<{
    overall: ValidationResult;
    details: Record<string, ValidationResult>;
  }> {
    const details: Record<string, ValidationResult> = {};
    const overall: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 验证各个配置项
      if (configs.packageGradeThresholds) {
        details.packageGradeThresholds = this.validatePackageGradeThresholds(configs.packageGradeThresholds);
      }

      if (configs.ratingScoreMap) {
        details.ratingScoreMap = this.validateRatingScoreMap(configs.ratingScoreMap);
      }

      if (configs.finalGradeConfig) {
        details.finalGradeConfig = this.validateFinalGradeConfig(configs.finalGradeConfig);
      }

      if (configs.antiFalsePositiveConfig) {
        details.antiFalsePositiveConfig = this.validateAntiFalsePositiveConfig(configs.antiFalsePositiveConfig);
      }

      if (configs.scoringAlgorithmConfig) {
        details.scoringAlgorithmConfig = this.validateScoringAlgorithmConfig(configs.scoringAlgorithmConfig);
      }

      // 验证配置一致性
      details.consistency = this.validateConfigConsistency(configs);

      // 汇总结果
      Object.values(details).forEach(result => {
        if (!result.isValid) {
          overall.isValid = false;
        }
        overall.errors.push(...result.errors);
        overall.warnings.push(...result.warnings);
      });

      // 记录验证结果
      logger.info('配置验证完成', {
        isValid: overall.isValid,
        errorCount: overall.errors.length,
        warningCount: overall.warnings.length
      });

    } catch (error) {
      overall.isValid = false;
      overall.errors.push(`配置验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      logger.error('配置验证异常', error);
    }

    return { overall, details };
  }
}

export default ConfigValidator;