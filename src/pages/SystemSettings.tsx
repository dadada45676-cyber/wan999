import { useState, useEffect } from 'react'
import { Settings, Save, RotateCcw, AlertTriangle, CheckCircle, Shield, Palette, Bell, Info, Target, Users, Plus, Search, Sliders, Database, TrendingUp, RefreshCw, Activity, Zap } from 'lucide-react'
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
import { RATING_GRADES } from '../constants'
import { TestRunner } from '../components/TestRunner'

const SystemSettings: React.FC = () => {
  const { 
    settings: systemSettings, 
    updateSettings: setSystemSettings,
    validateAllConfigs,
    getConfigStatus,
    reloadConfigs,
    startConfigHotReload,
    stopConfigHotReload,
    getHotReloadStatus,
    triggerManualRecalculation
  } = useAppStore();
  
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
    unit: '万分转化数',
    description: '16万分转化数为保本线'
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

  // 防误杀配置状态
  const [antiFalsePositiveConfig, setAntiFalsePositiveConfig] = useState({
    threshold: 3,
    enabled: true,
    description: '号码需要在N个不同的号码包中出现才会触发综合评分计算'
  })
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({})

  // 下拉选项管理 - 统一为字符串数组结构
  const [dropdownOptions, setDropdownOptions] = useState({
    smsProviders: ['移动', '联通', '电信', '虚拟运营商'],
    sources: ['来源1', '来源2', '来源3', '来源4'],
    gamePlatforms: ['平台A', '平台B', '平台C', '平台D'],
    countries: ['中国', '美国', '日本', '韩国', '其他'],
    ratings: ['1星', '2星', '3星', '4星', '5星']
  });

  // 系统配置
  const [systemConfig, setSystemConfig] = useState({
    autoBackup: true,
    backupInterval: 24,
    dataRetention: 90,
    maxFileSize: 100,
    enableNotifications: true,
    enableAuditLog: true,
    ratingScoreMap: {
      '1': 20,
      '2': 40,
      '3': 60,
      '4': 80,
      '5': 100
    }
  });

  // 评级分数映射状态
  const [ratingScoreMap, setRatingScoreMap] = useState({
    'SS': 100,
    'S': 85,
    'A': 70,
    'B': 55,
    'C': 40,
    'D': 25
  });

  // 评级分数映射验证错误
  const [ratingScoreMapErrors, setRatingScoreMapErrors] = useState<Record<string, string>>({});

  // 其他状态
  const [activeTab, setActiveTab] = useState('packageGrade');
  

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 配置验证和热更新状态
  const [configValidationStatus, setConfigValidationStatus] = useState<any>(null);
  const [hotReloadStatus, setHotReloadStatus] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

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
            setPackageGradeThresholds({
              SS: settings.packageGradeThresholds.SS || { min: 50, max: 100 },
              S: settings.packageGradeThresholds.S || { min: 30, max: 49 },
              A: settings.packageGradeThresholds.A || { min: 20, max: 29 },
              B: settings.packageGradeThresholds.B || { min: 16, max: 19 },
              C: settings.packageGradeThresholds.C || { min: 10, max: 15 },
              D: settings.packageGradeThresholds.D || { min: 0, max: 9 }
            });
          }
          if (settings.breakEvenConfig) {
            setBreakEvenConfig(settings.breakEvenConfig);
          }

          if (settings.finalGradeConfig) {
            setFinalGradeConfig(settings.finalGradeConfig);
          }
          // 加载评级分数映射配置
          if (settings.ratingScoreMap) {
            setRatingScoreMap({
              'SS': settings.ratingScoreMap['SS'] || 100,
              'S': settings.ratingScoreMap['S'] || 85,
              'A': settings.ratingScoreMap['A'] || 70,
              'B': settings.ratingScoreMap['B'] || 55,
              'C': settings.ratingScoreMap['C'] || 40,
              'D': settings.ratingScoreMap['D'] || 25
            });
          }
          // 修复下拉选项数据加载逻辑 - 处理对象数组转字符串数组
          setDropdownOptions(prev => ({
            smsProviders: settings.smsProviders || prev.smsProviders,
            sources: settings.sources || prev.sources,
            gamePlatforms: settings.gamePlatforms || prev.gamePlatforms,
            countries: settings.countryOptions || prev.countries,
            ratings: settings.ratingOptions || prev.ratings
          }));
          
          // 加载防误杀配置
          if (settings.antiFalsePositiveConfig) {
            setAntiFalsePositiveConfig(settings.antiFalsePositiveConfig);
          }
          
          // 系统配置已经在上面处理了，这里不需要重复设置
        }
      } catch (error) {
        error('加载设置失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);



  // 监听配置变化
  useEffect(() => {
    setHasChanges(true);
  }, [packageGradeThresholds, breakEvenConfig, finalGradeConfig, dropdownOptions, systemConfig, ratingScoreMap, antiFalsePositiveConfig]);

  // 初始化配置状态和热更新状态
  useEffect(() => {
    const initializeConfigStatus = async () => {
      try {
        // 获取配置验证状态
        const configStatus = await getConfigStatus();
        setConfigValidationStatus(configStatus);
        
        // 获取热更新状态
        const hotStatus = await getHotReloadStatus();
        setHotReloadStatus(hotStatus);
      } catch (error) {
        console.error('初始化配置状态失败:', error);
      }
    };

    initializeConfigStatus();
  }, []);





  // 验证评级分数映射
  const validateRatingScoreMap = (scores: Record<string, number>): Record<string, string> => {
    const errors: Record<string, string> = {};
    const grades = RATING_GRADES;
    const values = grades.map(grade => scores[grade]);
    
    // 检查范围约束
    values.forEach((value, index) => {
      const grade = grades[index];
      if (value < 0 || value > 100) {
        errors[grade] = '分数必须在0-100之间';
      }
    });
    
    // 检查严格递减
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] <= values[i + 1]) {
        errors[grades[i + 1]] = '分数必须严格递减';
      }
    }
    
    // 检查相邻差距≥5分
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] - values[i + 1] < 5) {
        errors[grades[i + 1]] = '与上一级差距至少5分';
      }
    }
    
    return errors;
  };

  // 处理评级分数映射变化
  const handleRatingScoreMapChange = (grade: string, value: number) => {
    const newScores = { ...ratingScoreMap, [grade]: value };
    setRatingScoreMap(newScores);
    
    // 实时验证
    const errors = validateRatingScoreMap(newScores);
    setRatingScoreMapErrors(errors);
  };

  // 验证防误杀配置
  const validateAntiFalsePositiveConfig = (config: { threshold: number; enabled: boolean; description: string }): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    // 阈值验证
    if (config.threshold < 1 || config.threshold > 10) {
      errors.threshold = '防误杀阈值必须在1-10之间';
    }
    
    // 描述验证
    if (!config.description || config.description.trim().length === 0) {
      errors.description = '描述不能为空';
    }
    
    return errors;
  };

  // 处理防误杀配置变化
  const handleAntiFalsePositiveConfigChange = (field: string, value: any) => {
    const newConfig = { ...antiFalsePositiveConfig, [field]: value };
    setAntiFalsePositiveConfig(newConfig);
    
    // 实时验证
    const errors = validateAntiFalsePositiveConfig(newConfig);
    setConfigErrors(errors);
  };

  // 保存配置
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // 验证评级分数映射
      const ratingErrors = validateRatingScoreMap(ratingScoreMap);
      if (Object.keys(ratingErrors).length > 0) {
        setRatingScoreMapErrors(ratingErrors);
        error('请修正评级分数映射中的错误');
        return;
      }
      
      // 验证防误杀配置
      const antiFalsePositiveErrors = validateAntiFalsePositiveConfig(antiFalsePositiveConfig);
      if (Object.keys(antiFalsePositiveErrors).length > 0) {
        setConfigErrors(antiFalsePositiveErrors);
        error('请修正防误杀配置中的错误');
        return;
      }
      
      const settingsData = {
        packageGradeThresholds,
        breakEvenConfig,
        finalGradeConfig,
        ratingScoreMapping: ratingScoreMap,
        smsProviders: dropdownOptions.smsProviders,
        sources: dropdownOptions.sources,
        gamePlatforms: dropdownOptions.gamePlatforms,
        systemConfig,
        antiFalsePositiveConfig
      };

      const result = await SettingsService.updateSettings(settingsData);
      
      if (result.success) {
        setHasChanges(false);
        setSaveSuccess(true);
        success('系统设置保存成功');
        
        // 3秒后隐藏成功提示
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        error(result.message || '保存失败，请重试');
      }
    } catch (error) {
      error('保存设置失败');
      error('保存失败，请重试');
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
      unit: '万分转化数',
      description: '16万分转化数为保本线'
    });

    setFinalGradeConfig([
      { name: 'A', minScore: 85, maxScore: 100, color: '#10B981' },
      { name: 'B', minScore: 70, maxScore: 84, color: '#3B82F6' },
      { name: 'C', minScore: 55, maxScore: 69, color: '#F59E0B' },
      { name: 'D', minScore: 40, maxScore: 54, color: '#EF4444' },
      { name: 'E', minScore: 0, maxScore: 39, color: '#6B7280' }
    ]);
    setRatingScoreMap({
      'SS': 100,
      'S': 85,
      'A': 70,
      'B': 55,
      'C': 40,
      'D': 25
    });
    setRatingScoreMapErrors({});
    setDropdownOptions({
      smsProviders: ['移动', '联通', '电信', '虚拟运营商'],
      sources: ['来源1', '来源2', '来源3', '来源4'],
      gamePlatforms: ['平台A', '平台B', '平台C', '平台D'],
      countries: ['中国', '美国', '日本', '韩国', '其他'],
      ratings: ['1星', '2星', '3星', '4星', '5星']
    });
    setSystemConfig({
      autoBackup: true,
      backupInterval: 24,
      dataRetention: 90,
      maxFileSize: 100,
      enableNotifications: true,
      enableAuditLog: true,
      ratingScoreMap: {
        '1': 20,
        '2': 40,
        '3': 60,
        '4': 80,
        '5': 100
      }
    });
    setAntiFalsePositiveConfig({
      threshold: 3,
      enabled: true,
      description: '号码需要在N个不同的号码包中出现才会触发综合评分计算'
    });
    setConfigErrors({});
    setHasChanges(false);
  };

  // 添加下拉选项
  const addDropdownOption = (category: string, value: string) => {
    if (!value.trim()) return;
    
    setDropdownOptions(prev => ({
      ...prev,
      [category]: [...prev[category as keyof typeof prev], value.trim()]
    }));
  };

  // 删除下拉选项
  const removeDropdownOption = (category: string, index: number) => {
    setDropdownOptions(prev => ({
      ...prev,
      [category]: prev[category as keyof typeof prev].filter((_, i) => i !== index)
    }));
  };

  // 加载防误杀配置
  const loadAntiFalsePositiveConfig = async () => {
    try {
      const result = await SettingsService.getAntiFalsePositiveConfig()
      if (result.success && result.data) {
        setAntiFalsePositiveConfig(result.data)
      }
    } catch (error) {
      error('加载防误杀配置失败')
    }
  }



  // 保存防误杀配置
  const saveAntiFalsePositiveConfig = async () => {
    const errors = validateAntiFalsePositiveConfig(antiFalsePositiveConfig)
    if (Object.keys(errors).length > 0) {
      setConfigErrors(errors)
      error('请修正配置中的错误')
      return
    }

    setIsSavingConfig(true)
    setConfigErrors({})
    
    try {
      const result = await SettingsService.updateAntiFalsePositiveConfig(antiFalsePositiveConfig)
      if (result.success) {
        success('防误杀配置保存成功')
      } else {
        error(result.message || '保存失败，请重试')
      }
    } catch (error) {
      error('保存防误杀配置失败')
      error('保存失败，请重试')
    } finally {
      setIsSavingConfig(false)
    }
  }

  // 配置验证功能
  const handleValidateConfigs = async () => {
    setIsValidating(true);
    try {
      const result = await validateAllConfigs();
      setConfigValidationStatus(result);
      
      if (result.overall.isValid) {
        success('所有配置验证通过');
      } else {
        error(`配置验证失败：${result.overall.errors.join(', ')}`);
      }
    } catch (error) {
      error('配置验证失败');
    } finally {
      setIsValidating(false);
    }
  };

  // 重新加载配置
  const handleReloadConfigs = async () => {
    setIsReloading(true);
    try {
      await reloadConfigs();
      success('配置重新加载成功');
      
      // 重新获取配置状态
      const status = await getConfigStatus();
      setConfigValidationStatus(status);
    } catch (error) {
      error('配置重新加载失败');
    } finally {
      setIsReloading(false);
    }
  };

  // 启动配置热更新
  const handleStartHotReload = async () => {
    try {
      await startConfigHotReload();
      success('配置热更新已启动');
      updateHotReloadStatus();
    } catch (error) {
      error('启动配置热更新失败');
    }
  };

  // 停止配置热更新
  const handleStopHotReload = async () => {
    try {
      await stopConfigHotReload();
      success('配置热更新已停止');
      updateHotReloadStatus();
    } catch (error) {
      error('停止配置热更新失败');
    }
  };

  // 手动触发重算
  const handleManualRecalculation = async (configTypes: ('package_grades' | 'phone_ratings' | 'final_grades' | 'all')[] = []) => {
    setIsRecalculating(true);
    try {
      await triggerManualRecalculation(configTypes.length > 0 ? configTypes : ['all']);
      success('手动重算已触发');
      updateHotReloadStatus();
    } catch (error) {
      error('触发手动重算失败');
    } finally {
      setIsRecalculating(false);
    }
  };

  // 更新热更新状态
  const updateHotReloadStatus = async () => {
    try {
      const status = await getHotReloadStatus();
      setHotReloadStatus(status);
    } catch (error) {
      // 静默处理热更新状态获取失败
    }
  };



  // 过滤用户列表
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(userManagementState.searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(userManagementState.searchTerm.toLowerCase());
    const matchesRole = userManagementState.filterRole === 'all' || user.role === userManagementState.filterRole;
    const matchesStatus = userManagementState.filterStatus === 'all' || user.status === userManagementState.filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // 分页用户列表
  const paginatedUsers = filteredUsers.slice(
    (userManagementState.currentPage - 1) * userManagementState.pageSize,
    userManagementState.currentPage * userManagementState.pageSize
  );

  const totalPages = Math.ceil(filteredUsers.length / userManagementState.pageSize);

  // 标签页配置
  const tabs = [
    { id: 'packageGrade', name: '号码包评级', icon: Sliders },
    { id: 'ratingScoreMapping', name: '评级分数映射', icon: Database },
    { id: 'breakEvenConfig', name: '保本线配置', icon: TrendingUp },
    { id: 'finalGradeConfig', name: '最终分档标准配置', icon: Target },
    { id: 'antiFalsePositive', name: '防误杀机制配置', icon: AlertTriangle },
    { id: 'configManagement', name: '配置管理', icon: Activity },
    { id: 'integrationTest', name: '集成测试', icon: Zap },
    { id: 'dropdown', name: '下拉选项管理', icon: Users },
    { id: 'system', name: '系统配置', icon: Bell },
    ...(isAdmin ? [{ id: 'userManagement', name: '用户管理', icon: Shield }] : []),
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
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(packageGradeThresholds).map(([grade, config]) => (
                          <div key={grade} className="relative overflow-hidden bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-white/50"></div>
                            <div className="relative">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                                    grade === 'SS' ? 'bg-gradient-to-br from-purple-500 to-pink-600' :
                                    grade === 'S' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                                    grade === 'A' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                                    grade === 'B' ? 'bg-gradient-to-br from-yellow-500 to-orange-600' :
                                    grade === 'C' ? 'bg-gradient-to-br from-orange-500 to-red-600' :
                                    'bg-gradient-to-br from-red-500 to-pink-600'
                                  }`}>
                                    {grade}
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-bold text-slate-800">{grade}级评级</h4>
                                    <p className="text-sm text-slate-500">
                                      {grade === 'SS' ? '顶级号码包' :
                                       grade === 'S' ? '优秀号码包' :
                                       grade === 'A' ? '良好号码包' :
                                       grade === 'B' ? '保本号码包' :
                                       grade === 'C' ? '一般号码包' :
                                       '较差号码包'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-2">
                                    最小阈值
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={config.min}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        setPackageGradeThresholds(prev => ({
                                          ...prev,
                                          [grade]: { ...prev[grade as keyof typeof prev], min: value }
                                        }));
                                      }}
                                      className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 font-medium"
                                      placeholder="最小值"
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                      <span className="text-xs text-slate-600">万分转化数</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-2">
                                    最大阈值
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={config.max}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        setPackageGradeThresholds(prev => ({
                                          ...prev,
                                          [grade]: { ...prev[grade as keyof typeof prev], max: value }
                                        }));
                                      }}
                                      className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 font-medium"
                                      placeholder="最大值"
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                      <span className="text-xs text-slate-600">万分转化数</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 评级分数映射配置 */}
              {activeTab === 'ratingScoreMapping' && (
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/50"></div>
                  <div className="relative">
                    <div className="flex items-center mb-8">
                      <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg mr-4">
                        <Database className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                          评级分数映射配置
                        </h3>
                        <p className="text-slate-600 mt-1">设置不同评级对应的分数值</p>
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 to-teal-50 backdrop-blur-sm border border-emerald-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5"></div>
                        <div className="relative flex items-start space-x-4">
                          <div className="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg shadow-sm">
                            <Info className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-emerald-800 mb-3">配置规则说明</h4>
                            <div className="text-emerald-700 space-y-2">
                              <p>• 分数范围：0-100分</p>
                              <p>• 必须严格递减：SS &gt; S &gt; A &gt; B &gt; C &gt; D</p>
                              <p>• 相邻等级差距至少5分</p>
                              <p>• 用于计算号码包的最终综合评分</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(ratingScoreMap).map(([grade, score]) => (
                          <div key={grade} className="relative overflow-hidden bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-white/50"></div>
                            <div className="relative">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                                    grade === 'SS' ? 'bg-gradient-to-br from-purple-500 to-pink-600' :
                                    grade === 'S' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                                    grade === 'A' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                                    grade === 'B' ? 'bg-gradient-to-br from-yellow-500 to-orange-600' :
                                    grade === 'C' ? 'bg-gradient-to-br from-orange-500 to-red-600' :
                                    'bg-gradient-to-br from-red-500 to-pink-600'
                                  }`}>
                                    {grade}
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-bold text-slate-800">{grade}级</h4>
                                    <p className="text-sm text-slate-500">评级分数</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  分数值
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={score || 0}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 0;
                                      handleRatingScoreMapChange(grade, value);
                                    }}
                                    className={`w-full px-4 py-3 bg-white/80 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 font-medium ${
                                      ratingScoreMapErrors[grade] ? 'border-red-300 bg-red-50' : 'border-slate-300'
                                    }`}
                                    placeholder="0-100"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <span className="text-xs text-slate-600">分</span>
                                  </div>
                                </div>
                                {ratingScoreMapErrors[grade] && (
                                  <p className="mt-2 text-sm text-red-600">{ratingScoreMapErrors[grade]}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {/* 保本线配置 */}
              {activeTab === 'breakEvenConfig' && (
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/50"></div>
                  <div className="relative">
                    <div className="flex items-center mb-8">
                      <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg mr-4">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                          保本线配置
                        </h3>
                        <p className="text-slate-600 mt-1">设置号码包万分转化数的保本线、警告线和危险线阈值</p>
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                      {/* 保本线说明 */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 to-teal-50 backdrop-blur-sm border border-emerald-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5"></div>
                        <div className="relative flex items-start space-x-4">
                          <div className="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg shadow-sm">
                            <Info className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-emerald-800 mb-3">保本线标准说明</h4>
                            <div className="text-emerald-700 space-y-3">
                              <div className="bg-white/60 rounded-lg p-4 border border-emerald-200/50">
                                <p className="font-medium text-lg mb-2">
                                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                    保本线 = {breakEvenConfig.threshold}{breakEvenConfig.unit}
                                  </span>
                                </p>
                                <p className="text-sm text-emerald-600">
                                  {breakEvenConfig.description}
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                  <span><strong>保本线:</strong> {breakEvenConfig.threshold}{breakEvenConfig.unit} (100%)</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                  <span><strong>警告线:</strong> {breakEvenConfig.warningLine}{breakEvenConfig.unit} (80%)</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                  <span><strong>危险线:</strong> {breakEvenConfig.dangerLine}{breakEvenConfig.unit} (60%)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 保本线参数配置 */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* 基础配置 */}
                        <div className="space-y-6">
                          <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3"></div>
                            基础参数
                          </h4>
                          
                          <div className="space-y-4">
                            {/* 保本线阈值 */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                保本线阈值
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={breakEvenConfig.threshold}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setBreakEvenConfig(prev => ({
                                      ...prev,
                                      threshold: value,
                                      warningLine: value * 0.8,
                                      dangerLine: value * 0.6
                                    }));
                                    setHasChanges(true);
                                  }}
                                  className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 font-medium"
                                  placeholder="保本线阈值"
                                  min="0"
                                  step="0.1"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                  <span className="text-xs text-slate-600">{breakEvenConfig.unit}</span>
                                </div>
                              </div>
                            </div>

                            {/* 单位设置 */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                计量单位
                              </label>
                              <input
                                type="text"
                                value={breakEvenConfig.unit}
                                onChange={(e) => {
                                  setBreakEvenConfig(prev => ({ ...prev, unit: e.target.value }));
                                  setHasChanges(true);
                                }}
                                className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 font-medium"
                                placeholder="计量单位"
                              />
                            </div>

                            {/* 描述设置 */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                保本线描述
                              </label>
                              <textarea
                                value={breakEvenConfig.description}
                                onChange={(e) => {
                                  setBreakEvenConfig(prev => ({ ...prev, description: e.target.value }));
                                  setHasChanges(true);
                                }}
                                className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 font-medium resize-none"
                                placeholder="保本线描述"
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 预警线配置 */}
                        <div className="space-y-6">
                          <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                            <div className="w-2 h-2 bg-amber-500 rounded-full mr-3"></div>
                            预警线配置
                          </h4>
                          
                          <div className="space-y-4">
                            {/* 警告线 */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                警告线 (80%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={breakEvenConfig.warningLine}
                                  onChange={(e) => {
                                    setBreakEvenConfig(prev => ({ ...prev, warningLine: parseFloat(e.target.value) || 0 }));
                                    setHasChanges(true);
                                  }}
                                  className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 font-medium"
                                  placeholder="警告线阈值"
                                  min="0"
                                  step="0.1"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                  <span className="text-xs text-slate-600">{breakEvenConfig.unit}</span>
                                </div>
                              </div>
                              <p className="text-xs text-amber-600 mt-1">
                                建议设置为保本线的80%
                              </p>
                            </div>

                            {/* 危险线 */}
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                危险线 (60%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={breakEvenConfig.dangerLine}
                                  onChange={(e) => {
                                    setBreakEvenConfig(prev => ({ ...prev, dangerLine: parseFloat(e.target.value) || 0 }));
                                    setHasChanges(true);
                                  }}
                                  className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 font-medium"
                                  placeholder="危险线阈值"
                                  min="0"
                                  step="0.1"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                  <span className="text-xs text-slate-600">{breakEvenConfig.unit}</span>
                                </div>
                              </div>
                              <p className="text-xs text-red-600 mt-1">
                                建议设置为保本线的60%
                              </p>
                            </div>

                            {/* 快速设置按钮 */}
                            <div className="pt-4">
                              <p className="text-sm font-medium text-slate-700 mb-3">快速设置</p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {
                                    const threshold = breakEvenConfig.threshold;
                                    setBreakEvenConfig(prev => ({
                                      ...prev,
                                      warningLine: threshold * 0.8,
                                      dangerLine: threshold * 0.6
                                    }));
                                    setHasChanges(true);
                                  }}
                                  className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 transition-colors"
                                >
                                  标准比例
                                </button>
                                <button
                                  onClick={() => {
                                    const threshold = breakEvenConfig.threshold;
                                    setBreakEvenConfig(prev => ({
                                      ...prev,
                                      warningLine: threshold * 0.9,
                                      dangerLine: threshold * 0.7
                                    }));
                                    setHasChanges(true);
                                  }}
                                  className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors"
                                >
                                  宽松比例
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 保本线可视化预览 */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-slate-50 to-gray-50 backdrop-blur-sm border border-slate-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-gray-500/5"></div>
                        <div className="relative">
                          <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                            <div className="w-2 h-2 bg-slate-500 rounded-full mr-3"></div>
                            保本线可视化预览
                          </h4>
                          
                          <div className="space-y-4">
                            {/* 保本线条 */}
                            <div className="relative h-8 bg-gray-200 rounded-lg overflow-hidden">
                              <div 
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300"
                                style={{ width: `${(breakEvenConfig.dangerLine / breakEvenConfig.threshold) * 100}%` }}
                              ></div>
                              <div 
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                                style={{ 
                                  left: `${(breakEvenConfig.dangerLine / breakEvenConfig.threshold) * 100}%`,
                                  width: `${((breakEvenConfig.warningLine - breakEvenConfig.dangerLine) / breakEvenConfig.threshold) * 100}%` 
                                }}
                              ></div>
                              <div 
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                                style={{ 
                                  left: `${(breakEvenConfig.warningLine / breakEvenConfig.threshold) * 100}%`,
                                  width: `${((breakEvenConfig.threshold - breakEvenConfig.warningLine) / breakEvenConfig.threshold) * 100}%` 
                                }}
                              ></div>
                              
                              {/* 刻度标记 */}
                              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium text-white">
                                <span>0</span>
                                <span>{breakEvenConfig.dangerLine}</span>
                                <span>{breakEvenConfig.warningLine}</span>
                                <span>{breakEvenConfig.threshold}</span>
                              </div>
                            </div>
                            
                            {/* 图例 */}
                            <div className="flex items-center justify-center space-x-6 text-sm">
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span>危险区 (0-{breakEvenConfig.dangerLine})</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                                <span>警告区 ({breakEvenConfig.dangerLine}-{breakEvenConfig.warningLine})</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                                <span>安全区 ({breakEvenConfig.warningLine}-{breakEvenConfig.threshold})</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 最终分档标准配置 */}
              {activeTab === 'finalGradeConfig' && (
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50"></div>
                  <div className="relative">
                    <div className="flex items-center mb-8">
                      <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg mr-4">
                        <Target className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          最终分档标准配置
                        </h3>
                        <p className="text-slate-600 mt-1">设置A-E等级的分数区间和显示颜色</p>
                      </div>
                    </div>
                    
                    <div className="space-y-8">
                      {/* 分档说明 */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-50 to-purple-50 backdrop-blur-sm border border-indigo-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5"></div>
                        <div className="relative flex items-start space-x-4">
                          <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm">
                            <Info className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-indigo-800 mb-3">分档标准说明</h4>
                            <div className="text-indigo-700 space-y-3">
                              <div className="bg-white/60 rounded-lg p-4 border border-indigo-200/50">
                                <p className="font-medium text-lg mb-2">
                                  <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    最终分档 = 基于综合评分的等级划分
                                  </span>
                                </p>
                                <p className="text-sm text-indigo-600">
                                  根据号码包的综合评分，自动划分为A、B、C、D、E五个等级
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                                {finalGradeConfig.map((grade) => (
                                  <div key={grade.name} className="flex items-center space-x-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: grade.color }}
                                    ></div>
                                    <span><strong>{grade.name}级:</strong> {grade.minScore}-{grade.maxScore}分</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 分档配置 */}
                      <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-slate-800 flex items-center">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
                          等级分数区间配置
                        </h4>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                          {finalGradeConfig.map((grade, index) => (
                            <div key={grade.name} className="relative overflow-hidden bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200">
                              <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-gray-50/50"></div>
                              <div className="relative">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-3">
                                    <div 
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg"
                                      style={{ backgroundColor: grade.color }}
                                    >
                                      {grade.name}
                                    </div>
                                    <h5 className="text-lg font-semibold text-slate-800">{grade.name}级配置</h5>
                                  </div>
                                </div>
                                
                                <div className="space-y-4">
                                  {/* 最小分数 */}
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                      最小分数
                                    </label>
                                    <input
                                      type="number"
                                      value={grade.minScore}
                                      onChange={(e) => {
                                        const newValue = parseInt(e.target.value) || 0;
                                        setFinalGradeConfig(prev => prev.map((g, i) => 
                                          i === index ? { ...g, minScore: newValue } : g
                                        ));
                                        setHasChanges(true);
                                      }}
                                      className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 font-medium"
                                      placeholder="最小分数"
                                      min="0"
                                      max="100"
                                    />
                                  </div>

                                  {/* 最大分数 */}
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                      最大分数
                                    </label>
                                    <input
                                      type="number"
                                      value={grade.maxScore}
                                      onChange={(e) => {
                                        const newValue = parseInt(e.target.value) || 0;
                                        setFinalGradeConfig(prev => prev.map((g, i) => 
                                          i === index ? { ...g, maxScore: newValue } : g
                                        ));
                                        setHasChanges(true);
                                      }}
                                      className="w-full px-4 py-3 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 font-medium"
                                      placeholder="最大分数"
                                      min="0"
                                      max="100"
                                    />
                                  </div>

                                  {/* 颜色选择 */}
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                      显示颜色
                                    </label>
                                    <div className="flex items-center space-x-3">
                                      <input
                                        type="color"
                                        value={grade.color}
                                        onChange={(e) => {
                                          setFinalGradeConfig(prev => prev.map((g, i) => 
                                            i === index ? { ...g, color: e.target.value } : g
                                          ));
                                          setHasChanges(true);
                                        }}
                                        className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                                      />
                                      <input
                                        type="text"
                                        value={grade.color}
                                        onChange={(e) => {
                                          setFinalGradeConfig(prev => prev.map((g, i) => 
                                            i === index ? { ...g, color: e.target.value } : g
                                          ));
                                          setHasChanges(true);
                                        }}
                                        className="flex-1 px-3 py-2 bg-white/80 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
                                        placeholder="#000000"
                                      />
                                    </div>
                                  </div>

                                  {/* 预设颜色 */}
                                  <div>
                                    <p className="text-sm font-medium text-slate-700 mb-2">预设颜色</p>
                                    <div className="flex space-x-2">
                                      {[
                                        '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#6B7280'
                                      ].map((color) => (
                                        <button
                                          key={color}
                                          onClick={() => {
                                            setFinalGradeConfig(prev => prev.map((g, i) => 
                                              i === index ? { ...g, color } : g
                                            ));
                                            setHasChanges(true);
                                          }}
                                          className="w-6 h-6 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform duration-200"
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 分档预览 */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-slate-50 to-gray-50 backdrop-blur-sm border border-slate-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-gray-500/5"></div>
                        <div className="relative">
                          <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                            <div className="w-2 h-2 bg-slate-500 rounded-full mr-3"></div>
                            分档可视化预览
                          </h4>
                          
                          <div className="space-y-6">
                            {/* 分数轴 */}
                            <div className="relative h-12 bg-gray-200 rounded-lg overflow-hidden">
                              {finalGradeConfig.map((grade, index) => {
                                const width = grade.maxScore - grade.minScore + 1;
                                const left = grade.minScore;
                                return (
                                  <div
                                    key={grade.name}
                                    className="absolute top-0 h-full flex items-center justify-center text-white font-bold text-sm transition-all duration-300 hover:scale-105"
                                    style={{
                                      backgroundColor: grade.color,
                                      left: `${left}%`,
                                      width: `${width}%`
                                    }}
                                  >
                                    {grade.name}
                                  </div>
                                );
                              })}
                              
                              {/* 分数刻度 */}
                              <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-slate-600">
                                <span>0</span>
                                <span>20</span>
                                <span>40</span>
                                <span>60</span>
                                <span>80</span>
                                <span>100</span>
                              </div>
                            </div>
                            
                            {/* 分档详情表格 */}
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                              <table className="w-full">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">等级</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">分数区间</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">颜色</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">区间宽度</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                  {finalGradeConfig.map((grade) => (
                                    <tr key={grade.name} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3">
                                        <div className="flex items-center space-x-3">
                                          <div 
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                            style={{ backgroundColor: grade.color }}
                                          >
                                            {grade.name}
                                          </div>
                                          <span className="font-medium text-slate-800">{grade.name}级</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-slate-600">
                                        {grade.minScore} - {grade.maxScore} 分
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center space-x-2">
                                          <div 
                                            className="w-4 h-4 rounded border border-slate-300"
                                            style={{ backgroundColor: grade.color }}
                                          ></div>
                                          <span className="text-sm text-slate-600 font-mono">{grade.color}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-slate-600">
                                        {grade.maxScore - grade.minScore + 1} 分
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* 快速配置按钮 */}
                            <div className="flex items-center justify-center space-x-4">
                              <button
                                onClick={() => {
                                  setFinalGradeConfig([
                                    { name: 'A' as const, minScore: 85, maxScore: 100, color: '#10B981' },
                                    { name: 'B' as const, minScore: 70, maxScore: 84, color: '#3B82F6' },
                                    { name: 'C' as const, minScore: 55, maxScore: 69, color: '#F59E0B' },
                                    { name: 'D' as const, minScore: 40, maxScore: 54, color: '#EF4444' },
                                    { name: 'E' as const, minScore: 0, maxScore: 39, color: '#6B7280' }
                                  ]);
                                  setHasChanges(true);
                                }}
                                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
                              >
                                恢复默认配置
                              </button>
                              <button
                                onClick={() => {
                                  setFinalGradeConfig([
                                    { name: 'A' as const, minScore: 90, maxScore: 100, color: '#10B981' },
                                    { name: 'B' as const, minScore: 80, maxScore: 89, color: '#3B82F6' },
                                    { name: 'C' as const, minScore: 70, maxScore: 79, color: '#F59E0B' },
                                    { name: 'D' as const, minScore: 60, maxScore: 69, color: '#EF4444' },
                                    { name: 'E' as const, minScore: 0, maxScore: 59, color: '#6B7280' }
                                  ]);
                                  setHasChanges(true);
                                }}
                                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
                              >
                                严格标准
                              </button>
                              <button
                                onClick={() => {
                                  setFinalGradeConfig([
                                    { name: 'A' as const, minScore: 80, maxScore: 100, color: '#10B981' },
                                    { name: 'B' as const, minScore: 60, maxScore: 79, color: '#3B82F6' },
                                    { name: 'C' as const, minScore: 40, maxScore: 59, color: '#F59E0B' },
                                    { name: 'D' as const, minScore: 20, maxScore: 39, color: '#EF4444' },
                                    { name: 'E' as const, minScore: 0, maxScore: 19, color: '#6B7280' }
                                  ]);
                                  setHasChanges(true);
                                }}
                                className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
                              >
                                宽松标准
                              </button>
                            </div>
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
                           category === 'gamePlatforms' ? '游戏平台' : category}
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

              {/* 防误杀机制配置 */}
              {activeTab === 'antiFalsePositive' && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        防误杀机制配置
                      </h3>
                      <p className="text-gray-600 text-sm mt-1">
                        配置号码评分的防误杀阈值，避免因单次评级造成的误判
                      </p>
                    </div>
                    <button
                      onClick={saveAntiFalsePositiveConfig}
                      disabled={isSavingConfig}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingConfig ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          保存配置
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 防误杀阈值配置 */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          防误杀阈值
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={antiFalsePositiveConfig.threshold}
                            onChange={(e) => handleAntiFalsePositiveConfigChange('threshold', parseInt(e.target.value) || 1)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                              configErrors.threshold ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                            placeholder="输入阈值 (1-10)"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <span className="text-sm text-gray-500">次</span>
                          </div>
                        </div>
                        {configErrors.threshold && (
                          <p className="text-red-600 text-sm mt-1">{configErrors.threshold}</p>
                        )}
                        <p className="text-gray-500 text-sm mt-1">
                          号码需要在至少 {antiFalsePositiveConfig.threshold} 个不同的号码包中出现才会触发综合评分计算
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={antiFalsePositiveConfig.enabled}
                            onChange={(e) => handleAntiFalsePositiveConfigChange('enabled', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">启用防误杀机制</span>
                        </label>
                        <p className="text-gray-500 text-sm mt-1 ml-7">
                          关闭后，所有号码都会立即进行综合评分计算
                        </p>
                      </div>
                    </div>

                    {/* 配置说明 */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          机制说明
                        </label>
                        <textarea
                          value={antiFalsePositiveConfig.description}
                          onChange={(e) => handleAntiFalsePositiveConfigChange('description', e.target.value)}
                          rows={4}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none ${
                            configErrors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="输入防误杀机制的说明..."
                        />
                        {configErrors.description && (
                          <p className="text-red-600 text-sm mt-1">{configErrors.description}</p>
                        )}
                      </div>

                      {/* 配置状态指示器 */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">当前配置状态</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">防误杀机制:</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              antiFalsePositiveConfig.enabled 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {antiFalsePositiveConfig.enabled ? '已启用' : '已禁用'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">触发阈值:</span>
                            <span className="font-medium text-gray-900">
                              {antiFalsePositiveConfig.threshold} 次
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 配置管理 */}
              {activeTab === 'configManagement' && (
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl p-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-purple-50/50"></div>
                  <div className="relative">
                    <div className="flex items-center mb-8">
                      <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg mr-4">
                        <Activity className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                          配置管理中心
                        </h3>
                        <p className="text-slate-600 mt-1">配置验证、热更新和批量重算管理</p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* 配置验证状态 */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg shadow-sm">
                                <CheckCircle className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-blue-800">配置验证状态</h4>
                                <p className="text-blue-600 text-sm">检查所有配置的有效性和一致性</p>
                              </div>
                            </div>
                            <button
                              onClick={handleValidateConfigs}
                              disabled={isValidating}
                              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                            >
                              {isValidating ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                  <span>验证中...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  <span>验证配置</span>
                                </>
                              )}
                            </button>
                          </div>

                          {configValidationStatus && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {Object.entries(configValidationStatus).map(([key, status]: [string, any]) => {
                                if (key === 'overall') return null;
                                return (
                                  <div key={key} className="bg-white/60 rounded-lg p-4 border border-blue-200/50">
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="font-medium text-blue-900 text-sm">
                                        {key === 'packageGrades' ? '号码包评级' :
                                         key === 'phoneRatings' ? '号码评级' :
                                         key === 'finalGrades' ? '最终分档' :
                                         key === 'antiFalsePositive' ? '防误杀' : key}
                                      </h5>
                                      <div className={`w-3 h-3 rounded-full ${status.isValid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    </div>
                                    <p className={`text-xs ${status.isValid ? 'text-green-700' : 'text-red-700'}`}>
                                      {status.isValid ? '配置有效' : status.errors?.[0] || '配置无效'}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 配置热更新控制 */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-50 to-teal-50 backdrop-blur-sm border border-emerald-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg shadow-sm">
                                <Zap className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-emerald-800">配置热更新</h4>
                                <p className="text-emerald-600 text-sm">实时监控配置变化并自动触发重算</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={handleReloadConfigs}
                                disabled={isReloading}
                                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition-colors"
                              >
                                {isReloading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                    <span>重载中...</span>
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="h-4 w-4" />
                                    <span>重载配置</span>
                                  </>
                                )}
                              </button>
                              {hotReloadStatus?.isActive ? (
                                <button
                                  onClick={handleStopHotReload}
                                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                  <span>停止热更新</span>
                                </button>
                              ) : (
                                <button
                                  onClick={handleStartHotReload}
                                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                >
                                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                  <span>启动热更新</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {hotReloadStatus && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white/60 rounded-lg p-4 border border-emerald-200/50">
                                <h5 className="font-medium text-emerald-900 text-sm mb-2">热更新状态</h5>
                                <div className="flex items-center space-x-2">
                                  <div className={`w-3 h-3 rounded-full ${hotReloadStatus.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                  <span className="text-sm text-emerald-700">
                                    {hotReloadStatus.isActive ? '运行中' : '已停止'}
                                  </span>
                                </div>
                              </div>
                              <div className="bg-white/60 rounded-lg p-4 border border-emerald-200/50">
                                <h5 className="font-medium text-emerald-900 text-sm mb-2">配置变更次数</h5>
                                <p className="text-lg font-bold text-emerald-800">{hotReloadStatus.totalConfigChanges || 0}</p>
                              </div>
                              <div className="bg-white/60 rounded-lg p-4 border border-emerald-200/50">
                                <h5 className="font-medium text-emerald-900 text-sm mb-2">重算任务次数</h5>
                                <p className="text-lg font-bold text-emerald-800">{hotReloadStatus.totalRecalculations || 0}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 手动重算控制 */}
                      <div className="relative overflow-hidden bg-gradient-to-r from-orange-50 to-amber-50 backdrop-blur-sm border border-orange-200/50 rounded-xl p-6 shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg shadow-sm">
                                <RefreshCw className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-semibold text-orange-800">手动重算控制</h4>
                                <p className="text-orange-600 text-sm">手动触发特定配置的数据重算</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {([
                              { key: 'package_grades' as const, name: '号码包评级', icon: Sliders },
                              { key: 'phone_ratings' as const, name: '号码评级', icon: Database },
                              { key: 'final_grades' as const, name: '最终分档', icon: Target },
                              { key: 'all' as const, name: '全部重算', icon: RefreshCw }
                            ] as const).map(({ key, name, icon: Icon }) => (
                              <button
                                key={key}
                                onClick={() => handleManualRecalculation([key])}
                                disabled={isRecalculating}
                                className="flex flex-col items-center space-y-3 p-4 bg-white/60 hover:bg-white/80 border border-orange-200/50 rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-50"
                              >
                                <div className="p-2 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg shadow-sm">
                                  <Icon className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-sm font-medium text-orange-800">{name}</span>
                                {isRecalculating && (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-400/30 border-t-orange-600"></div>
                                )}
                              </button>
                            ))}
                          </div>

                          {hotReloadStatus?.activeRecalculations && hotReloadStatus.activeRecalculations.length > 0 && (
                            <div className="mt-6 bg-white/60 rounded-lg p-4 border border-orange-200/50">
                              <h5 className="font-medium text-orange-900 text-sm mb-3">活跃重算任务</h5>
                              <div className="space-y-2">
                                {hotReloadStatus.activeRecalculations.map((task: any, index: number) => (
                                  <div key={index} className="flex items-center justify-between text-sm">
                                    <span className="text-orange-700">{task.type}</span>
                                    <span className="text-orange-600">{task.status}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 集成测试 */}
              {activeTab === 'integrationTest' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg mr-4">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          集成测试中心
                        </h3>
                        <p className="text-slate-600 mt-1">配置热更新端到端测试，验证系统稳定性和数据一致性</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden bg-gradient-to-r from-indigo-50 to-purple-50 backdrop-blur-sm border border-indigo-200/50 rounded-xl p-6 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5"></div>
                    <div className="relative">
                      <div className="mb-6">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm">
                            <Zap className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-indigo-800">配置热更新集成测试</h4>
                            <p className="text-indigo-600 text-sm">端到端测试配置热更新流程，包括配置验证、数据重算和一致性检查</p>
                          </div>
                        </div>
                        
                        <div className="bg-white/60 rounded-lg p-4 border border-indigo-200/50 mb-4">
                          <h5 className="font-medium text-indigo-900 mb-2">测试覆盖范围：</h5>
                          <ul className="text-sm text-indigo-700 space-y-1">
                            <li>• 配置服务基础功能验证</li>
                            <li>• 配置验证和热更新管理器测试</li>
                            <li>• 配置变更检测和批量重算测试</li>
                            <li>• 数据一致性和并发操作验证</li>
                            <li>• 错误处理和异常恢复测试</li>
                          </ul>
                        </div>
                      </div>

                      {/* TestRunner 组件 */}
                      <TestRunner className="w-full" />
                    </div>
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
              {activeTab === 'userManagement' && isAdmin && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <Shield className="h-5 w-5 text-purple-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">用户管理</h3>
                    </div>
                    <button
                      onClick={() => setUserManagementState(prev => ({ ...prev, showCreateModal: true }))}
                      className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      创建用户
                    </button>
                  </div>

                  {/* 搜索和过滤 */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="搜索用户名或邮箱..."
                        value={userManagementState.searchTerm}
                        onChange={(e) => setUserManagementState(prev => ({ ...prev, searchTerm: e.target.value, currentPage: 1 }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={userManagementState.filterRole}
                        onChange={(e) => setUserManagementState(prev => ({ ...prev, filterRole: e.target.value as UserRole | 'all', currentPage: 1 }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="all">所有角色</option>
                        <option value="admin">管理员</option>
                        <option value="operator">操作员</option>
                      </select>
                      <select
                        value={userManagementState.filterStatus}
                        onChange={(e) => setUserManagementState(prev => ({ ...prev, filterStatus: e.target.value as UserStatus | 'all', currentPage: 1 }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="all">所有状态</option>
                        <option value="active">正常</option>
                        <option value="locked">锁定</option>
                        <option value="inactive">停用</option>
                      </select>
                    </div>
                  </div>

                  {/* 用户列表 */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最后登录</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                           <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                         </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-gray-200">
                         {paginatedUsers.map((user) => (
                           <tr key={user.id}>
                             <td className="px-6 py-4 whitespace-nowrap">
                               <div className="flex items-center">
                                 <div className="flex-shrink-0 h-10 w-10">
                                   <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium">
                                     {user.name.charAt(0).toUpperCase()}
                                   </div>
                                 </div>
                                 <div className="ml-4">
                                   <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                   <div className="text-sm text-gray-500">{user.email}</div>
                                 </div>
                               </div>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                               <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                 user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                               }`}>
                                 {user.role === 'admin' ? '管理员' : '操作员'}
                               </span>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap">
                               <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                 user.status === 'active' ? 'bg-green-100 text-green-800' :
                                 user.status === 'locked' ? 'bg-red-100 text-red-800' :
                                 'bg-gray-100 text-gray-800'
                               }`}>
                                 {user.status === 'active' ? '正常' : user.status === 'locked' ? '锁定' : '停用'}
                               </span>
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                               {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '从未登录'}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                               {new Date(user.createdAt).toLocaleDateString()}
                             </td>
                             <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                               <div className="flex space-x-2">
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
                                   className="text-indigo-600 hover:text-indigo-900"
                                 >
                                   编辑
                                 </button>
                                 {user.status === 'active' ? (
                                   <button
                                     onClick={() => lockUser(user.id)}
                                     className="text-red-600 hover:text-red-900"
                                     disabled={user.id === currentUser?.id}
                                   >
                                     锁定
                                   </button>
                                 ) : (
                                   <button
                                     onClick={() => unlockUser(user.id)}
                                     className="text-green-600 hover:text-green-900"
                                   >
                                     解锁
                                   </button>
                                 )}
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
                                     className="text-red-600 hover:text-red-900"
                                   >
                                     删除
                                   </button>
                                 )}
                               </div>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>

                   {/* 分页 */}
                   {totalPages > 1 && (
                     <div className="flex items-center justify-between mt-6">
                       <div className="text-sm text-gray-700">
                         显示 {(userManagementState.currentPage - 1) * userManagementState.pageSize + 1} 到{' '}
                         {Math.min(userManagementState.currentPage * userManagementState.pageSize, filteredUsers.length)} 条，
                         共 {filteredUsers.length} 条记录
                       </div>
                       <div className="flex space-x-2">
                         <button
                           onClick={() => setUserManagementState(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                           disabled={userManagementState.currentPage === 1}
                           className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           上一页
                         </button>
                         <span className="px-3 py-1 text-sm">
                           第 {userManagementState.currentPage} 页，共 {totalPages} 页
                         </span>
                         <button
                           onClick={() => setUserManagementState(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                           disabled={userManagementState.currentPage === totalPages}
                           className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           下一页
                         </button>
                       </div>
                     </div>
                   )}
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
          const result = await createUser(userData)
          if (result) {
            success('用户创建成功')
            setUserManagementState(prev => ({ ...prev, showCreateModal: false }))
          } else {
            error('用户创建失败，请检查输入信息')
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
            const result = await updateUser(userManagementState.selectedUser.id, userData)
            if (result) {
              success('用户信息更新成功')
              setUserManagementState(prev => ({ ...prev, showEditModal: false, selectedUser: null }))
            } else {
              error('用户信息更新失败，请检查输入信息')
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