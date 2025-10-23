import { supabase } from '../lib/supabase'
import { APIUtils } from '../utils/api'
import { log } from '../utils/logger'
import type { Report, ServiceResponse } from '../types'

export interface ReportGenerateRequest {
  name: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  format: 'pdf' | 'excel' | 'csv'
  dataRange: {
    startDate: string
    endDate: string
  }
  country?: string
  packageIds?: string[]
  includeCharts?: boolean
  includeDetails?: boolean
}

export interface ReportFilter {
  type?: string
  status?: string
  country?: string
  startDate?: string
  endDate?: string
}

export class ReportService {
  // 获取所有报告
  static async getAllReports(filters?: {
    type?: string
    status?: string
    startDate?: string
    endDate?: string
  }): Promise<ServiceResponse<Report[]>> {
    const result = await APIUtils.apiCall(async () => {
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate)
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      const reports: Report[] = data?.map(this.mapSupabaseToReport) || []
      return { success: true, data: reports }
    }, {
      operation: 'getAllReports',
      cache: true,
      cacheTTL: 30000 // 30秒缓存
    })
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 生成报告
  static async generateReport(request: ReportGenerateRequest): Promise<ServiceResponse<Report>> {
    const result = await APIUtils.apiCall(async () => {
      // 创建报告记录
      const { data, error } = await supabase
        .from('reports')
        .insert([{
          name: request.name,
          type: request.type,
          format: request.format,
          data_range_start: request.dataRange.startDate,
          data_range_end: request.dataRange.endDate,
          country: request.country,
          package_ids: request.packageIds,
          include_charts: request.includeCharts,
          include_details: request.includeDetails,
          status: 'generating'
        }])
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      const report = this.mapSupabaseToReport(data)

      // 异步生成报告内容
      this.processReportGeneration(report.id)
        .catch(error => {
          log.error('报告生成失败', error, 'ReportService')
          // 更新报告状态为失败
          this.updateReportStatus(report.id, 'failed')
        })

      return { success: true, data: report }
    }, {
      operation: 'generateReport',
      timeout: 15000,
      retries: 1
    })
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 更新报告状态
  static async updateReportStatus(
    reportId: string, 
    status: 'generating' | 'completed' | 'failed',
    fileUrl?: string,
    fileSize?: number
  ): Promise<Report | null> {
    const result = await APIUtils.apiCall(async () => {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      if (fileUrl) updateData.file_url = fileUrl
      if (fileSize) updateData.file_size = fileSize

      const { data, error } = await supabase
        .from('reports')
        .update(updateData)
        .eq('id', reportId)
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return this.mapSupabaseToReport(data)
    }, {
      operation: 'updateReportStatus',
      timeout: 10000,
      retries: 2
    })

    return result.success ? result.data : null
  }

  // 删除报告
  static async deleteReport(reportId: string): Promise<ServiceResponse> {
    const result = await APIUtils.apiCall(async () => {
      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', reportId)

      if (error) {
        throw new Error(error.message)
      }

      return { success: true }
    }, {
      operation: 'deleteReport',
      timeout: 10000,
      retries: 2
    })
    
    return {
      success: result.success,
      data: result.data,
      error: result.error?.message
    }
  }

  // 下载报告
  static async downloadReport(id: string): Promise<ServiceResponse<string>> {
    const result = await APIUtils.apiCall(async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('file_url, name')
        .eq('id', id)
        .single()

      if (error) {
        throw new Error(error.message)
      }

      if (!data.file_url) {
        throw new Error('报告文件不存在')
      }

      // 增加下载次数
      await supabase
        .rpc('increment_download_count', { report_id: id })

      return { success: true, data: data.file_url }
    }, {
      operation: 'downloadReport',
      timeout: 10000,
      retries: 2
    })
    
    return {
      success: result.success,
      data: result.data?.data,
      error: result.error?.message
    }
  }

  // 获取报告统计
  static async getReportStats(): Promise<{
    totalReports: number
    totalDownloads: number
    totalSize: number
    recentReports: number
  }> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('download_count, file_size, generated_at')

      if (error) {
        log.error('获取报告统计失败', error, 'ReportService')
        throw error
      }

      const now = new Date()
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1)

      const stats = {
        totalReports: data?.length || 0,
        totalDownloads: data?.reduce((sum, r) => sum + (r.download_count || 0), 0) || 0,
        totalSize: Math.round((data?.reduce((sum, r) => sum + (r.file_size || 0), 0) || 0) / (1024 * 1024)),
        recentReports: data?.filter(r => new Date(r.generated_at) >= monthAgo).length || 0
      }

      return stats
    } catch (error) {
      log.error('ReportService.getReportStats error', error, 'ReportService')
      throw error
    }
  }

  // 异步处理报告生成
  private static async processReportGeneration(reportId: string): Promise<void> {
    try {
      // 模拟报告生成过程
      setTimeout(async () => {
        try {
          // 这里应该是实际的报告生成逻辑
          // 目前使用模拟数据
          const mockFileUrl = `https://example.com/reports/${reportId}.pdf`
          const mockFileSize = Math.floor(Math.random() * 5000000) + 1000000 // 1-5MB

          await this.updateReportStatus(reportId, 'completed', mockFileUrl, mockFileSize)
        } catch (error) {
          log.error('报告生成失败', error, 'ReportService')
          await this.updateReportStatus(reportId, 'failed')
        }
      }, Math.random() * 10000 + 5000) // 5-15秒随机延迟
    } catch (error) {
      log.error('ReportService.processReportGeneration error', error, 'ReportService')
    }
  }

  // 映射Supabase数据到Report类型
  private static mapSupabaseToReport(data: any): Report {
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      format: data.format,
      status: data.status,
      generatedAt: data.generated_at,
      dataRange: {
        startDate: data.data_range_start,
        endDate: data.data_range_end
      },
      country: data.country,
      packageIds: data.package_ids || [],
      includeCharts: data.include_charts,
      includeDetails: data.include_details,
      fileUrl: data.file_url,
      fileSize: data.file_size,
      downloadCount: data.download_count || 0
    }
  }
}