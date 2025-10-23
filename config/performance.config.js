/**
 * 生产环境性能优化配置
 * Production Performance Optimization Configuration
 */

export const performanceConfig = {
  // 代码分割策略
  codeSplitting: {
    // 第三方库分割
    vendor: {
      react: ['react', 'react-dom'],
      router: ['react-router-dom'],
      ui: ['lucide-react', 'sonner'],
      charts: ['recharts'],
      supabase: ['@supabase/supabase-js'],
      store: ['zustand']
    },
    
    // 动态导入阈值
    dynamicImportThreshold: 20000, // 20KB
    
    // 最大并行请求数
    maxParallelRequests: 6,
    
    // 最小 chunk 大小
    minChunkSize: 10000 // 10KB
  },

  // 资源优化
  assets: {
    // 内联资源阈值
    inlineThreshold: 4096, // 4KB
    
    // 图片优化
    images: {
      // 支持的格式
      formats: ['webp', 'avif', 'png', 'jpg'],
      
      // 质量设置
      quality: {
        webp: 80,
        avif: 75,
        jpg: 85,
        png: 90
      },
      
      // 响应式图片断点
      breakpoints: [640, 768, 1024, 1280, 1536]
    },
    
    // 字体优化
    fonts: {
      // 预加载关键字体
      preload: ['Inter-Regular.woff2', 'Inter-Medium.woff2'],
      
      // 字体显示策略
      display: 'swap'
    }
  },

  // 缓存策略
  caching: {
    // 静态资源缓存时间 (秒)
    staticAssets: 31536000, // 1年
    
    // HTML 缓存时间
    html: 3600, // 1小时
    
    // API 缓存时间
    api: 300, // 5分钟
    
    // Service Worker 缓存策略
    serviceWorker: {
      // 缓存优先级
      strategies: {
        images: 'CacheFirst',
        api: 'NetworkFirst',
        static: 'CacheFirst',
        html: 'NetworkFirst'
      },
      
      // 缓存大小限制
      maxEntries: {
        images: 100,
        api: 50,
        static: 200
      }
    }
  },

  // 压缩配置
  compression: {
    // Gzip 压缩
    gzip: {
      enabled: true,
      threshold: 1024, // 1KB
      level: 9
    },
    
    // Brotli 压缩
    brotli: {
      enabled: true,
      threshold: 1024, // 1KB
      quality: 11
    }
  },

  // 预加载策略
  preloading: {
    // 关键资源预加载
    critical: [
      'fonts/Inter-Regular.woff2',
      'fonts/Inter-Medium.woff2'
    ],
    
    // 路由预取
    routePrefetch: {
      enabled: true,
      // 预取延迟 (毫秒)
      delay: 2000,
      // 预取的路由
      routes: ['/dashboard', '/reports', '/settings']
    },
    
    // 组件预加载
    componentPreload: {
      enabled: true,
      // 在视口内时预加载
      intersectionThreshold: 0.1
    }
  },

  // 性能监控
  monitoring: {
    // Web Vitals 阈值
    vitals: {
      // Largest Contentful Paint (毫秒)
      lcp: 2500,
      
      // First Input Delay (毫秒)
      fid: 100,
      
      // Cumulative Layout Shift
      cls: 0.1,
      
      // First Contentful Paint (毫秒)
      fcp: 1800,
      
      // Time to Interactive (毫秒)
      tti: 3800
    },
    
    // 性能预算
    budget: {
      // 总包大小 (KB)
      totalSize: 1000,
      
      // 单个资源大小 (KB)
      resourceSize: 250,
      
      // 请求数量
      requestCount: 50
    }
  },

  // 懒加载配置
  lazyLoading: {
    // 图片懒加载
    images: {
      enabled: true,
      // 预加载距离 (像素)
      rootMargin: '50px',
      // 占位符
      placeholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4='
    },
    
    // 组件懒加载
    components: {
      enabled: true,
      // 预加载距离
      rootMargin: '100px'
    }
  },

  // CDN 配置
  cdn: {
    // 启用 CDN
    enabled: process.env.NODE_ENV === 'production',
    
    // CDN 域名
    domain: process.env.VITE_CDN_DOMAIN || '',
    
    // 静态资源 CDN 路径
    staticPath: '/static',
    
    // 图片 CDN 路径
    imagePath: '/images'
  }
}

export default performanceConfig