-- 防误杀机制功能数据库迁移
-- 创建时间: 2024-01-20

-- 1. 创建防误杀配置表
CREATE TABLE IF NOT EXISTS anti_false_positive_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threshold INTEGER NOT NULL DEFAULT 3 CHECK (threshold >= 1 AND threshold <= 10),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建号码评级历史表
CREATE TABLE IF NOT EXISTS phone_rating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    package_id UUID NOT NULL REFERENCES phone_packages(id) ON DELETE CASCADE,
    rating_score INTEGER NOT NULL,
    rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    counted_for_threshold BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建号码评级统计表
CREATE TABLE IF NOT EXISTS phone_rating_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    total_ratings INTEGER DEFAULT 0,
    unique_packages_count INTEGER DEFAULT 0,
    threshold_met BOOLEAN DEFAULT false,
    final_score FLOAT DEFAULT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. 创建防误杀配置表的更新时间触发器
DROP TRIGGER IF EXISTS update_anti_false_positive_config_updated_at ON anti_false_positive_config;
CREATE TRIGGER update_anti_false_positive_config_updated_at 
    BEFORE UPDATE ON anti_false_positive_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. 创建号码评级历史表的索引
CREATE INDEX IF NOT EXISTS idx_phone_rating_history_phone ON phone_rating_history(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_rating_history_package ON phone_rating_history(package_id);
CREATE INDEX IF NOT EXISTS idx_phone_rating_history_rated_at ON phone_rating_history(rated_at DESC);

-- 7. 创建号码评级统计表的索引
CREATE INDEX IF NOT EXISTS idx_phone_rating_stats_phone ON phone_rating_stats(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_rating_stats_threshold_met ON phone_rating_stats(threshold_met);
CREATE INDEX IF NOT EXISTS idx_phone_rating_stats_last_updated ON phone_rating_stats(last_updated DESC);

-- 8. 创建更新号码统计的函数
CREATE OR REPLACE FUNCTION update_phone_rating_stats()
RETURNS TRIGGER AS $$
DECLARE
    config_threshold INTEGER;
    unique_packages INTEGER;
    total_count INTEGER;
    should_calculate BOOLEAN;
BEGIN
    -- 获取当前防误杀阈值配置
    SELECT threshold INTO config_threshold 
    FROM anti_false_positive_config 
    WHERE enabled = true 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- 如果没有配置，使用默认值3
    IF config_threshold IS NULL THEN
        config_threshold := 3;
    END IF;
    
    -- 统计该号码在不同包中的评级次数
    SELECT 
        COUNT(DISTINCT package_id),
        COUNT(*)
    INTO unique_packages, total_count
    FROM phone_rating_history 
    WHERE phone_number = NEW.phone_number 
    AND counted_for_threshold = true;
    
    -- 判断是否达到阈值
    should_calculate := unique_packages >= config_threshold;
    
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

-- 9. 创建触发器
DROP TRIGGER IF EXISTS trigger_update_phone_rating_stats ON phone_rating_history;
CREATE TRIGGER trigger_update_phone_rating_stats
    AFTER INSERT ON phone_rating_history
    FOR EACH ROW EXECUTE FUNCTION update_phone_rating_stats();

-- 10. 启用RLS
ALTER TABLE anti_false_positive_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_rating_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_rating_stats ENABLE ROW LEVEL SECURITY;

-- 11. 创建RLS策略
-- 防误杀配置表策略
DROP POLICY IF EXISTS "Allow authenticated users to read config" ON anti_false_positive_config;
CREATE POLICY "Allow authenticated users to read config" ON anti_false_positive_config
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin to manage config" ON anti_false_positive_config;
CREATE POLICY "Allow admin to manage config" ON anti_false_positive_config
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 号码评级历史表策略
DROP POLICY IF EXISTS "Allow authenticated users to read rating history" ON phone_rating_history;
CREATE POLICY "Allow authenticated users to read rating history" ON phone_rating_history
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert rating history" ON phone_rating_history;
CREATE POLICY "Allow authenticated users to insert rating history" ON phone_rating_history
    FOR INSERT TO authenticated WITH CHECK (true);

-- 号码评级统计表策略
DROP POLICY IF EXISTS "Allow authenticated users to read rating stats" ON phone_rating_stats;
CREATE POLICY "Allow authenticated users to read rating stats" ON phone_rating_stats
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow system to manage rating stats" ON phone_rating_stats;
CREATE POLICY "Allow system to manage rating stats" ON phone_rating_stats
    FOR ALL TO authenticated USING (true);

-- 12. 插入默认配置
INSERT INTO anti_false_positive_config (threshold, enabled) 
VALUES (3, true)
ON CONFLICT DO NOTHING;

-- 13. 授权给anon和authenticated角色
GRANT SELECT ON anti_false_positive_config TO anon;
GRANT ALL PRIVILEGES ON anti_false_positive_config TO authenticated;

GRANT SELECT ON phone_rating_history TO anon;
GRANT ALL PRIVILEGES ON phone_rating_history TO authenticated;

GRANT SELECT ON phone_rating_stats TO anon;
GRANT ALL PRIVILEGES ON phone_rating_stats TO authenticated;

-- 14. 创建视图用于统计查询
CREATE OR REPLACE VIEW anti_false_positive_overview AS
SELECT 
    (SELECT COUNT(*) FROM phone_rating_stats WHERE threshold_met = true) as qualified_count,
    (SELECT COUNT(*) FROM phone_rating_stats WHERE threshold_met = false) as unqualified_count,
    (SELECT COUNT(*) FROM phone_rating_stats) as total_phones,
    CASE 
        WHEN (SELECT COUNT(*) FROM phone_rating_stats) > 0 
        THEN ROUND(
            (SELECT COUNT(*) FROM phone_rating_stats WHERE threshold_met = true)::NUMERIC / 
            (SELECT COUNT(*) FROM phone_rating_stats)::NUMERIC * 100, 2
        )
        ELSE 0 
    END as effectiveness_rate;

-- 授权视图访问权限
GRANT SELECT ON anti_false_positive_overview TO authenticated;
GRANT SELECT ON anti_false_positive_overview TO anon;

-- 创建号码包统计表（跟踪号码在不同包中的出现次数）
CREATE TABLE IF NOT EXISTS phone_package_tracking (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  package_count INTEGER NOT NULL DEFAULT 1,
  package_ids UUID[] NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_phone_package_tracking_phone_number ON phone_package_tracking(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_package_tracking_package_count ON phone_package_tracking(package_count);

-- 创建触发器函数，当号码包中的号码被插入时自动更新统计
CREATE OR REPLACE FUNCTION update_phone_package_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO phone_package_tracking (phone_number, package_count, package_ids, first_seen_at, last_seen_at)
  VALUES (NEW.phone_number, 1, ARRAY[NEW.package_id], NOW(), NOW())
  ON CONFLICT (phone_number) DO UPDATE SET
    package_count = phone_package_tracking.package_count + 1,
    package_ids = array_append(phone_package_tracking.package_ids, NEW.package_id),
    last_seen_at = NOW(),
    updated_at = NOW()
  WHERE NOT (NEW.package_id = ANY(phone_package_tracking.package_ids));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_phone_package_tracking ON phones;
CREATE TRIGGER trigger_update_phone_package_tracking
  AFTER INSERT ON phones
  FOR EACH ROW
  EXECUTE FUNCTION update_phone_package_tracking();