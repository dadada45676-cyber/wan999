-- SMS营销数据分析系统 - 初始数据插入
-- 基于实际代码中的配置数据

-- 1. 插入支持的国家配置（基于store/country.ts）
INSERT INTO countries (code, name, flag, phone_prefix, phone_length, mobile_pattern, example_number) VALUES
('BR', '巴西', '🇧🇷', '55', '{13,14}', '^55[1-9][1-9]\d{8,9}$', '5511987654321'),
('MX', '墨西哥', '🇲🇽', '52', '{12,13}', '^52[1-9]\d{9,10}$', '521234567890'),
('BD', '孟加拉', '🇧🇩', '880', '{13,14}', '^880[1-9]\d{8,9}$', '8801712345678'),
('PH', '菲律宾', '🇵🇭', '63', '{12,13}', '^63[2-9]\d{8,9}$', '639123456789'),
('TH', '泰国', '🇹🇭', '66', '{11}', '^66[6-9]\d{8}$', '66812345678'),
('VN', '越南', '🇻🇳', '84', '{11,12}', '^84[3-9]\d{8,9}$', '84912345678'),
('ID', '印尼', '🇮🇩', '62', '{11,12,13}', '^62[8][1-9]\d{7,9}$', '628123456789'),
('NG', '尼日利亚', '🇳🇬', '234', '{14}', '^234[7-9]\d{9}$', '2347012345678'),
('PK', '巴基斯坦', '🇵🇰', '92', '{12,13}', '^92[3][0-9]\d{8,9}$', '923001234567');

-- 2. 插入系统设置配置（基于store/index.ts的SystemSettings）
INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES
-- 号码包评级阈值配置
('package_grade_thresholds', '{
  "SS": 50,
  "S": 30,
  "A": 20,
  "B": 16,
  "C": 10
}', '号码包评级阈值配置（基于万分转化数）', 'grading'),

-- 评级分数映射配置
('rating_score_map', '{
  "SS": 100,
  "S": 85,
  "A": 70,
  "B": 55,
  "C": 40,
  "D": 25
}', '评级分数映射配置', 'grading'),

-- 最终分档配置
('final_grade_config', '[
  {"name": "A", "minScore": 80, "color": "#22c55e"},
  {"name": "B", "minScore": 60, "color": "#3b82f6"},
  {"name": "C", "minScore": 40, "color": "#eab308"},
  {"name": "D", "minScore": 20, "color": "#f97316"},
  {"name": "E", "minScore": 0, "color": "#ef4444"}
]', '最终分档配置', 'grading'),

-- 保本线配置
('break_even_line', '16', '保本线配置（16个首充/万条号码）', 'business'),
('warning_line', '12.8', '警告线配置（保本线的80%）', 'business'),
('danger_line', '9.6', '危险线配置（保本线的60%）', 'business'),

-- 号码综合评分算法配置
('scoring_algorithm', '"weighted"', '号码综合评分算法', 'algorithm'),
('min_rating_count', '3', '最小评级次数', 'algorithm'),
('time_decay_factor', '0.01', '时间衰减因子', 'algorithm'),

-- 下拉选项配置
('sms_providers', '["短信商A", "短信商B", "短信商C", "短信商D"]', '短信商选项配置', 'options'),
('sources', '["电商平台", "社交媒体", "线下活动", "合作伙伴", "自然流量"]', '号码包来源选项配置', 'options'),
('game_platforms', '["平台A", "平台B", "平台C", "平台D"]', '游戏平台选项配置', 'options'),

-- 安全配置（基于auth.ts的SECURITY_CONFIG）
('password_policy', '{
  "minLength": 8,
  "maxLength": 128,
  "requireUppercase": true,
  "requireLowercase": true,
  "requireNumbers": true,
  "requireSpecial": true,
  "historyCount": 5,
  "expiryDays": 90
}', '密码策略配置', 'security'),

