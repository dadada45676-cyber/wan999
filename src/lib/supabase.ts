import { createClient } from '@supabase/supabase-js'

// 从环境变量获取 Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 验证环境变量是否配置
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 环境变量未配置。请在 .env.local 文件中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'
  )
}

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 数据库表类型定义
export interface Country {
  id: number
  name: string
  code: string
  created_at?: string
  updated_at?: string
}

export interface User {
  id: string
  email: string
  username?: string
  role: 'admin' | 'user'
  created_at?: string
  updated_at?: string
}

export interface PhonePackage {
  id: number
  name: string
  description?: string
  phone_count: number
  conversion_rate: number
  grade: 'A' | 'B' | 'C' | 'D'
  sms_provider: string
  source: string
  game_platform: string
  status: 'active' | 'inactive' | 'processing'
  country_id: number
  user_id: string
  created_at?: string
  updated_at?: string
}

export interface Phone {
  id: number
  phone_number: string
  package_id: number
  country_id: number
  status: 'active' | 'inactive' | 'used'
  created_at?: string
  updated_at?: string
}

export interface PhoneRating {
  id: number
  phone_id: number
  rating: number
  comment?: string
  created_at?: string
}

export interface PhoneScore {
  id: number
  phone_id: number
  score: number
  score_type: 'quality' | 'conversion' | 'reliability'
  created_at?: string
}

export interface Report {
  id: number
  title: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  data: any
  user_id: string
  created_at?: string
}

// 数据库操作辅助函数
export const dbOperations = {
  // 测试数据库连接
  async testConnection() {
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('count(*)')
        .limit(1)
      
      if (error) throw error
      return { success: true, message: '数据库连接成功' }
    } catch (error) {
      return { 
        success: false, 
        message: `数据库连接失败: ${error instanceof Error ? error.message : '未知错误'}` 
      }
    }
  },

  // 获取所有国家
  async getCountries() {
    const { data, error } = await supabase
      .from('countries')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data as Country[]
  },

  // 获取号码包列表
  async getPhonePackages(limit = 10, offset = 0) {
    const { data, error } = await supabase
      .from('phone_packages')
      .select(`
        *,
        countries(name, code)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) throw error
    return data as (PhonePackage & { countries: Country })[]
  },

  // 获取用户信息
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  }
}