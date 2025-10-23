import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: 'admin' | 'operator'
  department?: string
  phone?: string
  status?: 'active' | 'inactive'
  sendWelcomeEmail?: boolean
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 获取环境变量
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    // 创建 Supabase 管理员客户端
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 验证请求方法
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 获取授权头
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 验证用户身份和权限
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 检查用户权限 - 只有管理员可以创建用户
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 解析请求体
    const requestBody: CreateUserRequest = await req.json()
    const { 
      email, 
      password, 
      name, 
      role, 
      department = '', 
      phone = '', 
      status = 'active',
      sendWelcomeEmail = false 
    } = requestBody

    // 验证必填字段
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 验证密码长度
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 验证角色
    if (!['admin', 'operator'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 创建认证用户
    const { data: authUser, error: authError2 } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        department,
        phone
      }
    })

    if (authError2 || !authUser.user) {
      console.error('Auth user creation failed:', authError2)
      return new Response(
        JSON.stringify({ 
          error: authError2?.message || 'Failed to create authentication user' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 创建用户档案
    const { data: profile, error: profileError2 } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authUser.user.id,
        name,
        email,
        role,
        department,
        phone,
        status,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError2) {
      console.error('Profile creation failed:', profileError2)
      
      // 如果档案创建失败，删除已创建的认证用户
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      
      return new Response(
        JSON.stringify({ 
          error: profileError2.message || 'Failed to create user profile' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 记录审计日志
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'user.create',
        resource_type: 'user',
        resource_id: authUser.user.id,
        details: {
          email,
          name,
          role,
          created_user_id: authUser.user.id
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString()
      })

    // 返回成功结果
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          department: profile.department,
          phone: profile.phone,
          status: profile.status,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          createdBy: profile.created_by,
          lastLogin: null,
          loginCount: 0,
          loginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: false,
          permissions: role === 'admin' ? [
            'page.package',
            'page.phone', 
            'page.user',
            'page.settings',
            'page.report',
            'page.analysis'
          ] : [
            'page.package',
            'page.phone',
            'page.report',
            'page.analysis'
          ]
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})