('login_security', '{
  "maxLoginAttempts": 5,
  "lockoutDuration": 1800000,
  "progressiveLockout": true,
  "lockoutMultiplier": 2,
  "maxLockoutDuration": 86400000
}', '登录安全配置', 'security'),

('session_config', '{
  "tokenExpiry": 86400000,
  "sessionTimeout": 1800000,
  "sessionWarningTime": 300000,
  "maxConcurrentSessions": 3,
  "forceLogoutOnPasswordChange": true
}', '会话管理配置', 'security'),

('captcha_config', '{
  "threshold": 3,
  "expiry": 300000
}', '验证码配置', 'security'),

('admin_limits', '{
  "maxAdminCount": 3,
  "minAdminCount": 1
}', '管理员限制配置', 'security'),

('audit_config', '{
  "retentionDays": 365,
  "maxSize": 10000
}', '审计日志配置', 'security'),

-- 权限配置（基于auth.ts的PERMISSIONS）
('permissions', '{
  "PAGE_PACKAGE": "page.package",
  "PAGE_PHONE": "page.phone",
  "PAGE_USER": "page.user",
  "PAGE_SETTINGS": "page.settings",
  "PAGE_REPORT": "page.report",
  "PAGE_ANALYSIS": "page.analysis"
}', '页面权限定义', 'permissions'),

('role_permissions', '{
  "admin": ["page.package", "page.phone", "page.user", "page.settings", "page.report", "page.analysis"],
  "operator": ["page.package", "page.phone", "page.report", "page.analysis"]
}', '角色权限映射', 'permissions');

-- 3. 创建默认管理员账号（基于auth.ts的DEFAULT_ADMIN）
-- 注意：这里使用Supabase Auth，所以只插入用户信息，密码由Supabase Auth管理
INSERT INTO users (id, email, name, role, status, permissions, must_change_password) VALUES
(uuid_generate_v4(), 'admin@sms-system.com', '系统管理员', 'admin', 'active', 
 ARRAY['page.package', 'page.phone', 'page.user', 'page.settings', 'page.report', 'page.analysis'], 
 true);

-- 4. 插入示例数据（用于测试和演示）
-- 注意：这些是最小化的示例数据，符合mock_data_guidelines

-- 插入示例号码包（2个示例）
DO $$
DECLARE
    admin_user_id UUID;
    package_id_1 UUID := uuid_generate_v4();
    package_id_2 UUID := uuid_generate_v4();
BEGIN
    -- 获取管理员用户ID
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@sms-system.com' LIMIT 1;
    
    -- 插入示例号码包
    INSERT INTO phone_packages (
        id, name, file_name, send_time, phone_count, first_charge_count, 
        conversion_rate, grade, status, sms_provider, source, game_platform, 
        country_code, description, user_id
    ) VALUES
    (package_id_1, '巴西高质量号码包001', 'br_premium_001.csv', 
     NOW() - INTERVAL '7 days', 10000, 35, 35.0, 'S', 'completed', 
     '短信商A', '电商平台', '平台A', 'BR', '巴西地区高转化率号码包', admin_user_id),
    (package_id_2, '墨西哥标准号码包002', 'mx_standard_002.csv', 
     NOW() - INTERVAL '3 days', 8000, 12, 15.0, 'C', 'completed', 
     '短信商B', '社交媒体', '平台B', 'MX', '墨西哥地区标准号码包', admin_user_id);
     
    -- 插入示例号码（每个包2个号码）
    INSERT INTO phones (phone_number, package_id, country_code, status) VALUES
    ('5511987654321', package_id_1, 'BR', 'active'),
    ('5511987654322', package_id_1, 'BR', 'active'),
    ('521234567890', package_id_2, 'MX', 'active'),
    ('521234567891', package_id_2, 'MX', 'rating');
    
    -- 插入示例评级历史
    INSERT INTO phone_ratings (
        phone_number, package_id, package_name, rating, rating_score, 
        package_size, country_code
    ) VALUES
    ('5511987654321', package_id_1, '巴西高质量号码包001', 'S', 85, 10000, 'BR'),
    ('5511987654322', package_id_1, '巴西高质量号码包001', 'S', 85, 10000, 'BR'),
    ('521234567890', package_id_2, '墨西哥标准号码包002', 'C', 40, 8000, 'MX');
    
    -- 插入示例号码评分
    INSERT INTO phone_scores (
        phone_number, rating_count, average_score, final_grade, 
        status, algorithm_type, country_code
    ) VALUES
    ('5511987654321', 1, 85.0, 'A', 'rating', 'weighted', 'BR'),
    ('5511987654322', 1, 85.0, 'A', 'rating', 'weighted', 'BR'),
    ('521234567890', 1, 40.0, 'C', 'rating', 'weighted', 'MX'),
    ('521234567891', 0, 0.0, 'E', 'pending', 'weighted', 'MX');
    
    -- 插入示例报告
    INSERT INTO reports (
        name, title, type, status, data_period, file_size, 
        description, country_code, user_id
    ) VALUES
    ('巴西地区周报', '巴西地区数据分析周报', 'weekly', 'completed', 
     '2024-01-15 至 2024-01-21', '2.5MB', 
     '巴西地区一周数据分析报告', 'BR', admin_user_id),
    ('墨西哥地区月报', '墨西哥地区数据分析月报', 'monthly', 'generating', 
     '2024-01-01 至 2024-01-31', '0MB', 
     '墨西哥地区一月数据分析报告', 'MX', admin_user_id);
