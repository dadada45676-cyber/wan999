-- 创建默认管理员用户
-- 这个脚本会创建一个默认的管理员账号用于系统初始化

-- 首先检查是否已存在管理员用户
DO $$
DECLARE
    admin_count INTEGER;
    admin_user_id UUID;
BEGIN
    -- 检查是否已有管理员用户
    SELECT COUNT(*) INTO admin_count 
    FROM user_profiles 
    WHERE role = 'admin';
    
    -- 如果没有管理员用户，创建默认管理员
    IF admin_count = 0 THEN
        -- 生成一个固定的UUID作为管理员ID
        admin_user_id := '00000000-0000-0000-0000-000000000001'::UUID;
        
        -- 插入管理员用户档案
        INSERT INTO user_profiles (
            id,
            email,
            name,
            role,
            status,
            department,
            phone,
            must_change_password,
            created_at,
            updated_at
        ) VALUES (
            admin_user_id,
            'admin@sms-system.com',
            '系统管理员',
            'admin',
            'active',
            '系统管理部',
            '13800138000',
            true,  -- 首次登录必须修改密码
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '默认管理员用户已创建: admin@sms-system.com';
        RAISE NOTICE '用户ID: %', admin_user_id;
        RAISE NOTICE '请使用 Supabase Auth 创建对应的认证用户';
    ELSE
        RAISE NOTICE '已存在 % 个管理员用户，跳过创建默认管理员', admin_count;
    END IF;
END $$;

-- 创建一个函数来同步 Supabase Auth 用户到 user_profiles
CREATE OR REPLACE FUNCTION sync_auth_user_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- 当新用户在 auth.users 中创建时，检查是否需要同步到 user_profiles
    IF NEW.email = 'admin@sms-system.com' THEN
        -- 更新 user_profiles 中的 id 为 auth.users 的 id
        UPDATE user_profiles 
        SET id = NEW.id
        WHERE email = 'admin@sms-system.com' 
        AND id = '00000000-0000-0000-0000-000000000001'::UUID;
        
        IF FOUND THEN
            RAISE NOTICE '管理员用户档案已同步: % -> %', '00000000-0000-0000-0000-000000000001', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 注意：由于 RLS 策略，这个触发器可能无法直接访问 auth.users
-- 实际的用户同步需要通过应用程序代码来完成

-- 创建一个辅助函数来手动同步管理员用户
CREATE OR REPLACE FUNCTION manual_sync_admin_user(auth_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    result BOOLEAN := FALSE;
BEGIN
    -- 更新管理员用户档案的ID
    UPDATE user_profiles 
    SET id = auth_user_id,
        updated_at = NOW()
    WHERE email = 'admin@sms-system.com' 
    AND (id = '00000000-0000-0000-0000-000000000001'::UUID OR id = auth_user_id);
    
    IF FOUND THEN
        result := TRUE;
        RAISE NOTICE '管理员用户档案已手动同步: %', auth_user_id;
    ELSE
        RAISE NOTICE '未找到需要同步的管理员用户档案';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授权函数给认证用户
GRANT EXECUTE ON FUNCTION manual_sync_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION manual_sync_admin_user(UUID) TO anon;

-- 显示创建结果
SELECT 
    id,
    email,
    name,
    role,
    status,
    must_change_password,
    created_at
FROM user_profiles 
WHERE role = 'admin'
ORDER BY created_at;