-- 创建默认管理员认证用户
-- 这个脚本会在 Supabase Auth 中创建默认管理员用户

-- 使用 Supabase 的 auth.users 表创建管理员用户
-- 注意：这需要使用 service_role 权限执行

DO $$
DECLARE
    admin_auth_id UUID;
    admin_profile_exists BOOLEAN := FALSE;
BEGIN
    -- 检查是否已存在管理员用户档案
    SELECT EXISTS(
        SELECT 1 FROM user_profiles 
        WHERE email = 'admin@sms-system.com' AND role = 'admin'
    ) INTO admin_profile_exists;
    
    -- 如果用户档案不存在，先创建
    IF NOT admin_profile_exists THEN
        -- 生成一个固定的UUID作为管理员ID
        admin_auth_id := '00000000-0000-0000-0000-000000000001'::UUID;
        
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
            admin_auth_id,
            'admin@sms-system.com',
            '系统管理员',
            'admin',
            'active',
            '系统管理部',
            '13800138000',
            false,  -- 设置为false以便测试
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '管理员用户档案已创建: admin@sms-system.com';
    ELSE
        -- 获取现有管理员的ID
        SELECT id INTO admin_auth_id 
        FROM user_profiles 
        WHERE email = 'admin@sms-system.com' AND role = 'admin'
        LIMIT 1;
        
        RAISE NOTICE '管理员用户档案已存在，ID: %', admin_auth_id;
    END IF;
    
    -- 检查 auth.users 中是否已存在该用户
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE email = 'admin@sms-system.com'
    ) THEN
        -- 在 auth.users 中创建用户
        -- 注意：密码哈希是 'Admin123!' 的 bcrypt 哈希值
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            role,
            aud,
            confirmation_token,
            email_change_token_new,
            recovery_token
        ) VALUES (
            admin_auth_id,
            '00000000-0000-0000-0000-000000000000',
            'admin@sms-system.com',
            '$2a$10$8K1p/a0dUrXurU2K0uYV2eRXiAQlEeHdyQV8xqjyqiJm5rOy.Uy7e', -- Admin123!
            NOW(),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated',
            '',
            '',
            ''
        );
        
        RAISE NOTICE '管理员认证用户已创建: admin@sms-system.com';
    ELSE
        RAISE NOTICE '管理员认证用户已存在';
    END IF;
    
    -- 同步用户档案ID
    UPDATE user_profiles 
    SET id = admin_auth_id,
        updated_at = NOW()
    WHERE email = 'admin@sms-system.com';
    
END $$;

-- 验证创建结果
SELECT 
    'user_profiles' as table_name,
    id,
    email,
    name,
    role,
    status
FROM user_profiles 
WHERE email = 'admin@sms-system.com'

UNION ALL

SELECT 
    'auth.users' as table_name,
    id,
    email,
    email as name,
    role,
    'confirmed' as status
FROM auth.users 
WHERE email = 'admin@sms-system.com';