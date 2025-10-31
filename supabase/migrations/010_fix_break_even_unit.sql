-- 查询并修复保本线配置中的"万分之"单位
-- Fix "万分之" unit in break-even configuration

-- 首先查看当前数据
SELECT setting_key, setting_value FROM system_settings WHERE setting_key = 'breakEvenConfig';

-- 更新保本线配置中的计量单位从"万分之"改为"万分转化数"
UPDATE system_settings 
SET setting_value = jsonb_set(
    setting_value,
    '{unit}',
    '"万分转化数"'
)
WHERE setting_key = 'breakEvenConfig'
AND setting_value->>'unit' = '万分之';

-- 同时更新描述字段，确保描述也使用正确的术语
UPDATE system_settings 
SET setting_value = jsonb_set(
    setting_value,
    '{description}',
    '"16万分转化数为保本线"'
)
WHERE setting_key = 'breakEvenConfig'
AND (setting_value->>'description' LIKE '%万分之%' OR setting_value->>'description' IS NULL);

-- 如果breakEvenConfig不存在，则插入默认配置
INSERT INTO system_settings (setting_key, setting_value, description, category)
SELECT 
    'breakEvenConfig',
    '{"threshold": 16, "warningLine": 12.8, "dangerLine": 9.6, "unit": "万分转化数", "description": "16万分转化数为保本线"}'::jsonb,
    '保本线配置',
    'business'
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings WHERE setting_key = 'breakEvenConfig'
);

-- 验证更新结果
SELECT setting_key, setting_value FROM system_settings WHERE setting_key = 'breakEvenConfig';