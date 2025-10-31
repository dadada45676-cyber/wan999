-- 增强配置相关数据库函数
-- 确保数据库层与应用层逻辑统一
-- 创建时间: 2024-01-20

-- 1. 创建获取号码包评级阈值的函数
CREATE OR REPLACE FUNCTION get_package_grade_thresholds()
RETURNS JSONB AS $$
DECLARE
    thresholds JSONB;
BEGIN
    SELECT setting_value INTO thresholds
    FROM system_settings 
    WHERE setting_key = 'packageGradeThresholds'
    AND is_active = true;
    
    -- 如果没有配置，返回默认值
    IF thresholds IS NULL THEN
        thresholds := '{"SS":{"min":50},"S":{"min":30},"A":{"min":20},"B":{"min":16},"C":{"min":10},"D":{"min":0}}'::jsonb;
    END IF;
    
    RETURN thresholds;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建获取评级分数映射的函数
CREATE OR REPLACE FUNCTION get_rating_score_map()
RETURNS JSONB AS $$
DECLARE
    score_map JSONB;
BEGIN
    SELECT setting_value INTO score_map
    FROM system_settings 
    WHERE setting_key = 'ratingScoreMap'
    AND is_active = true;
    
    -- 如果没有配置，返回默认值
    IF score_map IS NULL THEN
        score_map := '{"SS":100,"S":85,"A":70,"B":55,"C":40,"D":25}'::jsonb;
    END IF;
    
    RETURN score_map;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建获取最终等级配置的函数
CREATE OR REPLACE FUNCTION get_final_grade_config()
RETURNS JSONB AS $$
DECLARE
    grade_config JSONB;
BEGIN
    SELECT setting_value INTO grade_config
    FROM system_settings 
    WHERE setting_key = 'finalGradeConfig'
    AND is_active = true;
    
    -- 如果没有配置，返回默认值
    IF grade_config IS NULL THEN
        grade_config := '[{"name":"A","minScore":80,"maxScore":100},{"name":"B","minScore":60,"maxScore":79},{"name":"C","minScore":40,"maxScore":59},{"name":"D","minScore":20,"maxScore":39},{"name":"E","minScore":0,"maxScore":19}]'::jsonb;
    END IF;
    
    RETURN grade_config;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建获取防误杀配置的函数
CREATE OR REPLACE FUNCTION get_anti_false_positive_config()
RETURNS JSONB AS $$
DECLARE
    config JSONB;
BEGIN
    SELECT jsonb_build_object(
        'threshold', threshold,
        'enabled', enabled
    ) INTO config
    FROM anti_false_positive_config 
    WHERE enabled = true 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- 如果没有配置，返回默认值
    IF config IS NULL THEN
        config := '{"threshold":3,"enabled":true}'::jsonb;
    END IF;
    
    RETURN config;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建获取评分算法配置的函数
CREATE OR REPLACE FUNCTION get_scoring_algorithm_config()
RETURNS JSONB AS $$
DECLARE
    algorithm_config JSONB;
BEGIN
    SELECT setting_value INTO algorithm_config
    FROM system_settings 
    WHERE setting_key = 'scoringAlgorithm'
    AND is_active = true;
    
    -- 如果没有配置，返回默认值
    IF algorithm_config IS NULL THEN
        algorithm_config := '{"type":"weighted","minRatingCount":3,"timeDecayFactor":0.1}'::jsonb;
    END IF;
    
    RETURN algorithm_config;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建计算号码包评级的函数
CREATE OR REPLACE FUNCTION calculate_package_grade(conversion_rate NUMERIC)
RETURNS TEXT AS $$
DECLARE
    thresholds JSONB;
