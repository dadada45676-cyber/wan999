import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'
  
  return {
    // 基础路径配置
    base: '/',
    
    // 构建配置
    build: {
      sourcemap: isProduction ? false : 'inline',
      minify: isProduction ? 'esbuild' : false,
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          // 代码分割
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            ui: ['lucide-react', 'sonner'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
            store: ['zustand']
          },
          // 文件命名
          chunkFileNames: isProduction ? 'assets/js/[name]-[hash].js' : 'assets/js/[name].js',
          entryFileNames: isProduction ? 'assets/js/[name]-[hash].js' : 'assets/js/[name].js',
          assetFileNames: isProduction ? 'assets/[ext]/[name]-[hash].[ext]' : 'assets/[ext]/[name].[ext]'
        }
      },
      // 生产环境优化
      ...(isProduction && {
        cssCodeSplit: true,
        assetsInlineLimit: 4096,
        chunkSizeWarningLimit: 1000,
        emptyOutDir: true,
        // 启用压缩
        reportCompressedSize: true,
        // 优化依赖预构建
        commonjsOptions: {
          transformMixedEsModules: true
        },
        // 启用 Tree Shaking
        treeshake: {
          preset: 'recommended',
          moduleSideEffects: false
        }
      })
    },
    
    // 开发服务器配置
    server: {
      port: 5173,
      host: true,
      open: isDevelopment,
      cors: true
    },
    
    // 预览服务器配置
    preview: {
      port: 4173,
      host: true
    },
    
    // 环境变量配置
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __IS_PRODUCTION__: isProduction,
      __IS_DEVELOPMENT__: isDevelopment
    },
    
    // 插件配置
    plugins: [
      react({
        // 生产环境优化
        ...(isProduction && {
          babel: {
            plugins: [
              // 移除 console.log (除了 error 和 warn)
              ['transform-remove-console', { exclude: ['error', 'warn'] }]
            ]
          }
        })
      }),
      
      traeBadgePlugin({
        variant: 'dark',
        position: 'bottom-right',
        prodOnly: true,
        clickable: true,
        clickUrl: 'https://www.trae.ai/solo?showJoin=1',
        autoTheme: true,
        autoThemeTarget: '#root'
      }), 
      
      tsconfigPaths()
    ],
    
    // 优化配置
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        'zustand',
        'lucide-react',
        'recharts',
        'sonner'
      ]
    },
    
    // CSS 配置
    css: {
      devSourcemap: isDevelopment,
      postcss: './postcss.config.js'
    },
    
    // 解析配置
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  }
})
