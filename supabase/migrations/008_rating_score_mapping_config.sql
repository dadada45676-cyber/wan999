-- 初始化评级分数映射配置
-- 确保评级分数映射配置存在，如果不存在则创建，如果存在则更新为产品需求文档中的默认值

INSERT INTO system_settings (setting_key, setting_value, description, category) 
VALUES (
  'rating_score_mapping', 
  '{"SS":100,"S":85,"A":70,"B":55,"C":40,"D":25}', 
  '评级分数映射配置 - 各评级等级对应的数值分数', 
  'algorithm'
) ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- 验证数据插入
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM system_settings 
    WHERE setting_key = 'rating_score_mapping'
  ) THEN
    RAISE NOTICE '评级分数映射配置已成功初始化';
  ELSE
    RAISE EXCEPTION '评级分数映射配置初始化失败';
  END IF;
END $$;