BEGIN
    thresholds := get_package_grade_thresholds();
    
    -- 按照从高到低的顺序检查阈值
    IF conversion_rate >= (thresholds->'SS'->>'min')::NUMERIC THEN
        RETURN 'SS';
    ELSIF conversion_rate >= (thresholds->'S'->>'min')::NUMERIC THEN
        RETURN 'S';
    ELSIF conversion_rate >= (thresholds->'A'->>'min')::NUMERIC THEN
        RETURN 'A';
    ELSIF conversion_rate >= (thresholds->'B'->>'min')::NUMERIC THEN
        RETURN 'B';
    ELSIF conversion_rate >= (thresholds->'C'->>'min')::NUMERIC THEN
        RETURN 'C';
    ELSE
        RETURN 'D';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建获取评级分数的函数
CREATE OR REPLACE FUNCTION get_rating_score(rating TEXT)
RETURNS INTEGER AS $$
DECLARE
    score_map JSONB;
    score INTEGER;
BEGIN
    score_map := get_rating_score_map();
    score := (score_map->>rating)::INTEGER;
    
    -- 如果没有找到对应评级，返回0
    IF score IS NULL THEN
        score := 0;
    END IF;
    
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建计算最终等级的函数
CREATE OR REPLACE FUNCTION calculate_final_grade(average_score NUMERIC)
RETURNS TEXT AS $$
DECLARE
    grade_config JSONB;
    grade_item JSONB;
    i INTEGER;
BEGIN
    grade_config := get_final_grade_config();
    
    -- 遍历等级配置
    FOR i IN 0..jsonb_array_length(grade_config) - 1 LOOP
        grade_item := grade_config->i;
        
        IF average_score >= (grade_item->>'minScore')::NUMERIC 
           AND average_score <= (grade_item->>'maxScore')::NUMERIC THEN
            RETURN grade_item->>'name';
        END IF;
    END LOOP;
    
    -- 如果没有匹配的等级，返回E
    RETURN 'E';
END;
$$ LANGUAGE plpgsql;

-- 9. 增强防误杀统计更新函数
CREATE OR REPLACE FUNCTION update_phone_rating_stats_enhanced()
RETURNS TRIGGER AS $$
DECLARE
    config JSONB;
    config_threshold INTEGER;
    unique_packages INTEGER;
    total_count INTEGER;
    should_calculate BOOLEAN;
    algorithm_config JSONB;
    min_rating_count INTEGER;
BEGIN
    -- 获取防误杀配置
    config := get_anti_false_positive_config();
    config_threshold := (config->>'threshold')::INTEGER;
    
    -- 获取算法配置
    algorithm_config := get_scoring_algorithm_config();
    min_rating_count := (algorithm_config->>'minRatingCount')::INTEGER;
    
    -- 统计该号码在不同包中的评级次数
    SELECT 
        COUNT(DISTINCT package_id),
        COUNT(*)
    INTO unique_packages, total_count
    FROM phone_rating_history 
    WHERE phone_number = NEW.phone_number 
    AND counted_for_threshold = true;
    
    -- 判断是否达到防误杀阈值和最小评级次数
    should_calculate := unique_packages >= config_threshold AND total_count >= min_rating_count;
    
    -- 更新或插入统计记录
    INSERT INTO phone_rating_stats (
        phone_number, 
        total_ratings, 
        unique_packages_count, 
        threshold_met,
        last_updated
    ) VALUES (
        NEW.phone_number, 
        total_count, 
        unique_packages, 
        should_calculate,
        NOW()
    )
    ON CONFLICT (phone_number) 
    DO UPDATE SET
        total_ratings = EXCLUDED.total_ratings,
        unique_packages_count = EXCLUDED.unique_packages_count,
        threshold_met = EXCLUDED.threshold_met,
        last_updated = EXCLUDED.last_updated;
    
    -- 如果达到阈值，计算最终评分
    IF should_calculate THEN
        UPDATE phone_rating_stats 
        SET final_score = (
            SELECT AVG(rating_score::FLOAT) 
            FROM phone_rating_history 
            WHERE phone_number = NEW.phone_number
        )
        WHERE phone_number = NEW.phone_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. 更新触发器使用增强版函数