END $$;

-- 5. 创建视图以简化常用查询
-- 号码包统计视图
CREATE VIEW phone_package_stats AS
SELECT 
    pp.*,
    c.name as country_name,
    c.flag as country_flag,
    u.name as created_by_name,
    COUNT(p.id) as actual_phone_count,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_phone_count
FROM phone_packages pp
LEFT JOIN countries c ON pp.country_code = c.code
LEFT JOIN users u ON pp.user_id = u.id
LEFT JOIN phones p ON pp.id = p.package_id
GROUP BY pp.id, c.name, c.flag, u.name;

-- 号码评分统计视图
CREATE VIEW phone_score_stats AS
SELECT 
    ps.*,
    c.name as country_name,
    c.flag as country_flag,
    COUNT(pr.id) as total_ratings,
    AVG(pr.rating_score) as avg_rating_score
FROM phone_scores ps
LEFT JOIN countries c ON ps.country_code = c.code
LEFT JOIN phone_ratings pr ON ps.phone_number = pr.phone_number
GROUP BY ps.id, c.name, c.flag;

-- 用户活动统计视图
CREATE VIEW user_activity_stats AS
SELECT 
    u.*,
    COUNT(DISTINCT pp.id) as package_count,
    COUNT(DISTINCT r.id) as report_count,
    MAX(pp.created_at) as last_package_upload,
    MAX(r.created_at) as last_report_generated
FROM users u
LEFT JOIN phone_packages pp ON u.id = pp.user_id
LEFT JOIN reports r ON u.id = r.user_id
GROUP BY u.id;

-- 国家数据统计视图
CREATE VIEW country_stats AS
SELECT 
    c.*,
    COUNT(DISTINCT pp.id) as package_count,
    COUNT(DISTINCT p.id) as phone_count,
    COUNT(DISTINCT r.id) as report_count,
    AVG(pp.conversion_rate) as avg_conversion_rate
FROM countries c
LEFT JOIN phone_packages pp ON c.code = pp.country_code
LEFT JOIN phones p ON c.code = p.country_code
LEFT JOIN reports r ON c.code = r.country_code
GROUP BY c.id;

-- 授予视图访问权限
GRANT SELECT ON phone_package_stats TO authenticated;
GRANT SELECT ON phone_score_stats TO authenticated;
GRANT SELECT ON user_activity_stats TO authenticated;
GRANT SELECT ON country_stats TO authenticated;