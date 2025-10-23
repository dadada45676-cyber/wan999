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
      // 获取报告配置信息
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single()

      if (reportError || !reportData) {
        throw new Error('无法获取报告配置信息')
      }

      // 真实的报告生成过程
      const reportContent = await this.generateReportContent(reportData)
      
      // 生成报告文件
      const fileBuffer = await this.generateReportFile(reportContent, reportData.format)
      
      // 上传文件到 Supabase Storage
      const fileName = `${reportData.name}_${reportId}.${reportData.format}`
      const filePath = `reports/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reports')
        .upload(filePath, fileBuffer, {
          contentType: this.getContentType(reportData.format),
          upsert: false
        })

      if (uploadError) {
        throw new Error(`文件上传失败: ${uploadError.message}`)
      }

      // 获取公共访问URL
      const { data: urlData } = supabase.storage
        .from('reports')
        .getPublicUrl(filePath)

      const fileSize = fileBuffer.byteLength

      // 更新报告状态为完成
      await this.updateReportStatus(reportId, 'completed', urlData.publicUrl, fileSize)
      
      log.info(`报告生成成功: ${reportId}`, { fileName, fileSize }, 'ReportService')
      
    } catch (error) {
      log.error('报告生成失败', error, 'ReportService')
      await this.updateReportStatus(reportId, 'failed')
    }
  }

  // 生成报告内容
  private static async generateReportContent(reportConfig: any): Promise<any> {
    try {
      const { data_range_start, data_range_end, country, package_ids, type } = reportConfig
      
      // 查询套餐数据
      let packagesQuery = supabase
        .from('phone_packages')
        .select('*')
        .gte('created_at', data_range_start)
        .lte('created_at', data_range_end)

      if (country) {
        packagesQuery = packagesQuery.eq('country_code', country)
      }

      if (package_ids && package_ids.length > 0) {
        packagesQuery = packagesQuery.in('id', package_ids)
      }

      const { data: packages, error: packagesError } = await packagesQuery

      if (packagesError) {
        throw new Error(`查询套餐数据失败: ${packagesError.message}`)
      }

      // 查询评分数据
      let ratingsQuery = supabase
        .from('phone_ratings')
        .select('*')
        .gte('created_at', data_range_start)
        .lte('created_at', data_range_end)

      if (package_ids && package_ids.length > 0) {
        ratingsQuery = ratingsQuery.in('package_id', package_ids)
      }

      const { data: ratings, error: ratingsError } = await ratingsQuery

      if (ratingsError) {
        throw new Error(`查询评分数据失败: ${ratingsError.message}`)
      }

      // 查询号码评分数据
      let scoresQuery = supabase
        .from('phone_scores')
        .select('*')
        .gte('updated_at', data_range_start)
        .lte('updated_at', data_range_end)

      if (country) {
        scoresQuery = scoresQuery.eq('country_code', country)
      }

      const { data: scores, error: scoresError } = await scoresQuery

      if (scoresError) {
        throw new Error(`查询号码评分失败: ${scoresError.message}`)
      }

      // 数据聚合和分析
      const reportContent = {
        metadata: {
          reportId: reportConfig.id,
          name: reportConfig.name,
          type: reportConfig.type,
          generatedAt: new Date().toISOString(),
          dataRange: {
            startDate: data_range_start,
            endDate: data_range_end
          },
          country: country || 'all'
        },
        summary: {
          totalPackages: packages?.length || 0,
          totalRatings: ratings?.length || 0,
          totalPhones: scores?.length || 0,
          averageScore: scores?.length ? scores.reduce((sum, s) => sum + (s.final_score || 0), 0) / scores.length : 0
        },
        packages: packages || [],
        ratings: ratings || [],
        scores: scores || [],
        analytics: this.generateAnalytics(packages || [], ratings || [], scores || [])
      }

      return reportContent
    } catch (error) {
      log.error('生成报告内容失败', error, 'ReportService')
      throw error
    }
  }

  // 生成分析数据
  private static generateAnalytics(packages: any[], ratings: any[], scores: any[]): any {
    // 等级分布
    const gradeDistribution = scores.reduce((acc, score) => {
      const grade = score.final_grade || 'Unknown'
      acc[grade] = (acc[grade] || 0) + 1
      return acc
    }, {})

    // 套餐转化率分析
    const packageAnalysis = packages.map(pkg => {
      const packageRatings = ratings.filter(r => r.package_id === pkg.id)
      const packageScores = scores.filter(s => s.package_id === pkg.id)
      
      return {
        packageId: pkg.id,
        packageName: pkg.name,
        totalRatings: packageRatings.length,
        averageRating: packageRatings.length ? 
          packageRatings.reduce((sum, r) => sum + (r.score || 0), 0) / packageRatings.length : 0,
        conversionRate: pkg.conversion_rate || 0,
        phoneCount: packageScores.length
      }
    })

    // 时间趋势分析
    const timeAnalysis = this.generateTimeAnalysis(ratings, scores)

    return {
      gradeDistribution,
      packageAnalysis,
      timeAnalysis,
      topPerformingPackages: packageAnalysis
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 10),
      lowPerformingPackages: packageAnalysis
        .sort((a, b) => a.averageRating - b.averageRating)
        .slice(0, 5)
    }
  }

  // 生成时间趋势分析
  private static generateTimeAnalysis(ratings: any[], scores: any[]): any {
    const dailyStats = {}
    
    // 按日期聚合评分数据
    ratings.forEach(rating => {
      const date = rating.created_at.split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = { ratings: 0, totalScore: 0 }
      }
      dailyStats[date].ratings++
      dailyStats[date].totalScore += rating.score || 0
    })

    // 计算每日平均分
    const dailyAverages = Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
      date,
      averageScore: stats.ratings > 0 ? stats.totalScore / stats.ratings : 0,
      ratingCount: stats.ratings
    }))

    return {
      dailyAverages: dailyAverages.sort((a, b) => a.date.localeCompare(b.date))
    }
  }

  // 生成报告文件
  private static async generateReportFile(content: any, format: string): Promise<ArrayBuffer> {
    switch (format) {
      case 'pdf':
        return this.generatePDFReport(content)
      case 'excel':
        return this.generateExcelReport(content)
      case 'csv':
        return this.generateCSVReport(content)
      default:
        throw new Error(`不支持的报告格式: ${format}`)
    }
  }

  // 生成PDF报告
  private static async generatePDFReport(content: any): Promise<ArrayBuffer> {
    // 简化的PDF生成 - 实际项目中应使用专业的PDF库如jsPDF或PDFKit
    const pdfContent = `
