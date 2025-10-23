-- SMS营销数据分析系统 - 数据库函数和触发器
-- 业务逻辑函数、数据统计、自动化处理

-- 1. 号码包统计函数
CREATE OR REPLACE FUNCTION calculate_package_stats(package_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    total_phones INTEGER;
    rated_phones INTEGER;
    avg_score DECIMAL(3,2);
    conversion_rate DECIMAL(5,2);
    grade_distribution JSONB;
BEGIN
    -- 获取号码包基本统计
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN pr.rating IS NOT NULL THEN 1 END) as rated,
        AVG(CASE WHEN ps.final_score IS NOT NULL THEN ps.final_score ELSE 0 END) as avg_score
    INTO total_phones, rated_phones, avg_score
    FROM phones p
    LEFT JOIN phone_ratings pr ON p.id = pr.phone_id
    LEFT JOIN phone_scores ps ON p.id = ps.phone_id
    WHERE p.package_id = package_id;
    
    -- 计算转化率
    conversion_rate := CASE 
        WHEN total_phones > 0 THEN (rated_phones::DECIMAL / total_phones) * 100
        ELSE 0
    END;
    
    -- 获取分档分布
    SELECT jsonb_object_agg(final_grade, grade_count)
    INTO grade_distribution
    FROM (
        SELECT 
            COALESCE(ps.final_grade, 'unrated') as final_grade,
            COUNT(*) as grade_count
        FROM phones p
        LEFT JOIN phone_scores ps ON p.id = ps.phone_id
        WHERE p.package_id = package_id
        GROUP BY ps.final_grade
    ) grade_stats;
    
    -- 构建统计结果
    stats := jsonb_build_object(
        'total_phones', total_phones,
        'rated_phones', rated_phones,
        'unrated_phones', total_phones - rated_phones,
        'conversion_rate', conversion_rate,
        'average_score', COALESCE(avg_score, 0),
        'grade_distribution', COALESCE(grade_distribution, '{}'::jsonb),
        'last_updated', NOW()
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- 2. 用户活动统计函数
CREATE OR REPLACE FUNCTION get_user_activity_stats(user_id UUID, days_back INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    packages_created INTEGER;
    phones_rated INTEGER;
    reports_generated INTEGER;
    login_count INTEGER;
BEGIN
    -- 获取用户活动统计
    SELECT 
        COUNT(DISTINCT pp.id) as packages,
        COUNT(DISTINCT pr.id) as ratings,
        COUNT(DISTINCT r.id) as reports
    INTO packages_created, phones_rated, reports_generated
    FROM users u
    LEFT JOIN phone_packages pp ON u.id = pp.created_by AND pp.created_at >= NOW() - INTERVAL '%s days'
    LEFT JOIN phone_ratings pr ON u.id = pr.created_by AND pr.created_at >= NOW() - INTERVAL '%s days'
    LEFT JOIN reports r ON u.id = r.created_by AND r.created_at >= NOW() - INTERVAL '%s days'
    WHERE u.id = user_id;
    
    -- 获取登录次数
    SELECT COUNT(*)
    INTO login_count
    FROM user_sessions
    WHERE user_id = user_id 
    AND created_at >= NOW() - INTERVAL '%s days';
    
    -- 构建统计结果
    stats := jsonb_build_object(
        'packages_created', COALESCE(packages_created, 0),
        'phones_rated', COALESCE(phones_rated, 0),
        'reports_generated', COALESCE(reports_generated, 0),
        'login_count', COALESCE(login_count, 0),
        'period_days', days_back,
        'last_updated', NOW()
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- 3. 系统整体统计函数
CREATE OR REPLACE FUNCTION get_system_overview_stats()
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
    total_users INTEGER;
    active_users INTEGER;
    total_packages INTEGER;
    total_phones BIGINT;
    total_ratings BIGINT;
    avg_conversion_rate DECIMAL(5,2);
BEGIN
    -- 获取用户统计
    SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN 1 END) as active
    INTO total_users, active_users
    FROM users;
    
    -- 获取号码包和号码统计
    SELECT 
        COUNT(DISTINCT pp.id) as packages,
        COUNT(p.id) as phones,
        COUNT(pr.id) as ratings
    INTO total_packages, total_phones, total_ratings
    FROM phone_packages pp
    LEFT JOIN phones p ON pp.id = p.package_id
    LEFT JOIN phone_ratings pr ON p.id = pr.phone_id;
    
    -- 计算平均转化率
    SELECT AVG(conversion_rate)
    INTO avg_conversion_rate
    FROM (
        SELECT 
            CASE 
                WHEN COUNT(p.id) > 0 THEN 
                    (COUNT(CASE WHEN pr.rating IS NOT NULL THEN 1 END)::DECIMAL / COUNT(p.id)) * 100
                ELSE 0
            END as conversion_rate
        FROM phone_packages pp
        LEFT JOIN phones p ON pp.id = p.package_id
        LEFT JOIN phone_ratings pr ON p.id = pr.phone_id
        GROUP BY pp.id
        HAVING COUNT(p.id) > 0
    ) package_rates;
    
    -- 构建统计结果
    stats := jsonb_build_object(
        'total_users', COALESCE(total_users, 0),
        'active_users', COALESCE(active_users, 0),
        'total_packages', COALESCE(total_packages, 0),
        'total_phones', COALESCE(total_phones, 0),
        'total_ratings', COALESCE(total_ratings, 0),
        'average_conversion_rate', COALESCE(avg_conversion_rate, 0),
        'last_updated', NOW()
    );
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- 4. 号码评分自动计算函数
CREATE OR REPLACE FUNCTION auto_calculate_phone_score(phone_id UUID)
RETURNS VOID AS $$
DECLARE
    rating_record RECORD;
    score_data JSONB;
    final_score DECIMAL(3,2);
    final_grade VARCHAR(10);
    settings JSONB;
BEGIN
    -- 获取系统设置
    SELECT value INTO settings
    FROM system_settings 
    WHERE key = 'scoring_algorithm';
    
    -- 获取号码的最新评级
    SELECT * INTO rating_record
    FROM phone_ratings 
    WHERE phone_id = phone_id 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF rating_record IS NULL THEN
        RETURN;
    END IF;
    
    -- 根据评级计算分数（基于系统设置）
    CASE rating_record.rating
        WHEN 'A' THEN final_score := 0.95;
        WHEN 'B' THEN final_score := 0.85;
        WHEN 'C' THEN final_score := 0.75;
        WHEN 'D' THEN final_score := 0.65;
        WHEN 'E' THEN final_score := 0.45;
        WHEN 'F' THEN final_score := 0.25;
        ELSE final_score := 0.50;
    END CASE;
    
    -- 根据分数确定最终分档
    CASE 
        WHEN final_score >= 0.90 THEN final_grade := 'S';
        WHEN final_score >= 0.80 THEN final_grade := 'A';
        WHEN final_score >= 0.70 THEN final_grade := 'B';
        WHEN final_score >= 0.60 THEN final_grade := 'C';
        WHEN final_score >= 0.40 THEN final_grade := 'D';
        ELSE final_grade := 'F';
    END CASE;
    
    -- 构建评分数据
    score_data := jsonb_build_object(
        'base_rating', rating_record.rating,
        'calculated_score', final_score,
        'algorithm_version', '1.0',
        'factors', jsonb_build_object(
            'rating_weight', 1.0,
            'time_factor', 1.0
        )
    );
    
    -- 插入或更新评分记录
    INSERT INTO phone_scores (
        phone_id, 
        final_score, 
        final_grade, 
        score_data, 
        created_by
    ) VALUES (
        phone_id, 
        final_score, 
        final_grade, 
        score_data, 
        rating_record.created_by
    )
    ON CONFLICT (phone_id) 
    DO UPDATE SET
        final_score = EXCLUDED.final_score,
        final_grade = EXCLUDED.final_grade,
        score_data = EXCLUDED.score_data,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. 触发器：自动计算评分
CREATE OR REPLACE FUNCTION trigger_auto_calculate_score()
RETURNS TRIGGER AS $$
BEGIN
    -- 当插入新的评级时，自动计算评分
    PERFORM auto_calculate_phone_score(NEW.phone_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS auto_score_calculation ON phone_ratings;
CREATE TRIGGER auto_score_calculation
    AFTER INSERT OR UPDATE ON phone_ratings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_calculate_score();

-- 6. 触发器：更新号码包统计
CREATE OR REPLACE FUNCTION trigger_update_package_stats()
RETURNS TRIGGER AS $$
DECLARE
    package_id UUID;
BEGIN
    -- 获取相关的号码包ID
    IF TG_OP = 'DELETE' THEN
        SELECT p.package_id INTO package_id
        FROM phones p
        WHERE p.id = OLD.phone_id;
    ELSE
        SELECT p.package_id INTO package_id
        FROM phones p
        WHERE p.id = NEW.phone_id;
    END IF;
    
    -- 更新号码包的统计信息
    UPDATE phone_packages 
    SET 
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('stats', calculate_package_stats(package_id)),
        updated_at = NOW()
    WHERE id = package_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 创建号码包统计更新触发器
DROP TRIGGER IF EXISTS update_package_stats_on_rating ON phone_ratings;
CREATE TRIGGER update_package_stats_on_rating
    AFTER INSERT OR UPDATE OR DELETE ON phone_ratings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_package_stats();

DROP TRIGGER IF EXISTS update_package_stats_on_score ON phone_scores;
CREATE TRIGGER update_package_stats_on_score
    AFTER INSERT OR UPDATE OR DELETE ON phone_scores
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_package_stats();

-- 7. 数据清理函数
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除30天前的会话记录
    DELETE FROM user_sessions 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除90天前的审计日志
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 8. 批量操作函数
CREATE OR REPLACE FUNCTION batch_rate_phones(
    phone_ids UUID[], 
    rating VARCHAR(10), 
    notes TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER := 0;
    phone_id UUID;
BEGIN
    -- 批量插入评级
    FOREACH phone_id IN ARRAY phone_ids
    LOOP
        INSERT INTO phone_ratings (phone_id, rating, notes, created_by)
        VALUES (phone_id, rating, notes, auth.uid())
        ON CONFLICT (phone_id) 
        DO UPDATE SET
            rating = EXCLUDED.rating,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        
        affected_count := affected_count + 1;
    END LOOP;
    
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- 9. 报告生成辅助函数
CREATE OR REPLACE FUNCTION generate_package_report_data(package_id UUID)
RETURNS JSONB AS $$
DECLARE
    report_data JSONB;
    package_info RECORD;
    stats JSONB;
    grade_details JSONB;
BEGIN
    -- 获取号码包基本信息
    SELECT * INTO package_info
    FROM phone_packages
    WHERE id = package_id;
    
    IF package_info IS NULL THEN
        RAISE EXCEPTION '号码包不存在: %', package_id;
    END IF;
    
    -- 获取统计数据
    stats := calculate_package_stats(package_id);
    
    -- 获取详细的分档数据
    SELECT jsonb_object_agg(
        final_grade, 
        jsonb_build_object(
            'count', grade_count,
            'percentage', ROUND((grade_count::DECIMAL / total_count) * 100, 2),
            'phones', phone_list
        )
    )
    INTO grade_details
    FROM (
        SELECT 
            COALESCE(ps.final_grade, 'unrated') as final_grade,
            COUNT(*) as grade_count,
            (SELECT COUNT(*) FROM phones WHERE package_id = package_id) as total_count,
            jsonb_agg(
                jsonb_build_object(
                    'phone_number', p.phone_number,
                    'rating', pr.rating,
                    'score', ps.final_score,
                    'notes', pr.notes
                )
            ) as phone_list
        FROM phones p
        LEFT JOIN phone_ratings pr ON p.id = pr.phone_id
        LEFT JOIN phone_scores ps ON p.id = ps.phone_id
        WHERE p.package_id = package_id
        GROUP BY ps.final_grade
    ) grade_stats;
    
    -- 构建报告数据
    report_data := jsonb_build_object(
        'package_info', jsonb_build_object(
            'id', package_info.id,
            'name', package_info.name,
            'description', package_info.description,
            'country_code', package_info.country_code,
            'created_at', package_info.created_at,
            'total_phones', package_info.total_phones
        ),
        'statistics', stats,
        'grade_details', COALESCE(grade_details, '{}'::jsonb),
        'generated_at', NOW()
    );
    
    RETURN report_data;
END;
$$ LANGUAGE plpgsql;

-- 10. 授予函数执行权限
GRANT EXECUTE ON FUNCTION calculate_package_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity_stats(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_calculate_phone_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION batch_rate_phones(UUID[], VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_package_report_data(UUID) TO authenticated;