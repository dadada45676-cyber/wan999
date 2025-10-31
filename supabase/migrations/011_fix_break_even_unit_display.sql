-- 修复保本线配置中的单位显示问题
-- 将 "万分之" 更新为 "万分转化数"

-- 更新 break_even_config 中的 unit 字段
UPDATE system_settings 
SET setting_value = jsonb_set(
    setting_value,
    '{unit}',
    '"万分转化数"'
)
WHERE setting_key = 'break_even_config' 
AND setting_value->>'unit' = '万分之';

-- 验证更新结果
-- 这个查询可以用来确认更新是否成功
-- SELECT setting_key, setting_value->>'unit' as unit 
-- FROM system_settings 
-- WHERE setting_key = 'break_even_config';