报告名称: ${content.metadata.name}
生成时间: ${new Date(content.metadata.generatedAt).toLocaleString('zh-CN')}
数据范围: ${content.metadata.dataRange.startDate} 至 ${content.metadata.dataRange.endDate}

=== 数据摘要 ===
套餐总数: ${content.summary.totalPackages}
评分总数: ${content.summary.totalRatings}
号码总数: ${content.summary.totalPhones}
平均评分: ${content.summary.averageScore.toFixed(2)}

=== 等级分布 ===
${Object.entries(content.analytics.gradeDistribution)
  .map(([grade, count]) => `${grade}级: ${count}个`)
  .join('\n')}

=== 套餐分析 ===
${content.analytics.packageAnalysis
  .map(pkg => `${pkg.packageName}: 评分${pkg.totalRatings}次, 平均分${pkg.averageRating.toFixed(2)}`)
  .join('\n')}
`
    
    // 将文本转换为ArrayBuffer
    const encoder = new TextEncoder()
    return encoder.encode(pdfContent).buffer
  }

  // 生成Excel报告
  private static async generateExcelReport(content: any): Promise<ArrayBuffer> {
    // 简化的Excel生成 - 实际项目中应使用专业的Excel库如ExcelJS
    const csvContent = this.generateCSVContent(content)
    const encoder = new TextEncoder()
    return encoder.encode(csvContent).buffer
  }

  // 生成CSV报告
  private static async generateCSVReport(content: any): Promise<ArrayBuffer> {
    const csvContent = this.generateCSVContent(content)
    const encoder = new TextEncoder()
    return encoder.encode(csvContent).buffer
  }

  // 生成CSV内容
  private static generateCSVContent(content: any): string {
    let csv = '报告摘要\n'
    csv += `报告名称,${content.metadata.name}\n`
    csv += `生成时间,${new Date(content.metadata.generatedAt).toLocaleString('zh-CN')}\n`
    csv += `数据范围,${content.metadata.dataRange.startDate} 至 ${content.metadata.dataRange.endDate}\n`
    csv += `套餐总数,${content.summary.totalPackages}\n`
    csv += `评分总数,${content.summary.totalRatings}\n`
    csv += `号码总数,${content.summary.totalPhones}\n`
    csv += `平均评分,${content.summary.averageScore.toFixed(2)}\n\n`

    csv += '套餐分析\n'
    csv += '套餐名称,评分次数,平均评分,转化率,号码数量\n'
    content.analytics.packageAnalysis.forEach(pkg => {
      csv += `${pkg.packageName},${pkg.totalRatings},${pkg.averageRating.toFixed(2)},${pkg.conversionRate},${pkg.phoneCount}\n`
    })

    csv += '\n等级分布\n'
    csv += '等级,数量\n'
    Object.entries(content.analytics.gradeDistribution).forEach(([grade, count]) => {
      csv += `${grade},${count}\n`
    })

    return csv
  }

  // 获取文件MIME类型
  private static getContentType(format: string): string {
    switch (format) {
      case 'pdf':
        return 'application/pdf'
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      case 'csv':
        return 'text/csv'
      default:
        return 'application/octet-stream'
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