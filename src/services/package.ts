// 套餐管理服务
import { supabase } from '../lib/supabase'
import { PhonePackage, PhoneRating, PhoneScore, CreatePackageForm, EditPackageForm } from '../types'
import { APIUtils } from '../utils/api'
import { log } from '../utils/logger'

// 服务响应接口
interface ServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export class PackageService {
  
  // 获取所有套餐
  static async getAllPackages(country?: string): Promise<PhonePackage[]> {
    const cacheKey = country ? `packages:all:${country}` : 'packages:all'
    
    const response = await APIUtils.apiCall(
      async () => {
        let query = supabase
          .from('phone_packages')
          .select('*')
          .order('created_at', { ascending: false })

        // 如果指定了国家，添加过滤条件
        if (country) {
          query = query.eq('country', country)
        }

        const { data, error } = await query

        if (error) {
          throw new Error('获取套餐列表失败')
        }

        return data || []
      },
      { 
        operation: cacheKey,
        cache: true, 
        cacheTTL: 3 * 60 * 1000 
      }
    )

    return response.success ? response.data || [] : []
  }

  // 创建套餐
  static async createPackage(form: CreatePackageForm): Promise<{ success: boolean; error?: string; package?: PhonePackage }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('phone_packages')
          .insert({
            name: form.name,
            description: form.description,
            price: form.price,
            cost: form.cost,
            status: 'active',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          throw new Error('套餐创建失败，请重试')
        }

        return {
          success: true,
          package: data
        }
      },
      { 
        operation: `packages:create:${form.name}`,
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      // 清除套餐列表缓存
      APIUtils.cache.delete('packages:all')
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '套餐创建失败，请重试'
    }
  }

  // 更新套餐
  static async updatePackage(id: string, form: EditPackageForm): Promise<{ success: boolean; error?: string; package?: PhonePackage }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('phone_packages')
          .update({
            name: form.name,
            description: form.description,
            price: form.price,
            cost: form.cost,
            status: form.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw new Error('套餐更新失败，请重试')
        }

        return {
          success: true,
          package: data
        }
      },
      { 
        operation: `packages:update:${id}`,
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      APIUtils.cache.delete('packages:all')
      APIUtils.cache.delete(`packages:${id}`)
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '套餐更新失败，请重试'
    }
  }

  // 删除套餐
  static async deletePackage(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await APIUtils.apiCall(
      async () => {
        // 检查是否有关联的手机评级
        const { data: ratings, error: ratingsError } = await supabase
          .from('phone_ratings')
          .select('id')
          .eq('package_id', id)
          .limit(1)

        if (ratingsError) {
          throw new Error('检查套餐关联数据失败')
        }

        if (ratings && ratings.length > 0) {
          throw new Error('该套餐下还有手机评级数据，无法删除')
        }

        const { error } = await supabase
          .from('phone_packages')
          .delete()
          .eq('id', id)

        if (error) {
          throw new Error('套餐删除失败，请重试')
        }

        return { success: true }
      },
      { 
        operation: `packages:delete:${id}`,
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      APIUtils.cache.delete('packages:all')
      APIUtils.cache.delete(`packages:${id}`)
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '套餐删除失败，请重试'
    }
  }

  // 获取套餐的手机评级
  static async getPackageRatings(packageId: string): Promise<PhoneRating[]> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('phone_ratings')
          .select('*')
          .eq('package_id', packageId)
          .order('created_at', { ascending: false })

        if (error) {
          throw new Error('获取手机评级失败')
        }

        return data || []
      },
      { 
        operation: `packages:ratings:${packageId}`,
        cache: true, 
        cacheTTL: 2 * 60 * 1000 
      }
    )

    return response.success ? response.data || [] : []
  }

  // 批量创建手机评级
  static async createRatings(packageId: string, ratings: Omit<PhoneRating, 'id' | 'package_id' | 'created_at' | 'updated_at'>[]): Promise<{ success: boolean; error?: string; ratings?: PhoneRating[] }> {
    const response = await APIUtils.apiCall(
      async () => {
        const ratingsData = ratings.map(rating => ({
          ...rating,
          package_id: packageId,
          created_at: new Date().toISOString()
        }))

        const { data, error } = await supabase
          .from('phone_ratings')
          .insert(ratingsData)
          .select()

        if (error) {
          throw new Error('手机评级创建失败，请重试')
        }

        return {
          success: true,
          ratings: data
        }
      },
      { 
        operation: `packages:create-ratings:${packageId}`,
        cache: false, 
        retries: 1 
      }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      APIUtils.cache.delete(`packages:ratings:${packageId}`)
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '手机评级创建失败，请重试'
    }
  }

  // 更新手机评级
  static async updateRating(id: string, rating: Partial<PhoneRating>): Promise<{ success: boolean; error?: string; rating?: PhoneRating }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('phone_ratings')
          .update({
            ...rating,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw new Error('手机评级更新失败，请重试')
        }

        return {
          success: true,
          rating: data
        }
      },
      { cache: false, retries: 1 }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      const ratingData = response.data.rating
      if (ratingData?.packageId) {
        APIUtils.cache.delete(`packages:ratings:${ratingData.packageId}`)
      }
      return response.data
    }

    return {
      success: false,
      error: response.error?.message || '手机评级更新失败，请重试'
    }
  }

  // 更新手机评分
  static async updatePhoneScore(phoneNumber: string, updates: Partial<PhoneScore>): Promise<PhoneScore | null> {
    try {
      const response = await APIUtils.apiCall(
        async () => {
          const { data, error } = await supabase
            .from('phone_scores')
            .update({
              ...updates,
              updated_at: new Date().toISOString()
            })
            .eq('phone_number', phoneNumber)
            .select()
            .single()

          if (error) {
            throw new Error('手机评分更新失败')
          }

          return data
        },
        { 
          operation: `phone-scores:update:${phoneNumber}`,
          cache: false, 
          retries: 1 
        }
      )

      if (response.success) {
        // 清除相关缓存
        APIUtils.cache.delete(`phone-scores:${phoneNumber}`)
        return response.data || null
      }

      return null
    } catch (error) {
      log.error('PackageService.updatePhoneScore error', error, 'PackageService')
      return null
    }
  }

  // 插入或更新手机评分
  static async upsertPhoneScore(score: Omit<PhoneScore, 'created_at' | 'updated_at'>): Promise<PhoneScore | null> {
    try {
      const response = await APIUtils.apiCall(
        async () => {
          const now = new Date().toISOString()
          const { data, error } = await supabase
            .from('phone_scores')
            .upsert({
              ...score,
              created_at: now,
              updated_at: now
            })
            .select()
            .single()

          if (error) {
            throw new Error('手机评分保存失败')
          }

          return data
        },
        { 
          operation: `phone-scores:upsert:${score.phoneNumber}`,
          cache: false, 
          retries: 1 
        }
      )

      if (response.success) {
        // 清除相关缓存
        APIUtils.cache.delete(`phone-scores:${score.phoneNumber}`)
        return response.data || null
      }

      return null
    } catch (error) {
      log.error('PackageService.upsertPhoneScore error', error, 'PackageService')
      return null
    }
  }

  // 获取手机评级记录
  static async getPhoneRatings(phoneNumber: string, packageId?: string): Promise<PhoneRating[]> {
    try {
      const cacheKey = packageId 
        ? `phone-ratings:${phoneNumber}:${packageId}`
        : `phone-ratings:${phoneNumber}`

      const response = await APIUtils.apiCall(
        async () => {
          let query = supabase
            .from('phone_ratings')
            .select('*')
            .eq('phone_number', phoneNumber)

          if (packageId) {
            query = query.eq('package_id', packageId)
          }

          const { data, error } = await query.order('created_at', { ascending: false })

          if (error) {
            throw new Error('获取手机评级记录失败')
          }

          return data || []
        },
        { cache: true, cacheTTL: 2 * 60 * 1000 } // 缓存2分钟
      )

      return response.success ? response.data || [] : []
    } catch (error) {
      log.error('PackageService.getPhoneRatings error', error, 'PackageService')
      return []
    }
  }

  // 添加手机评级
  static async addPhoneRating(rating: Omit<PhoneRating, 'id' | 'created_at' | 'updated_at'>): Promise<PhoneRating | null> {
    try {
      const response = await APIUtils.apiCall(
        async () => {
          const now = new Date().toISOString()
          const { data, error } = await supabase
            .from('phone_ratings')
            .insert({
              ...rating,
              created_at: now,
              updated_at: now
            })
            .select()
            .single()

          if (error) {
            throw new Error('添加手机评级失败')
          }

          return data
        },
        { cache: false, retries: 1 }
      )

      if (response.success) {
        // 清除相关缓存
        APIUtils.cache.delete(`phone-ratings:${rating.phoneNumber}`)
        if (rating.packageId) {
          APIUtils.cache.delete(`phone-ratings:${rating.phoneNumber}:${rating.packageId}`)
          APIUtils.cache.delete(`packages:ratings:${rating.packageId}`)
        }
        return response.data || null
      }

      return null
    } catch (error) {
      log.error('PackageService.addPhoneRating error', error, 'PackageService')
      return null
    }
  }

  // 获取手机评分记录
  static async getPhoneScores(country?: string, grade?: string): Promise<PhoneScore[]> {
    try {
      const cacheKey = `phone-scores:${country || 'all'}:${grade || 'all'}`

      const response = await APIUtils.apiCall(
        async () => {
          let query = supabase
            .from('phone_scores')
            .select('*')

          if (country) {
            query = query.eq('country', country)
          }

          if (grade) {
            query = query.eq('final_grade', grade)
          }

          const { data, error } = await query.order('updated_at', { ascending: false })

          if (error) {
            throw new Error('获取手机评分记录失败')
          }

          return data || []
        },
        { 
          operation: cacheKey,
          cache: true, 
          cacheTTL: 3 * 60 * 1000 
        }
      )

      return response.success ? response.data || [] : []
    } catch (error) {
      log.error('PackageService.getPhoneScores error', error, 'PackageService')
      return []
    }
  }

  // 删除手机评级
  static async deleteRating(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await APIUtils.apiCall(
      async () => {
        // 先获取评级信息以便清除缓存
        const { data: ratingData } = await supabase
          .from('phone_ratings')
          .select('package_id')
          .eq('id', id)
          .single()

        const { error } = await supabase
          .from('phone_ratings')
          .delete()
          .eq('id', id)

        if (error) {
          throw new Error('手机评级删除失败，请重试')
        }

        return { 
          success: true,
          packageId: ratingData?.package_id
        }
      },
      { cache: false, retries: 1 }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      if (response.data.packageId) {
        APIUtils.cache.delete(`packages:ratings:${response.data.packageId}`)
      }
      return { success: true }
    }

    return {
      success: false,
      error: response.error?.message || '手机评级删除失败，请重试'
    }
  }

  // 批量删除手机评级
  static async deleteRatings(ids: string[]): Promise<{ success: boolean; error?: string }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data: ratingsData, error } = await supabase
          .from('phone_ratings')
          .delete()
          .in('id', ids)
          .select('package_id')

        if (error) {
          throw new Error('批量删除手机评级失败，请重试')
        }

        return { 
          success: true,
          packageIds: ratingsData?.map(r => r.package_id) || []
        }
      },
      { cache: false, retries: 1 }
    )

    if (response.success && response.data) {
      // 清除相关缓存
      const uniquePackageIds = [...new Set(response.data.packageIds)]
      uniquePackageIds.forEach(packageId => {
        if (packageId) {
          APIUtils.cache.delete(`packages:ratings:${packageId}`)
        }
      })
      return { success: true }
    }

    return {
      success: false,
      error: response.error?.message || '批量删除手机评级失败，请重试'
    }
  }

  // 获取套餐统计信息
  static async getPackageStats(packageId: string): Promise<{
    totalRatings: number
    averageScore: number
    gradeDistribution: Record<string, number>
  }> {
    const response = await APIUtils.apiCall(
      async () => {
        const { data, error } = await supabase
          .from('phone_ratings')
          .select('final_grade, rating_score')
          .eq('package_id', packageId)

        if (error) {
          throw new Error('获取套餐统计信息失败')
        }

        const ratings = data || []
        const totalRatings = ratings.length
        const averageScore = totalRatings > 0 
          ? ratings.reduce((sum, r) => sum + (r.rating_score || 0), 0) / totalRatings 
          : 0

        const gradeDistribution = ratings.reduce((acc, r) => {
          const grade = r.final_grade || 'Unknown'
          acc[grade] = (acc[grade] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        return {
          totalRatings,
          averageScore: Math.round(averageScore * 100) / 100,
          gradeDistribution
        }
      },
      { 
        operation: `packages:stats:${packageId}`,
        cache: true, 
        cacheTTL: 5 * 60 * 1000 
      }
    )

    return response.success ? response.data || {
      totalRatings: 0,
      averageScore: 0,
      gradeDistribution: {}
    } : {
      totalRatings: 0,
      averageScore: 0,
      gradeDistribution: {}
    }
  }
}

// 文件上传服务
export class FileUploadService {
  // 上传号码包文件
  static async uploadPackageFile(file: File, packageId: string): Promise<ServiceResponse<string>> {
    try {
      const fileName = `packages/${packageId}/${file.name}`
      
      const { data, error } = await supabase.storage
        .from('phone-packages')
        .upload(fileName, file)

      if (error) {
        return { success: false, error: error.message }
      }

      // 获取公共URL
      const { data: urlData } = supabase.storage
        .from('phone-packages')
        .getPublicUrl(fileName)

      return { success: true, data: urlData.publicUrl }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '文件上传失败' 
      }
    }
  }

  // 删除号码包文件
  static async deletePackageFile(fileName: string): Promise<ServiceResponse> {
    try {
      const { error } = await supabase.storage
        .from('phone-packages')
        .remove([fileName])

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '文件删除失败' 
      }
    }
  }
}