-- SMS营销数据分析系统 - RLS安全策略配置
-- 基于用户角色的数据访问控制

-- 启用所有表的行级安全
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 创建获取当前用户角色的函数
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT role FROM user_profiles WHERE id = auth.uid()),
        'anonymous'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建检查用户权限的函数
CREATE OR REPLACE FUNCTION has_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. 国家表策略 - 所有认证用户可读
CREATE POLICY "countries_select_policy" ON countries
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "countries_insert_policy" ON countries
    FOR INSERT TO authenticated
    WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "countries_update_policy" ON countries
    FOR UPDATE TO authenticated
    USING (get_current_user_role() = 'admin')
    WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "countries_delete_policy" ON countries
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'admin');

-- 2. 用户配置表策略 - 管理员可管理所有用户，普通用户只能查看自己
CREATE POLICY "user_profiles_select_policy" ON user_profiles
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        id = auth.uid()
    );

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
    FOR INSERT TO authenticated
    WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "user_profiles_update_policy" ON user_profiles
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        (id = auth.uid() AND get_current_user_role() IN ('admin', 'operator'))
    )
    WITH CHECK (
        get_current_user_role() = 'admin' OR 
        (id = auth.uid() AND get_current_user_role() IN ('admin', 'operator'))
    );

CREATE POLICY "user_profiles_delete_policy" ON user_profiles
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'admin' AND id != auth.uid());

-- 3. 号码包表策略 - 用户只能访问自己创建的数据
CREATE POLICY "phone_packages_select_policy" ON phone_packages
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "phone_packages_insert_policy" ON phone_packages
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND 
        get_current_user_role() IN ('admin', 'operator')
    );

CREATE POLICY "phone_packages_update_policy" ON phone_packages
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    )
    WITH CHECK (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "phone_packages_delete_policy" ON phone_packages
    FOR DELETE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

-- 4. 号码表策略 - 基于号码包的访问权限
CREATE POLICY "phones_select_policy" ON phones
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phones.package_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "phones_insert_policy" ON phones
    FOR INSERT TO authenticated
    WITH CHECK (
        get_current_user_role() IN ('admin', 'operator') AND
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phones.package_id AND 
            (get_current_user_role() = 'admin' OR user_id = auth.uid())
        )
    );

CREATE POLICY "phones_update_policy" ON phones
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phones.package_id AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phones.package_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "phones_delete_policy" ON phones
    FOR DELETE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phones.package_id AND user_id = auth.uid()
        )
    );

-- 5. 号码评级历史表策略
CREATE POLICY "phone_ratings_select_policy" ON phone_ratings
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phone_ratings.package_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "phone_ratings_insert_policy" ON phone_ratings
    FOR INSERT TO authenticated
    WITH CHECK (
        get_current_user_role() IN ('admin', 'operator') AND
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phone_ratings.package_id AND 
            (get_current_user_role() = 'admin' OR user_id = auth.uid())
        )
    );

CREATE POLICY "phone_ratings_update_policy" ON phone_ratings
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phone_ratings.package_id AND user_id = auth.uid()
        )
    )
    WITH CHECK (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phone_ratings.package_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "phone_ratings_delete_policy" ON phone_ratings
    FOR DELETE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_packages 
            WHERE id = phone_ratings.package_id AND user_id = auth.uid()
        )
    );

-- 6. 号码综合评分表策略
CREATE POLICY "phone_scores_select_policy" ON phone_scores
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        EXISTS (
            SELECT 1 FROM phone_ratings pr
            JOIN phone_packages pp ON pr.package_id = pp.id
            WHERE pr.phone_number = phone_scores.phone_number 
            AND pp.user_id = auth.uid()
        )
    );

CREATE POLICY "phone_scores_insert_policy" ON phone_scores
    FOR INSERT TO authenticated
    WITH CHECK (get_current_user_role() IN ('admin', 'operator'));

CREATE POLICY "phone_scores_update_policy" ON phone_scores
    FOR UPDATE TO authenticated
    USING (get_current_user_role() IN ('admin', 'operator'))
    WITH CHECK (get_current_user_role() IN ('admin', 'operator'));

CREATE POLICY "phone_scores_delete_policy" ON phone_scores
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'admin');

-- 7. 报告表策略 - 用户只能访问自己的报告
CREATE POLICY "reports_select_policy" ON reports
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "reports_insert_policy" ON reports
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND 
        get_current_user_role() IN ('admin', 'operator')
    );

CREATE POLICY "reports_update_policy" ON reports
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    )
    WITH CHECK (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "reports_delete_policy" ON reports
    FOR DELETE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

-- 8. 系统设置表策略 - 只有管理员可以修改
CREATE POLICY "system_settings_select_policy" ON system_settings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "system_settings_insert_policy" ON system_settings
    FOR INSERT TO authenticated
    WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "system_settings_update_policy" ON system_settings
    FOR UPDATE TO authenticated
    USING (get_current_user_role() = 'admin')
    WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "system_settings_delete_policy" ON system_settings
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'admin');

-- 9. 审计日志表策略 - 只有管理员可以查看
CREATE POLICY "audit_logs_select_policy" ON audit_logs
    FOR SELECT TO authenticated
    USING (get_current_user_role() = 'admin');

CREATE POLICY "audit_logs_insert_policy" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true); -- 系统自动插入

CREATE POLICY "audit_logs_update_policy" ON audit_logs
    FOR UPDATE TO authenticated
    USING (false); -- 审计日志不允许修改

CREATE POLICY "audit_logs_delete_policy" ON audit_logs
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'admin');

-- 10. 用户会话表策略 - 用户只能访问自己的会话
CREATE POLICY "user_sessions_select_policy" ON user_sessions
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "user_sessions_insert_policy" ON user_sessions
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_sessions_update_policy" ON user_sessions
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    )
    WITH CHECK (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

CREATE POLICY "user_sessions_delete_policy" ON user_sessions
    FOR DELETE TO authenticated
    USING (
        get_current_user_role() = 'admin' OR 
        user_id = auth.uid()
    );

-- 为匿名用户授予基本权限（用于登录等操作）
GRANT SELECT ON countries TO anon;
GRANT SELECT ON system_settings TO anon;

-- 为认证用户授予基本权限
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 创建审计日志触发器函数
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        user_email,
        action,
        resource,
        resource_id,
        details,
        result
    ) VALUES (
        auth.uid(),
        COALESCE((SELECT email FROM user_profiles WHERE id = auth.uid()), 'system'),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        CASE 
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            ELSE to_jsonb(NEW)
        END,
        'success'
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 为重要表添加审计日志触发器
CREATE TRIGGER audit_user_profiles_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_phone_packages_trigger
    AFTER INSERT OR UPDATE OR DELETE ON phone_packages
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_system_settings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();