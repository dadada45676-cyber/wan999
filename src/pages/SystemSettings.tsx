import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw, AlertTriangle, Info, CheckCircle, Sliders, Database, Users, Shield, Palette, Bell, Plus, Edit, Trash2, Lock, Unlock, Eye, EyeOff, Search, Filter } from 'lucide-react'
import { useAppStore } from '../store'
import { useAuth, useAuthActions } from '../store/auth'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../hooks/useToast'
import { User, CreateUserForm as CreateUserFormType, EditUserForm as EditUserFormType, UserRole, UserStatus } from '../types/auth'
import Breadcrumb from '../components/Breadcrumb'
import ConfirmDialog from '../components/ConfirmDialog'
import ChangePasswordModal from '../components/ChangePasswordModal'
import SecuritySettings from '../components/SecuritySettings'
import CreateUserForm from '../components/CreateUserForm'
import EditUserForm from '../components/EditUserForm'
import ToastContainer from '../components/ToastContainer'
import { SettingsService } from '../services/settings'

const SystemSettings: React.FC = () => {
  const { settings: systemSettings, updateSettings: setSystemSettings } = useAppStore();
  
  // 认证相关
  const { user: currentUser, users, auditLogs } = useAuth()
  const { createUser, updateUser, deleteUser, lockUser, unlockUser } = useAuthActions()
  const { hasPermission, isAdmin } = usePermissions()
  const { toasts, success, error, removeToast } = useToast()
  
  // 用户管理状态
  const [userManagementState, setUserManagementState] = useState({
    searchTerm: '',
    filterRole: 'all' as UserRole | 'all',
    filterStatus: 'all' as UserStatus | 'all',
    showCreateModal: false,
    showEditModal: false,
    showPasswordModal: false,
    selectedUser: null as User | null,
    currentPage: 1,
    pageSize: 10
  })
  
  // 用户表单状态
  const [userForm, setUserForm] = useState<CreateUserFormType>({
    name: '',
    email: '',
    password: '',
    role: 'operator',
    department: '',
    phone: '',
    status: 'active',
    sendWelcomeEmail: false
  })
  
  // 编辑用户表单状态
  const [editUserForm, setEditUserForm] = useState<EditUserFormType>({
    name: '',
    email: '',
    role: 'operator',
    department: '',
    phone: '',
    status: 'active'
  })
  
  // 号码包评级阈值配置 - 改为区间配置
  const [packageGradeThresholds, setPackageGradeThresholds] = useState({
    SS: { min: 50, max: 100 },  // 50-100
    S: { min: 30, max: 49 },    // 30-49
    A: { min: 20, max: 29 },    // 20-29
    B: { min: 16, max: 19 },    // 16-19
    C: { min: 10, max: 15 },    // 10-15
    D: { min: 0, max: 9 }       // 0-9 (自动计算)
  });

  // 保本线配置
  const [breakEvenConfig, setBreakEvenConfig] = useState({
    threshold: 16,
    warningLine: 12.8,  // 80%
    dangerLine: 9.6,    // 60%
    unit: '万条',
    description: '16个首充/万条号码'
  });

  // 算法配置
  const [scoringAlgorithm, setScoringAlgorithm] = useState({
    type: 'weighted' as 'simple' | 'weighted' | 'timeDecay',
    weights: {
      ratingScore: 0.6,
      packageSize: 0.3,
      timeDecay: 0.1
    }
  });

  // 最终分档配置
  const [finalGradeConfig, setFinalGradeConfig] = useState([
    { name: 'A' as const, minScore: 85, maxScore: 100, color: '#10B981' },
    { name: 'B' as const, minScore: 70, maxScore: 84, color: '#3B82F6' },
    { name: 'C' as const, minScore: 55, maxScore: 69, color: '#F59E0B' },
    { name: 'D' as const, minScore: 40, maxScore: 54, color: '#EF4444' },
    { name: 'E' as const, minScore: 0, maxScore: 39, color: '#6B7280' }
  ]);

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'danger' | 'warning' | 'info'
  });

  // 下拉选项管理
  const [dropdownOptions, setDropdownOptions] = useState({
    smsProviders: ['移动', '联通', '电信', '虚拟运营商'],
    sources: ['来源1', '来源2', '来源3', '来源4'],
    gamePlatforms: ['平台A', '平台B', '平台C', '平台D'],
    countries: [
      { value: 'CN', label: '中国' },
      { value: 'US', label: '美国' },
      { value: 'JP', label: '日本' },
      { value: 'KR', label: '韩国' },
      { value: 'OTHER', label: '其他' }
    ],
    ratings: [
      { value: '1', label: '1星' },
      { value: '2', label: '2星' },
      { value: '3', label: '3星' },
      { value: '4', label: '4星' },
      { value: '5', label: '5星' }
    ]
  });

  // 系统配置
  const [systemConfig, setSystemConfig] = useState({
    autoBackup: true,
    backupInterval: 24,
    dataRetention: 90,
    maxFileSize: 100,
    enableNotifications: true,
    enableAuditLog: true,
    minRatingCount: 10,
    timeDecayFactor: 0.1,
    ratingScoreMap: {
      '1': 20,
      '2': 40,
      '3': 60,
      '4': 80,
      '5': 100
    }
  });

  const [activeTab, setActiveTab] = useState('packageGrade');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化数据加载
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const result = await SettingsService.getSettings();
        
        if (result.success && result.data) {
          const settings = result.data;
          
          // 更新各个配置状态
          if (settings.packageGradeThresholds) {
            setPackageGradeThresholds(settings.packageGradeThresholds);
          }
          if (settings.breakEvenConfig) {
            setBreakEvenConfig(settings.breakEvenConfig);
          }
          if (settings.scoringAlgorithm) {
            setScoringAlgorithm(settings.scoringAlgorithm);
          }
          if (settings.finalGradeConfig) {
            setFinalGradeConfig(settings.finalGradeConfig);
          }
          if (settings.countryOptions || settings.ratingOptions || settings.smsProviders || settings.sources || settings.gamePlatforms) {
            setDropdownOptions(prev => ({
              ...prev,
              countries: settings.countryOptions || prev.countries,
              ratings: settings.ratingOptions || prev.ratings,
              smsProviders: settings.smsProviders || prev.smsProviders,
              sources: settings.sources || prev.sources,
              gamePlatforms: settings.gamePlatforms || prev.gamePlatforms
            }));
          }
          if (settings.minRatingCount !== undefined || settings.timeDecayFactor !== undefined || settings.ratingScoreMap) {
            setSystemConfig(prev => ({
              ...prev,
              minRatingCount: settings.minRatingCount ?? prev.minRatingCount,
              timeDecayFactor: settings.timeDecayFactor ?? prev.timeDecayFactor,
              ratingScoreMap: settings.ratingScoreMap ? {
                '1': settings.ratingScoreMap['1'] || prev.ratingScoreMap['1'],
                '2': settings.ratingScoreMap['2'] || prev.ratingScoreMap['2'],
                '3': settings.ratingScoreMap['3'] || prev.ratingScoreMap['3'],
                '4': settings.ratingScoreMap['4'] || prev.ratingScoreMap['4'],
                '5': settings.ratingScoreMap['5'] || prev.ratingScoreMap['5']
              } : prev.ratingScoreMap
            }));
          }
          
          // 更新全局状态
          setSystemSettings(settings);
          setHasChanges(false);
        }
      } catch (error) {
        console.error('加载系统设置失败:', error);
        // 使用默认设置，不显示错误提示，避免影响用户体验
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [setSystemSettings]);

  // 监听配置变化
  useEffect(() => {
    if (!isLoading) {
      setHasChanges(true);
    }
  }, [packageGradeThresholds, breakEvenConfig, scoringAlgorithm, finalGradeConfig, dropdownOptions, systemConfig, isLoading]);

  // 保存配置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 构建更新数据
      const updates = {
        packageGradeThresholds,
        breakEvenConfig,
        scoringAlgorithm,
        finalGradeConfig,
        countryOptions: dropdownOptions.countries,
        ratingOptions: dropdownOptions.ratings,
        minRatingCount: systemConfig.minRatingCount,
        timeDecayFactor: systemConfig.timeDecayFactor,
        ratingScoreMap: systemConfig.ratingScoreMap
      };

      // 调用真实的API保存设置
      const result = await SettingsService.updateSettings(updates);
      
      if (result.success) {
        // 更新全局状态
        setSystemSettings(updates);
        setHasChanges(false);
        setSaveSuccess(true);
        success('保存成功', '系统设置已成功保存');
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error(result.error || '保存设置失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      error('保存失败', `保存配置失败: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 重置配置
  const handleReset = () => {
    setPackageGradeThresholds({
      SS: { min: 50, max: 100 },
      S: { min: 30, max: 49 },
      A: { min: 20, max: 29 },
      B: { min: 16, max: 19 },
      C: { min: 10, max: 15 },
      D: { min: 0, max: 9 }
    });
    setBreakEvenConfig({
      threshold: 16,
      warningLine: 12.8,
      dangerLine: 9.6,
      unit: '万条',
      description: '16个首充/万条号码'
    });
    setScoringAlgorithm({
      type: 'weighted',
      weights: {
        ratingScore: 0.6,
        packageSize: 0.3,
        timeDecay: 0.1
      }
    });
    setFinalGradeConfig([
      { name: 'A', minScore: 85, maxScore: 100, color: '#10B981' },
      { name: 'B', minScore: 70, maxScore: 84, color: '#3B82F6' },
      { name: 'C', minScore: 55, maxScore: 69, color: '#F59E0B' },
      { name: 'D', minScore: 40, maxScore: 54, color: '#EF4444' },
      { name: 'E', minScore: 0, maxScore: 39, color: '#6B7280' }
    ]);
    setDropdownOptions({
      smsProviders: ['移动', '联通', '电信', '虚拟运营商'],
      sources: ['来源1', '来源2', '来源3', '来源4'],
      gamePlatforms: ['平台A', '平台B', '平台C', '平台D'],
      countries: [
        { value: 'CN', label: '中国' },
        { value: 'US', label: '美国' },
        { value: 'JP', label: '日本' },
        { value: 'KR', label: '韩国' },
        { value: 'OTHER', label: '其他' }
      ],
      ratings: [
        { value: '1', label: '1星' },
        { value: '2', label: '2星' },
        { value: '3', label: '3星' },
        { value: '4', label: '4星' },
        { value: '5', label: '5星' }
      ]
    });
    setSystemConfig({
      autoBackup: true,
      backupInterval: 24,
      dataRetention: 90,
      maxFileSize: 100,
      enableNotifications: true,
      enableAuditLog: true,
      minRatingCount: 10,
      timeDecayFactor: 0.1,
      ratingScoreMap: {
        '1': 20,
        '2': 40,
        '3': 60,
        '4': 80,
        '5': 100
      }
    });
    setHasChanges(false);
  };

  // 获取评级区间显示文本
  const getGradeRangeText = (grade: string) => {
    const range = packageGradeThresholds[grade as keyof typeof packageGradeThresholds];
    if (!range) return '';
    
    if (grade === 'SS') {
      return `≥ ${range.min}`;
    } else {
      return `${range.min} - ${range.max}`;
    }
  };

  // 验证阈值设置的合理性
  const validateThresholds = (newThresholds: typeof packageGradeThresholds) => {
    const { SS, S, A, B, C } = newThresholds;
    
    // 确保区间内部有效性（最小值 <= 最大值）
    const grades = [SS, S, A, B, C];
    for (const grade of grades) {
      if (grade.min > grade.max) {
        return {
          isValid: false,
          message: '每个等级的最小值不能大于最大值'
        };
      }
    }
    
    // 确保区间不重叠且递减关系：SS.min > S.max, S.min > A.max, 等等
    if (SS.min <= S.max || S.min <= A.max || A.min <= B.max || B.min <= C.max) {
      return {
        isValid: false,
        message: '等级区间不能重叠，必须保持递减关系：SS级 &gt; S级 &gt; A级 &gt; B级 &gt; C级'
      };
    }
    
    // 确保最小间隔（相邻等级间至少间隔1）
    if (SS.min - S.max < 1 || S.min - A.max < 1 || A.min - B.max < 1 || B.min - C.max < 1) {
      return {
        isValid: false,
        message: '相邻等级区间间隔不能小于1'
      };
    }
    
    return { isValid: true, message: '' };
  };

  // 更新号码包评级阈值
  const updatePackageGradeThreshold = (grade: string, field: 'min' | 'max', value: number) => {
    if (grade === 'D') return; // D级不可编辑
    
    const newThresholds = {
      ...packageGradeThresholds,
      [grade]: {
        ...packageGradeThresholds[grade as keyof typeof packageGradeThresholds],
        [field]: value
      }
    };
    
    // 自动更新D级区间
    newThresholds.D = { min: 0, max: newThresholds.C.min - 1 };
    
    const validation = validateThresholds(newThresholds);
    if (validation.isValid) {
      setPackageGradeThresholds(newThresholds);
    } else {
      // 验证失败
      // 这里可以添加toast提示
    }
  };

  // 验证最终分档配置的合理性
  const validateFinalGradeConfig = (config: typeof finalGradeConfig) => {
    // 确保区间内部有效性（最小值 <= 最大值）
    for (const grade of config) {
      if (grade.minScore > grade.maxScore) {
        return {
          isValid: false,
          message: `${grade.name}档的最小值不能大于最大值`
        };
      }
    }
    
    // 确保区间不重叠且递减关系
    for (let i = 0; i < config.length - 1; i++) {
      if (config[i].minScore <= config[i + 1].maxScore) {
        return {
          isValid: false,
          message: `${config[i].name}档与${config[i + 1].name}档区间重叠，请调整分数范围`
        };
      }
    }
    
    return { isValid: true, message: '' };
  };

  // 更新最终分档配置
  const updateFinalGradeConfig = (index: number, field: 'minScore' | 'maxScore' | 'color', value: number | string) => {
    const newConfig = [...finalGradeConfig];
    newConfig[index] = { ...newConfig[index], [field]: value };
    
    // 如果修改的是分数，进行验证
    if (field === 'minScore' || field === 'maxScore') {
      const validation = validateFinalGradeConfig(newConfig);
      if (validation.isValid) {
        setFinalGradeConfig(newConfig);
      } else {
        // 验证失败
        // 这里可以添加toast提示
      }
    } else {
      // 颜色修改直接应用
      setFinalGradeConfig(newConfig);
    }
  };

  // 添加下拉选项
  const addDropdownOption = (category: string, value: string) => {
    if (value.trim()) {
      setDropdownOptions(prev => ({
        ...prev,
        [category]: [...prev[category as keyof typeof prev], value.trim()]
      }));
    }
  };

  // 删除下拉选项
  const removeDropdownOption = (category: string, index: number) => {
    const categoryNames = {
      smsProviders: '短信商',
      sources: '数据来源',
      gamePlatforms: '游戏平台',
      countries: '国家地区'
    };
    
    const categoryName = categoryNames[category as keyof typeof categoryNames] || category;
    const optionValue = dropdownOptions[category as keyof typeof dropdownOptions][index];
    
    setConfirmDialog({
      isOpen: true,
      title: '确认删除选项',
      message: `确定要删除"${categoryName}"中的"${optionValue}"选项吗？`,
      type: 'danger',
      onConfirm: () => {
        setDropdownOptions(prev => ({
          ...prev,
          [category]: prev[category as keyof typeof prev].filter((_, i) => i !== index)
        }));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const tabs = [
    { id: 'packageGrade', name: '号码包评级', icon: Sliders },
    { id: 'finalGrade', name: '最终分档', icon: Database },
    { id: 'algorithm', name: '算法配置', icon: Settings },
    { id: 'dropdown', name: '选项管理', icon: Users },
    { id: 'userManagement', name: '用户管理', icon: Users },
    { id: 'system', name: '系统配置', icon: Bell },
    { id: 'security', name: '安全设置', icon: Shield }
  ];

  return (
    <div className="min-w-[1200px] space-y-8">
      {/* 面包屑导航 */}
      <Breadcrumb />
      
      {/* 页面标题区域 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Settings className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                系统设置
              </h1>
              <p className="text-slate-600 mt-1 text-lg">
                配置SMS营销数据分析系统的评级标准、算法参数和系统选项
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {saveSuccess && (
              <div className="flex items-center bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-200 shadow-sm animate-in slide-in-from-right duration-300">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">配置保存成功</span>
              </div>
            )}
            <button
              onClick={handleReset}
              disabled={!hasChanges || isSaving}
              className="group px-6 py-3 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl text-slate-700 hover:bg-white hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center transition-all duration-200 font-medium"
            >
              <RotateCcw className="h-5 w-5 mr-2 group-hover:rotate-180 transition-transform duration-300" />
              重置配置
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="group px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white rounded-xl flex items-center transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2"></div>
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-200" />
                  保存配置
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 配置变更提示 */}
      {hasChanges && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 backdrop-blur-sm border border-amber-200/50 rounded-xl p-6 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5"></div>
          <div className="relative flex items-start space-x-4">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg shadow-sm">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 mb-1">配置已修改</h3>
              <p className="text-amber-700 leading-relaxed">
                您有未保存的配置更改。请保存设置以使更改生效，或点击重置恢复默认设置。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* 左侧导航 */}
        <div className="lg:col-span-1">
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50"></div>
            <div className="relative">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm mr-3">
                  <Palette className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  配置分类
                </h3>
              </div>
              <nav className="space-y-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group w-full flex items-center px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg scale-105'
                          : 'bg-white/60 hover:bg-white/80 text-slate-700 hover:shadow-md hover:scale-102'
                      }`}
                    >
                      <div className={`p-2 rounded-lg mr-3 transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-white/20'
                          : 'bg-gradient-to-br from-indigo-100 to-purple-100 group-hover:from-indigo-200 group-hover:to-purple-200'
                      }`}>
                        <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                          activeTab === tab.id ? 'text-white' : 'text-indigo-600'
                        }`} />
                      </div>
                      <span className="font-medium">{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* 右侧内容区域 */}
        <div className="lg:col-span-3 space-y-8">
          {isLoading ? (
            <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50"></div>
              <div className="relative flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4 animate-spin">
                    <Settings className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">加载系统设置中...</h3>
                  <p className="text-slate-500">正在从服务器获取配置数据</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 号码包评级配置 */}
              {activeTab === 'packageGrade' && (
            <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50"></div>
              <div className="relative">
                <div className="flex items-center mb-8">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg mr-4">
                    <Sliders className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      号码包评级阈值配置
                    </h3>
                    <p className="text-slate-600 mt-1">设置不同评级的万分转化数阈值</p>
                  </div>
                </div>
                
                <div className="space-y-8">
                  <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5"></div>
                    <div className="relative flex items-start space-x-4">
                      <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-sm">
                        <Info className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-blue-800 mb-3">评级标准说明</h4>
                        <div className="text-blue-700 space-y-4">
                          <div className="bg-white/60 rounded-lg p-4 border border-blue-200/50">
                            <p className="font-medium text-lg mb-2">
                              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                万分转化数 = (首充人数 / 号码总数) × 10000
                              </span>
                            </p>
                            <p className="text-sm text-blue-600">
                              示例：10万个号码产生160个首充，万分转化数 = (160 / 100000) × 10000 = 16
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                              <span><strong>SS级:</strong> {packageGradeThresholds.SS.min}-{packageGradeThresholds.SS.max}万分转化数 (顶级)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              <span><strong>S级:</strong> {packageGradeThresholds.S.min}-{packageGradeThresholds.S.max}万分转化数 (优秀)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                              <span><strong>A级:</strong> {packageGradeThresholds.A.min}-{packageGradeThresholds.A.max}万分转化数 (良好)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                              <span><strong>B级:</strong> {packageGradeThresholds.B.min}-{packageGradeThresholds.B.max}万分转化数 (保本)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                              <span><strong>C级:</strong> {packageGradeThresholds.C.min}-{packageGradeThresholds.C.max}万分转化数 (一般)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <span><strong>D级:</strong> {packageGradeThresholds.D.min}-{packageGradeThresholds.D.max}万分转化数 (较差)</span>
                            </div>
                          </div>
                          
                          <div className="bg-white/60 rounded-lg p-4 border border-blue-200/50 mt-4">
                            <h5 className="font-semibold text-blue-800 mb-2">设置规则</h5>
                            <ul className="text-sm text-blue-600 space-y-1">
                               <li>• 阈值必须保持递减关系：SS级 &gt; S级 &gt; A级 &gt; B级 &gt; C级</li>
                               <li>• 相邻等级间隔不能小于1万分转化数</li>
                               <li>• B级阈值应与保本线一致（当前：{breakEvenConfig.threshold}万分转化数）</li>
                               <li>• D级阈值自动计算，无需手动设置</li>
                               <li>• 建议阈值范围：0-80万分转化数</li>
                             </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg p-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-blue-50/50"></div>
                    <div className="relative">
                      <h4 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
                        <div className="p-2 bg-gradient-to-br from-slate-500 to-blue-600 rounded-lg mr-3">
                          <Sliders className="h-5 w-5 text-white" />
                        </div>
                        评级阈值设置
                      </h4>
                      <div className="space-y-4">
                        {Object.entries(packageGradeThresholds).map(([grade, threshold]) => (
                          <div key={grade} className="group">
                            <div className="flex items-center justify-between p-4 bg-white/60 rounded-lg border border-gray-200/50">
                              <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${
                                  grade === 'SS' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                                  grade === 'S' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                                  grade === 'A' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                                  grade === 'B' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                                  grade === 'C' ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
                                  'bg-gradient-to-br from-red-500 to-red-600'
                                }`}>
                                  {grade}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">{grade}级号码包</p>
                                  <p className="text-sm text-slate-600">万分转化数区间</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                {grade === 'D' ? (
                                  // D级显示但不可编辑
                                  <div className="flex items-center space-x-2 text-gray-500">
                                    <span className="text-sm">自动计算:</span>
                                    <div className="px-3 py-2 bg-gray-100 rounded-lg border">
                                      <span className="font-medium">{threshold.min}</span>
                                    </div>
                                    <span>-</span>
                                    <div className="px-3 py-2 bg-gray-100 rounded-lg border">
                                      <span className="font-medium">{threshold.max}</span>
                                    </div>
                                  </div>
                                ) : (
                                  // 其他等级可编辑
                                  <div className="flex items-center space-x-2">
                                    <div className="flex flex-col">
                                      <label className="text-xs text-gray-500 mb-1">最小值</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={threshold.min}
                                        onChange={(e) => updatePackageGradeThreshold(grade, 'min', parseInt(e.target.value) || 0)}
                                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      />
                                    </div>
                                    <span className="text-gray-400 mt-6">-</span>
                                    <div className="flex flex-col">
                                      <label className="text-xs text-gray-500 mb-1">最大值</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={threshold.max}
                                        onChange={(e) => updatePackageGradeThreshold(grade, 'max', parseInt(e.target.value) || 0)}
                                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 阈值验证状态显示 */}
                  {(() => {
                    const validation = validateThresholds(packageGradeThresholds);
                    if (!validation.isValid) {
                      return (
                        <div className="relative overflow-hidden bg-gradient-to-r from-red-50 to-pink-50 backdrop-blur-sm border border-red-200/50 rounded-xl p-6 shadow-lg">
                          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-pink-500/5"></div>
                          <div className="relative flex items-start space-x-4">
                            <div className="p-2 bg-gradient-to-br from-red-400 to-pink-500 rounded-lg shadow-sm">
                              <AlertTriangle className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-lg font-semibold text-red-800 mb-2">阈值设置错误</h4>
                              <p className="text-red-700 leading-relaxed">{validation.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="relative overflow-hidden bg-gradient-to-r from-yellow-50 to-orange-50 backdrop-blur-sm border border-yellow-200/50 rounded-xl p-6 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-orange-500/5"></div>
                    <div className="relative flex items-start space-x-4">
                      <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg shadow-sm">
                        <AlertTriangle className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-yellow-800 mb-2">保本线提醒</h4>
                        <p className="text-yellow-700 leading-relaxed">
                          当前保本线设置为 <span className="font-bold">{breakEvenConfig.threshold}</span> 万分转化数。
                          B级及以上号码包达到保本要求，C级和D级号码包存在亏损风险。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 最终分档配置 */}
          {activeTab === 'finalGrade' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg mr-3">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    号码综合评分分档配置
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">设置号码最终分档的评分阈值</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
                    <div className="text-sm text-green-700">
                      <p className="font-medium mb-2">分档说明：</p>
                      <p>基于号码的多次评级历史，计算综合评分，并按分数区间进行最终分档。分档结果用于号码质量评估和投放决策。</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {finalGradeConfig.map((grade, index) => (
                    <div key={grade.name} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold mr-3"
                            style={{ backgroundColor: grade.color }}
                          >
                            {grade.name}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{grade.name}档号码</p>
                            <p className="text-xs text-gray-500">{grade.minScore}-{grade.maxScore}分</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-500">最小值</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={grade.minScore}
                              onChange={(e) => updateFinalGradeConfig(index, 'minScore', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-500">最大值</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={grade.maxScore}
                              onChange={(e) => updateFinalGradeConfig(index, 'maxScore', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <input
                            type="color"
                            value={grade.color}
                            onChange={(e) => updateFinalGradeConfig(index, 'color', e.target.value)}
                            className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 算法配置 */}
          {activeTab === 'algorithm' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <Settings className="h-5 w-5 text-orange-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">号码综合评分算法配置</h3>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 text-orange-600 mr-2 mt-0.5" />
                    <div className="text-sm text-orange-700">
                      <p className="font-medium mb-2">算法说明：</p>
                      <p>基于号码的历史评级记录，计算综合评分。支持简单平均、加权平均和时间衰减三种算法。</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">评分算法类型</label>
                      <select
                        value={scoringAlgorithm.type}
                        onChange={(e) => setScoringAlgorithm(prev => ({ ...prev, type: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="simple">简单平均</option>
                        <option value="weighted">加权平均</option>
                        <option value="timeDecay">时间衰减</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {scoringAlgorithm.type === 'weighted' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">评级分数权重</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={scoringAlgorithm.weights.ratingScore}
                            onChange={(e) => setScoringAlgorithm(prev => ({ 
                              ...prev, 
                              weights: { ...prev.weights, ratingScore: parseFloat(e.target.value) }
                            }))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 mt-1">评级分数的权重: {scoringAlgorithm.weights.ratingScore}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">包大小权重</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={scoringAlgorithm.weights.packageSize}
                            onChange={(e) => setScoringAlgorithm(prev => ({ 
                              ...prev, 
                              weights: { ...prev.weights, packageSize: parseFloat(e.target.value) }
                            }))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 mt-1">包大小的权重: {scoringAlgorithm.weights.packageSize}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">时间衰减权重</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={scoringAlgorithm.weights.timeDecay}
                            onChange={(e) => setScoringAlgorithm(prev => ({ 
                              ...prev, 
                              weights: { ...prev.weights, timeDecay: parseFloat(e.target.value) }
                            }))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 mt-1">时间衰减的权重: {scoringAlgorithm.weights.timeDecay}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">保本线配置</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">保本线</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={breakEvenConfig.threshold}
                          onChange={(e) => setBreakEvenConfig(prev => ({ ...prev, threshold: parseInt(e.target.value) || 16 }))}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-xs text-gray-600">万分转化数</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">警告线 (80%)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={breakEvenConfig.warningLine}
                          onChange={(e) => setBreakEvenConfig(prev => ({ ...prev, warningLine: parseFloat(e.target.value) || 12.8 }))}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-xs text-gray-600">万分转化数</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">危险线 (60%)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={breakEvenConfig.dangerLine}
                          onChange={(e) => setBreakEvenConfig(prev => ({ ...prev, dangerLine: parseFloat(e.target.value) || 9.6 }))}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <span className="text-xs text-gray-600">万分转化数</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 下拉选项管理 */}
          {activeTab === 'dropdown' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <Users className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">下拉选项管理</h3>
              </div>
              
              <div className="space-y-6">
                {Object.entries(dropdownOptions).map(([category, options]) => (
                  <div key={category} className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      {category === 'smsProviders' ? '短信商' :
                       category === 'sources' ? '数据来源' :
                       category === 'gamePlatforms' ? '游戏平台' :
                       category === 'countries' ? '国家地区' : category}
                    </h4>
                    <div className="space-y-2">
                      {options.map((option, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-700">{option}</span>
                          <button
                            onClick={() => removeDropdownOption(category, index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            删除
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2 mt-2">
                        <input
                          type="text"
                          placeholder="添加新选项"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const target = e.target as HTMLInputElement;
                              addDropdownOption(category, target.value);
                              target.value = '';
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                            addDropdownOption(category, input.value);
                            input.value = '';
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                        >
                          添加
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 系统配置 */}
          {activeTab === 'system' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-6">
                <Bell className="h-5 w-5 text-indigo-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">系统配置</h3>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">数据管理</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">自动备份</p>
                          <p className="text-xs text-gray-500">定期备份系统数据</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={systemConfig.autoBackup}
                            onChange={(e) => setSystemConfig(prev => ({ ...prev, autoBackup: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">备份间隔（小时）</label>
                        <input
                          type="number"
                          min="1"
                          max="168"
                          value={systemConfig.backupInterval}
                          onChange={(e) => setSystemConfig(prev => ({ ...prev, backupInterval: parseInt(e.target.value) || 24 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">数据保留（天）</label>
                        <input
                          type="number"
                          min="30"
                          max="365"
                          value={systemConfig.dataRetention}
                          onChange={(e) => setSystemConfig(prev => ({ ...prev, dataRetention: parseInt(e.target.value) || 90 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">系统设置</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">最大文件大小（MB）</label>
                        <input
                          type="number"
                          min="10"
                          max="1000"
                          value={systemConfig.maxFileSize}
                          onChange={(e) => setSystemConfig(prev => ({ ...prev, maxFileSize: parseInt(e.target.value) || 100 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">系统通知</p>
                          <p className="text-xs text-gray-500">启用系统事件通知</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={systemConfig.enableNotifications}
                            onChange={(e) => setSystemConfig(prev => ({ ...prev, enableNotifications: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">审计日志</p>
                          <p className="text-xs text-gray-500">记录用户操作和系统变更</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={systemConfig.enableAuditLog}
                            onChange={(e) => setSystemConfig(prev => ({ ...prev, enableAuditLog: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <h4 className="text-sm font-medium text-indigo-900 mb-2">系统信息</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-indigo-700">
                    <div>
                      <p className="font-medium">版本信息</p>
                      <p>系统版本：v2.1.0</p>
                      <p>构建时间：2024-12-01</p>
                    </div>
                    <div>
                      <p className="font-medium">性能状态</p>
                      <p>CPU使用率：45%</p>
                      <p>内存使用率：62%</p>
                    </div>
                    <div>
                      <p className="font-medium">数据统计</p>
                      <p>处理号码包：1,234个</p>
                      <p>分析号码：245,680个</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 用户管理 */}
          {activeTab === 'userManagement' && (
            <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/50"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg mr-4">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                        用户管理
                      </h3>
                      <p className="text-slate-600 mt-1">管理系统用户账号、角色权限和访问控制</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setUserManagementState(prev => ({ ...prev, showCreateModal: true }))}
                      className="group px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl flex items-center transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      <Plus className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-200" />
                      新增用户
                    </button>
                  )}
                </div>

                {/* 角色权限说明 */}
                <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6 shadow-lg mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5"></div>
                  <div className="relative">
                    <div className="flex items-center mb-4">
                      <Shield className="h-5 w-5 text-blue-600 mr-2" />
                      <h4 className="text-lg font-semibold text-blue-800">角色权限说明</h4>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 管理员权限 */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-blue-200/30">
                        <div className="flex items-center mb-3">
                          <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-full mr-2"></div>
                          <h5 className="font-semibold text-gray-800">管理员</h5>
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">全部权限</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>号码包管理页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>号码管理页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>用户管理页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>系统设置页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>报告中心页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>数据分析页面（全部功能）</span>
                          </div>
                        </div>
                      </div>

                      {/* 操作员权限 */}
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-blue-200/30">
                        <div className="flex items-center mb-3">
                          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mr-2"></div>
                          <h5 className="font-semibold text-gray-800">操作员</h5>
                          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">基础权限</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>号码包管理页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>号码管理页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-gray-400">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            <span>用户管理页面（无权限）</span>
                          </div>
                          <div className="flex items-center text-gray-400">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            <span>系统设置页面（无权限）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>报告中心页面（全部功能）</span>
                          </div>
                          <div className="flex items-center text-green-700">
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span>数据分析页面（全部功能）</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start">
                        <Info className="h-4 w-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                          <strong>权限说明：</strong>
                          管理员拥有所有6个页面的完全访问权限，包括用户管理和系统设置等敏感功能。
                          操作员拥有4个页面的访问权限，主要负责日常的号码包、号码管理、报告查看和数据分析工作。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 搜索和筛选 */}
                <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 to-teal-50 backdrop-blur-sm border border-emerald-200/50 rounded-xl p-6 shadow-lg mb-8">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5"></div>
                  <div className="relative grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="搜索用户姓名或邮箱..."
                        value={userManagementState.searchTerm}
                        onChange={(e) => setUserManagementState(prev => ({ ...prev, searchTerm: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white/80 backdrop-blur-sm"
                      />
                    </div>
                    <div>
                      <select
                        value={userManagementState.filterRole}
                        onChange={(e) => setUserManagementState(prev => ({ ...prev, filterRole: e.target.value as UserRole | 'all' }))}
                        className="w-full px-4 py-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white/80 backdrop-blur-sm"
                      >
                        <option value="all">全部角色</option>
                        <option value="admin">管理员</option>
                        <option value="operator">操作员</option>
                      </select>
                    </div>
                    <div>
                      <select
                        value={userManagementState.filterStatus}
                        onChange={(e) => setUserManagementState(prev => ({ ...prev, filterStatus: e.target.value as UserStatus | 'all' }))}
                        className="w-full px-4 py-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors bg-white/80 backdrop-blur-sm"
                      >
                        <option value="all">全部状态</option>
                        <option value="active">正常</option>
                        <option value="locked">锁定</option>
                        <option value="inactive">停用</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700 font-medium">
                        共 {users.length} 个用户
                      </span>
                    </div>
                  </div>
                </div>

                {/* 用户列表 */}
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-emerald-800">用户信息</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-emerald-800">角色</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-emerald-800">状态</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-emerald-800">最后登录</th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-emerald-800">创建时间</th>
                          {isAdmin && (
                            <th className="px-6 py-4 text-center text-sm font-semibold text-emerald-800">操作</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/50">
                        {users
                          .filter(user => {
                            const matchesSearch = userManagementState.searchTerm === '' || 
                              user.name.toLowerCase().includes(userManagementState.searchTerm.toLowerCase()) ||
                              user.email.toLowerCase().includes(userManagementState.searchTerm.toLowerCase())
                            const matchesRole = userManagementState.filterRole === 'all' || user.role === userManagementState.filterRole
                            const matchesStatus = userManagementState.filterStatus === 'all' || user.status === userManagementState.filterStatus
                            return matchesSearch && matchesRole && matchesStatus
                          })
                          .map((user) => (
                            <tr key={user.id} className="hover:bg-emerald-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{user.name}</div>
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                    {user.department && (
                                      <div className="text-xs text-gray-400">{user.department}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  user.role === 'admin' 
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                  {user.role === 'admin' ? '管理员' : '操作员'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  user.status === 'active' 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : user.status === 'locked'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : 'bg-gray-100 text-gray-800 border border-gray-200'
                                }`}>
                                  {user.status === 'active' ? '正常' : user.status === 'locked' ? '锁定' : '停用'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '从未登录'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                              </td>
                              {isAdmin && (
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center space-x-2">
                                    <button
                                      onClick={() => {
                                        setEditUserForm({
                                          name: user.name,
                                          email: user.email,
                                          role: user.role,
                                          department: user.department || '',
                                          phone: user.phone || '',
                                          status: user.status
                                        })
                                        setUserManagementState(prev => ({ 
                                          ...prev, 
                                          selectedUser: user, 
                                          showEditModal: true 
                                        }))
                                      }}
                                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="编辑用户"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    {user.status === 'active' ? (
                                      <button
                                        onClick={() => lockUser(user.id)}
                                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                        title="锁定用户"
                                        disabled={user.id === currentUser?.id}
                                      >
                                        <Lock className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => unlockUser(user.id)}
                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                        title="解锁用户"
                                      >
                                        <Unlock className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setUserManagementState(prev => ({ 
                                          ...prev, 
                                          selectedUser: user, 
                                          showPasswordModal: true 
                                        }))
                                      }}
                                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                      title="重置密码"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    {user.id !== currentUser?.id && (
                                      <button
                                        onClick={() => {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: '确认删除用户',
                                            message: `确定要删除用户"${user.name}"吗？此操作不可撤销。`,
                                            type: 'danger',
                                            onConfirm: () => {
                                              deleteUser(user.id)
                                              setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                            }
                                          })
                                        }}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="删除用户"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 安全设置 */}
          {activeTab === 'security' && (
            <SecuritySettings />
          )}
            </>
          )}
        </div>
      </div>

      {/* 创建用户模态框 */}
      <CreateUserForm
        isOpen={userManagementState.showCreateModal}
        onClose={() => setUserManagementState(prev => ({ ...prev, showCreateModal: false }))}
        onSubmit={async (userData) => {
          try {
            await createUser(userData)
            setUserManagementState(prev => ({ ...prev, showCreateModal: false }))
          } catch (error) {
            // 创建用户失败
          }
        }}
        formData={userForm}
        setFormData={setUserForm}
      />

      {/* 编辑用户模态框 */}
      <EditUserForm
        isOpen={userManagementState.showEditModal}
        onClose={() => setUserManagementState(prev => ({ ...prev, showEditModal: false }))}
        onSubmit={async (userData) => {
          if (userManagementState.selectedUser) {
            try {
              await updateUser(userManagementState.selectedUser.id, userData)
              setUserManagementState(prev => ({ ...prev, showEditModal: false, selectedUser: null }))
            } catch (error) {
              // 更新用户失败
            }
          }
        }}
        formData={editUserForm}
        setFormData={setEditUserForm}
        user={userManagementState.selectedUser}
      />

      {/* 重置密码模态框 */}
      <ChangePasswordModal
        isOpen={userManagementState.showPasswordModal}
        onClose={() => setUserManagementState(prev => ({ ...prev, showPasswordModal: false }))}
        onSuccess={() => setUserManagementState(prev => ({ ...prev, showPasswordModal: false }))}
        isFirstLogin={false}
        targetUser={userManagementState.selectedUser}
      />

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText="确认删除"
        cancelText="取消"
      />

      {/* Toast 消息容器 */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default SystemSettings;