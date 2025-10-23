import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 国家配置接口
export interface Country {
  code: string;
  name: string;
  flag: string;
  phonePrefix: string;
  phoneLength: number[];
  mobilePattern?: RegExp; // 手机号码正则表达式
  exampleNumber?: string; // 示例号码
}

// 支持的国家列表
// 根据用户要求：支持9个指定国家
export const COUNTRIES: Country[] = [
  {
    code: 'BR',
    name: '巴西',
    flag: '🇧🇷',
    phonePrefix: '55',
    phoneLength: [13, 14], // +55 + 2位区号 + 8-9位号码
    mobilePattern: /^55[1-9][1-9]\d{8,9}$/,
    exampleNumber: '5511987654321'
  },
  {
    code: 'MX',
    name: '墨西哥',
    flag: '🇲🇽',
    phonePrefix: '52',
    phoneLength: [12, 13], // +52 + 2-3位区号 + 7-8位号码
    mobilePattern: /^52[1-9]\d{9,10}$/,
    exampleNumber: '521234567890'
  },
  {
    code: 'BD',
    name: '孟加拉',
    flag: '🇧🇩',
    phonePrefix: '880',
    phoneLength: [13, 14], // +880 + 1-2位运营商代码 + 8位号码
    mobilePattern: /^880[1-9]\d{8,9}$/,
    exampleNumber: '8801712345678'
  },
  {
    code: 'PH',
    name: '菲律宾',
    flag: '🇵🇭',
    phonePrefix: '63',
    phoneLength: [12, 13], // +63 + 1位区号 + 7-8位号码
    mobilePattern: /^63[2-9]\d{8,9}$/,
    exampleNumber: '639123456789'
  },
  {
    code: 'TH',
    name: '泰国',
    flag: '🇹🇭',
    phonePrefix: '66',
    phoneLength: [11], // +66 + 1位区号 + 8位号码
    mobilePattern: /^66[6-9]\d{8}$/,
    exampleNumber: '66812345678'
  },
  {
    code: 'VN',
    name: '越南',
    flag: '🇻🇳',
    phonePrefix: '84',
    phoneLength: [11, 12], // +84 + 2-3位区号 + 7-8位号码
    mobilePattern: /^84[3-9]\d{8,9}$/,
    exampleNumber: '84912345678'
  },
  {
    code: 'ID',
    name: '印尼',
    flag: '🇮🇩',
    phonePrefix: '62',
    phoneLength: [11, 12, 13], // +62 + 2-3位区号 + 7-9位号码
    mobilePattern: /^62[8][1-9]\d{7,9}$/,
    exampleNumber: '628123456789'
  },
  {
    code: 'NG',
    name: '尼日利亚',
    flag: '🇳🇬',
    phonePrefix: '234',
    phoneLength: [14], // +234 + 3位运营商代码 + 7位号码
    mobilePattern: /^234[7-9]\d{9}$/,
    exampleNumber: '2347012345678'
  },
  {
    code: 'PK',
    name: '巴基斯坦',
    flag: '🇵🇰',
    phonePrefix: '92',
    phoneLength: [12, 13], // +92 + 2-3位区号 + 7-8位号码
    mobilePattern: /^92[3][0-9]\d{8,9}$/,
    exampleNumber: '923001234567'
  }
];

// 国家状态接口
interface CountryState {
  selectedCountry: Country;
  setSelectedCountry: (country: Country) => void;
  getCountryByCode: (code: string) => Country | undefined;
  isValidPhoneForCountry: (phone: string, countryCode?: string) => boolean;
}

// 创建国家状态管理store
export const useCountryStore = create<CountryState>()(
  persist(
    (set, get) => ({
      // 默认选择巴西
      selectedCountry: COUNTRIES[0],

      // 设置选择的国家
      setSelectedCountry: (country: Country) => {
        set({ selectedCountry: country });
      },

      // 根据国家代码获取国家信息
      getCountryByCode: (code: string) => {
        return COUNTRIES.find(country => country.code === code);
      },

      // 验证号码是否符合指定国家格式
      isValidPhoneForCountry: (phone: string, countryCode?: string) => {
        const country = countryCode 
          ? get().getCountryByCode(countryCode) 
          : get().selectedCountry;
        
        if (!country) return false;

        // 移除所有非数字字符
        const cleanPhone = phone.replace(/\D/g, '');
        
        // 优先使用正则表达式验证
        if (country.mobilePattern) {
          return country.mobilePattern.test(cleanPhone);
        }
        
        // 回退到基础验证：检查前缀和长度
        if (!cleanPhone.startsWith(country.phonePrefix)) return false;
        return country.phoneLength.includes(cleanPhone.length);
      }
    }),
    {
      name: 'country-storage', // 本地存储key
      partialize: (state) => ({ selectedCountry: state.selectedCountry })
    }
  )
);

// 自定义hook，方便组件使用
export const useCountry = () => {
  const {
    selectedCountry,
    setSelectedCountry,
    getCountryByCode,
    isValidPhoneForCountry
  } = useCountryStore();

  return {
    selectedCountry,
    setSelectedCountry,
    getCountryByCode,
    isValidPhoneForCountry,
    countries: COUNTRIES
  };
};