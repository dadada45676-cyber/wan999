/**
 * 创建默认管理员用户脚本
 * 这个脚本会在Supabase Auth中创建管理员用户，并同步到user_profiles表
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少必要的环境变量:');
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   VITE_SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

// 使用Service Role Key创建管理员客户端
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 默认管理员信息
const ADMIN_USER = {
  email: process.env.ADMIN_EMAIL || 'admin@sms-system.com',
  password: process.env.ADMIN_PASSWORD || 'Admin123!@#',  // 临时密码，首次登录必须修改
  name: '系统管理员',
  role: 'admin' as const,
  department: '系统管理部',
  phone: '13800138000'
};

async function createAdminUser() {
  try {
    // 1. 检查是否已存在管理员用户
    const { data: existingProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, role')
      .eq('role', 'admin');
    
    if (profileError) {
      console.error('❌ 查询用户档案失败:', profileError.message);
      return;
    }
    
    if (existingProfiles && existingProfiles.length > 0) {
      return;
    }
    
    // 2. 检查Auth中是否已存在该邮箱
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ 查询Auth用户失败:', authError.message);
      return;
    }
    
    const existingAuthUser = authUsers.users?.find((user: any) => user.email === ADMIN_USER.email);
    
    if (existingAuthUser) {
      // 同步到user_profiles
      await syncUserProfile(existingAuthUser.id);
      return;
    }
    
    // 3. 创建Auth用户
    const { data: authData, error: createAuthError } = await supabase.auth.admin.createUser({
      email: ADMIN_USER.email,
      password: ADMIN_USER.password,
      email_confirm: true,  // 自动确认邮箱
      user_metadata: {
        name: ADMIN_USER.name,
        role: ADMIN_USER.role
      }
    });
    
    if (createAuthError) {
      console.error('❌ 创建Auth用户失败:', createAuthError.message);
      return;
    }
    
    if (!authData.user) {
      console.error('❌ 创建Auth用户失败: 返回数据为空');
      return;
    }
    
    // 4. 同步到user_profiles
    await syncUserProfile(authData.user.id);
    
  } catch (error) {
    console.error('❌ 创建管理员用户时发生错误:', error);
  }
}

async function syncUserProfile(authUserId: string) {
  try {
    // 调用手动同步函数
    const { data, error } = await supabase.rpc('manual_sync_admin_user', {
      auth_user_id: authUserId
    });
    
    if (error) {
      console.error('❌ 同步用户档案失败:', error.message);
      
      // 如果RPC失败，尝试直接更新
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          id: authUserId,
          updated_at: new Date().toISOString()
        })
        .eq('email', ADMIN_USER.email);
      
      if (updateError) {
        console.error('❌ 直接更新用户档案也失败:', updateError.message);
      }
    }
    
    // 验证同步结果
    const { data: profile, error: verifyError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authUserId)
      .single();
    
    if (verifyError) {
      console.error('❌ 验证用户档案失败:', verifyError.message);
    }
    
  } catch (error) {
    console.error('❌ 同步用户档案时发生错误:', error);
  }
}

// 执行脚本
createAdminUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

export { createAdminUser };