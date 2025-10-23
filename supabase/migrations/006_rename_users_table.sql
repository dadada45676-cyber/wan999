-- 重命名 users 表为 user_profiles 以匹配代码期望
-- 这个迁移解决了数据库表名与代码不一致的问题

-- 1. 首先禁用相关的 RLS 策略和触发器
DROP TRIGGER IF EXISTS audit_users_trigger ON users;

-- 2. 删除现有的外键约束（需要重新创建）
ALTER TABLE phone_packages DROP CONSTRAINT IF EXISTS phone_packages_user_id_fkey;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;
ALTER TABLE file_uploads DROP CONSTRAINT IF EXISTS file_uploads_user_id_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_created_by_fkey;

-- 3. 重命名表
ALTER TABLE users RENAME TO user_profiles;

-- 4. 重新创建外键约束
ALTER TABLE phone_packages 
ADD CONSTRAINT phone_packages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES user_profiles(id);

ALTER TABLE reports 
ADD CONSTRAINT reports_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES user_profiles(id);

ALTER TABLE audit_logs 
ADD CONSTRAINT audit_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES user_profiles(id);

ALTER TABLE user_sessions 
ADD CONSTRAINT user_sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE file_uploads 
ADD CONSTRAINT file_uploads_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES user_profiles(id);

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES user_profiles(id);

-- 5. 重新创建审计日志触发器
CREATE TRIGGER audit_user_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- 6. 确保 RLS 策略正确应用到重命名后的表
-- (RLS 策略在 002_rls_policies.sql 中已经定义为 user_profiles，所以应该自动生效)

-- 7. 更新视图中的表引用
DROP VIEW IF EXISTS phone_package_stats;
CREATE VIEW phone_package_stats AS
SELECT 
    pp.id,
    pp.name,
    pp.country_code,
    c.name as country_name,
    pp.phone_count,
    pp.valid_phones,
    pp.invalid_phones,
    pp.duplicate_phones,
    pp.first_charge_count,
    pp.conversion_rate,
    pp.grade,
    pp.status,
    pp.upload_time,
    pp.send_time,
    pp.sms_provider,
    pp.source,
    pp.game_platform,
    up.name as created_by_name,
    up.email as created_by_email,
    pp.created_at,
    pp.updated_at
FROM phone_packages pp
LEFT JOIN countries c ON pp.country_code = c.code
LEFT JOIN user_profiles up ON pp.user_id = up.id;

-- 8. 授予必要的权限
GRANT ALL PRIVILEGES ON user_profiles TO authenticated;
GRANT SELECT ON user_profiles TO anon;

-- 9. 添加注释说明
COMMENT ON TABLE user_profiles IS '用户档案表 - 存储系统用户的基本信息和权限配置';