DROP TRIGGER IF EXISTS trigger_update_phone_rating_stats ON phone_rating_history;
CREATE TRIGGER trigger_update_phone_rating_stats_enhanced
    AFTER INSERT ON phone_rating_history
    FOR EACH ROW EXECUTE FUNCTION update_phone_rating_stats_enhanced();

-- 11. 创建批量重算号码评分的函数
CREATE OR REPLACE FUNCTION recalculate_phone_scores()
RETURNS INTEGER AS $$
DECLARE
    phone_record RECORD;
    updated_count INTEGER := 0;
    config JSONB;
    config_threshold INTEGER;
    algorithm_config JSONB;
    min_rating_count INTEGER;
    unique_packages INTEGER;
    total_count INTEGER;
    should_calculate BOOLEAN;
    final_score NUMERIC;
BEGIN
    -- 获取配置
    config := get_anti_false_positive_config();
    config_threshold := (config->>'threshold')::INTEGER;
    algorithm_config := get_scoring_algorithm_config();
    min_rating_count := (algorithm_config->>'minRatingCount')::INTEGER;
    
    -- 遍历所有有评级历史的号码
    FOR phone_record IN 
        SELECT DISTINCT phone_number 
        FROM phone_rating_history
    LOOP
        -- 统计该号码的评级情况
        SELECT 
            COUNT(DISTINCT package_id),
            COUNT(*)
        INTO unique_packages, total_count
        FROM phone_rating_history 
        WHERE phone_number = phone_record.phone_number 
        AND counted_for_threshold = true;
        
        -- 判断是否达到阈值
        should_calculate := unique_packages >= config_threshold AND total_count >= min_rating_count;
        
        -- 计算最终评分
        IF should_calculate THEN
            SELECT AVG(rating_score::FLOAT) INTO final_score
            FROM phone_rating_history 
            WHERE phone_number = phone_record.phone_number;
        ELSE
            final_score := NULL;
        END IF;
        
        -- 更新或插入统计记录
        INSERT INTO phone_rating_stats (
            phone_number, 
            total_ratings, 
            unique_packages_count, 
            threshold_met,
            final_score,
            last_updated
        ) VALUES (
            phone_record.phone_number, 
            total_count, 
            unique_packages, 
            should_calculate,
            final_score,
            NOW()
        )
        ON CONFLICT (phone_number) 
        DO UPDATE SET
            total_ratings = EXCLUDED.total_ratings,
            unique_packages_count = EXCLUDED.unique_packages_count,
            threshold_met = EXCLUDED.threshold_met,
            final_score = EXCLUDED.final_score,
            last_updated = EXCLUDED.last_updated;
            
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 12. 创建配置变更日志表
CREATE TABLE IF NOT EXISTS config_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES auth.users(id),
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. 创建配置变更触发器函数
CREATE OR REPLACE FUNCTION log_config_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- 记录配置变更
    INSERT INTO config_change_log (
        setting_key,
        old_value,
        new_value,
        changed_by,
        change_reason
    ) VALUES (
        NEW.setting_key,
        OLD.setting_value,
        NEW.setting_value,
        auth.uid(),
        '系统配置更新'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. 创建系统设置表的变更触发器
DROP TRIGGER IF EXISTS trigger_log_system_settings_changes ON system_settings;
CREATE TRIGGER trigger_log_system_settings_changes
    AFTER UPDATE ON system_settings
    FOR EACH ROW 
    WHEN (OLD.setting_value IS DISTINCT FROM NEW.setting_value)
    EXECUTE FUNCTION log_config_changes();

-- 15. 创建防误杀配置变更触发器
DROP TRIGGER IF EXISTS trigger_log_anti_false_positive_changes ON anti_false_positive_config;
CREATE TRIGGER trigger_log_anti_false_positive_changes
    AFTER UPDATE ON anti_false_positive_config
    FOR EACH ROW 
    WHEN (OLD.threshold IS DISTINCT FROM NEW.threshold OR OLD.enabled IS DISTINCT FROM NEW.enabled)
    EXECUTE FUNCTION log_config_changes();

-- 16. 授权访问新函数和表
GRANT EXECUTE ON FUNCTION get_package_grade_thresholds() TO authenticated;
GRANT EXECUTE ON FUNCTION get_rating_score_map() TO authenticated;
GRANT EXECUTE ON FUNCTION get_final_grade_config() TO authenticated;
GRANT EXECUTE ON FUNCTION get_anti_false_positive_config() TO authenticated;
GRANT EXECUTE ON FUNCTION get_scoring_algorithm_config() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_package_grade(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rating_score(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_final_grade(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_phone_scores() TO authenticated;

-- 配置变更日志表权限
ALTER TABLE config_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read config logs" ON config_change_log
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow system to insert config logs" ON config_change_log
    FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT ON config_change_log TO authenticated;
GRANT INSERT ON config_change_log TO authenticated;

-- 17. 创建配置一致性检查函数
CREATE OR REPLACE FUNCTION check_config_consistency()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    message TEXT
) AS $$
BEGIN
    -- 检查号码包评级阈值配置
    RETURN QUERY
    SELECT 
        'package_grade_thresholds'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM system_settings WHERE setting_key = 'packageGradeThresholds') 
             THEN 'OK'::TEXT 
             ELSE 'MISSING'::TEXT 
        END,
        CASE WHEN EXISTS(SELECT 1 FROM system_settings WHERE setting_key = 'packageGradeThresholds') 
             THEN '号码包评级阈值配置正常'::TEXT 
             ELSE '缺少号码包评级阈值配置'::TEXT 
        END;
    
    -- 检查评级分数映射配置
    RETURN QUERY
    SELECT 
        'rating_score_map'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM system_settings WHERE setting_key = 'ratingScoreMap') 
             THEN 'OK'::TEXT 
             ELSE 'MISSING'::TEXT 
        END,
        CASE WHEN EXISTS(SELECT 1 FROM system_settings WHERE setting_key = 'ratingScoreMap') 
             THEN '评级分数映射配置正常'::TEXT 
             ELSE '缺少评级分数映射配置'::TEXT 
        END;
    
    -- 检查最终等级配置
    RETURN QUERY
    SELECT 
        'final_grade_config'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM system_settings WHERE setting_key = 'finalGradeConfig') 
             THEN 'OK'::TEXT 
             ELSE 'MISSING'::TEXT 
        END,
        CASE WHEN EXISTS(SELECT 1 FROM system_settings WHERE setting_key = 'finalGradeConfig') 
             THEN '最终等级配置正常'::TEXT 
             ELSE '缺少最终等级配置'::TEXT 
        END;
    
    -- 检查防误杀配置
    RETURN QUERY
    SELECT 
        'anti_false_positive_config'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM anti_false_positive_config WHERE enabled = true) 
             THEN 'OK'::TEXT 
             ELSE 'MISSING'::TEXT 
        END,
        CASE WHEN EXISTS(SELECT 1 FROM anti_false_positive_config WHERE enabled = true) 
             THEN '防误杀配置正常'::TEXT 
             ELSE '缺少防误杀配置或未启用'::TEXT 
        END;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION check_config_consistency() TO authenticated;

-- 18. 验证所有函数创建成功
DO $$
BEGIN
    RAISE NOTICE '数据库层配置函数增强完成';
    RAISE NOTICE '已创建的函数:';
    RAISE NOTICE '- get_package_grade_thresholds()';
    RAISE NOTICE '- get_rating_score_map()';
    RAISE NOTICE '- get_final_grade_config()';
    RAISE NOTICE '- get_anti_false_positive_config()';
    RAISE NOTICE '- get_scoring_algorithm_config()';
    RAISE NOTICE '- calculate_package_grade(NUMERIC)';
    RAISE NOTICE '- get_rating_score(TEXT)';
    RAISE NOTICE '- calculate_final_grade(NUMERIC)';
    RAISE NOTICE '- recalculate_phone_scores()';
    RAISE NOTICE '- check_config_consistency()';
    RAISE NOTICE '已创建配置变更日志表和触发器';
END $$;