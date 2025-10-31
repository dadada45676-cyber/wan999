/**
 * 测试运行器组件
 * 在浏览器中运行配置热更新集成测试
 */

import React, { useState } from 'react'
import { Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { ConfigHotReloadIntegrationTest, type TestResult } from '../tests/integration/configHotReloadTest'

interface TestRunnerProps {
  className?: string
}

export const TestRunner: React.FC<TestRunnerProps> = ({ className = '' }) => {
  const [isRunning, setIsRunning] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [summary, setSummary] = useState<{
    total: number
    passed: number
    failed: number
    duration: number
    successRate: number
  } | null>(null)

  const runTests = async () => {
    setIsRunning(true)
    setTestResults([])
    setSummary(null)

    try {
      const testRunner = new ConfigHotReloadIntegrationTest()
      const results = await testRunner.runAllTests()
      
      setTestResults(results)
      
      // 计算摘要
      const total = results.length
      const passed = results.filter(r => r.success).length
      const failed = total - passed
      const duration = results.reduce((sum, r) => sum + r.duration, 0)
      const successRate = total > 0 ? (passed / total) * 100 : 0
      
      setSummary({
        total,
        passed,
        failed,
        duration,
        successRate
      })
      
    } catch (error) {
      setTestResults([{
        testName: '测试执行',
        success: false,
        message: error instanceof Error ? error.message : String(error),
        duration: 0
      }])
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    )
  }

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600'
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          配置热更新集成测试
        </h3>
        <button
          onClick={runTests}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              运行中...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              运行测试
            </>
          )}
        </button>
      </div>

      {/* 测试摘要 */}
      {summary && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">测试摘要</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
              <div className="text-sm text-gray-600">总测试数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
              <div className="text-sm text-gray-600">通过</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-sm text-gray-600">失败</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.duration}ms</div>
              <div className="text-sm text-gray-600">总耗时</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${summary.successRate >= 80 ? 'text-green-600' : summary.successRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {summary.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">成功率</div>
            </div>
          </div>
        </div>
      )}

      {/* 测试结果列表 */}
      {testResults.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">测试结果</h4>
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                result.success 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.success)}
                  <div>
                    <div className={`font-medium ${getStatusColor(result.success)}`}>
                      {result.testName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {result.message} • {result.duration}ms
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 测试详情 */}
              {result.details && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <div className="text-sm text-gray-600">
                    <strong>详情:</strong>
                  </div>
                  <pre className="text-xs text-gray-700 mt-1 overflow-x-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!isRunning && testResults.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>点击"运行测试"开始配置热更新集成测试</p>
        </div>
      )}

      {/* 运行中状态 */}
      {isRunning && (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
          <p className="text-gray-600">正在运行集成测试，请稍候...</p>
        </div>
      )}
    </div>
  )
}