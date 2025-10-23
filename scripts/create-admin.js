#!/usr/bin/env node

/**
 * 创建管理员账户脚本
 * 使用 Supabase Auth API 创建管理员用户，然后在 user_profiles 表中添加相应记录
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 缺少必要的环境变量')
  console.error('请确保 .env.local 文件中包含:')
  console.error('- VITE_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// 使用 service role key 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  const adminEmail = 'admin@sms-system.com'
  const adminPassword = 'Admin123!'
  const adminName = '系统管理员'

  try {
    console.log('🚀 开始创建管理员账户...')
    
    // 1. 通过 Supabase Auth API 创建用户
    console.log('📝 创建 Auth 用户...')
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // 自动确认邮箱
      user_metadata: {
        name: adminName,
        role: 'admin'
      }
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        console.log('⚠️  用户已存在，尝试获取现有用户信息...')
        
        // 尝试通过邮箱查找用户
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) {
          throw new Error(`获取用户列表失败: ${listError.message}`)
        }
        
        const existingUser = existingUsers.users.find(user => user.email === adminEmail)
        if (!existingUser) {
          throw new Error('用户已存在但无法找到')
        }
        
        console.log('✅ 找到现有用户:', existingUser.id)
        
        // 检查 user_profiles 表中是否有对应记录
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', existingUser.id)
          .single()
        
        if (profileError && profileError.code !== 'PGRST116') {
          throw new Error(`查询用户档案失败: ${profileError.message}`)
        }
        
        if (!profile) {
          console.log('📝 创建用户档案记录...')
          await createUserProfile(existingUser.id, adminEmail, adminName)
        } else {
          console.log('✅ 用户档案已存在')
        }
        
        return existingUser
      } else {
        throw new Error(`创建 Auth 用户失败: ${authError.message}`)
      }
    }

    console.log('✅ Auth 用户创建成功:', authUser.user.id)

    // 2. 在 user_profiles 表中创建对应记录
    console.log('📝 创建用户档案记录...')
    await createUserProfile(authUser.user.id, adminEmail, adminName)

    console.log('🎉 管理员账户创建完成!')
    console.log('📧 邮箱:', adminEmail)
    console.log('🔑 密码:', adminPassword)
    console.log('👤 用户ID:', authUser.user.id)
    
    return authUser.user

  } catch (error) {
    console.error('❌ 创建管理员账户失败:', error.message)
    process.exit(1)
  }
}

async function createUserProfile(userId, email, name) {
  const { error } = await supabase
    .from('user_profiles')
    .insert({
      id: userId,
      email: email,
      name: name,
      role: 'admin',
      status: 'active',
      permissions: ['*'], // 管理员拥有所有权限
      must_change_password: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (error) {
    throw new Error(`创建用户档案失败: ${error.message}`)
  }

  console.log('✅ 用户档案创建成功')
}

// 运行脚本
createAdminUser()
  .then(() => {
    console.log('✨ 脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 脚本执行失败:', error)
    process.exit(1)
  })

export { createAdminUser }