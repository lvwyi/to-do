import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { aiProxyPlugin } from './plugins/ai-proxy-plugin.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      ...((mode === 'development' || mode === 'serve') ? [aiProxyPlugin()] : []), // 仅开发环境启用 AI 代理
    ],
    define: {
      'import.meta.env.VITE_AI_PROXY_URL': JSON.stringify(env.VITE_AI_PROXY_URL ?? '/api'),
    },
  }
})
