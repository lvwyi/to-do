import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/dashscope': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/dashscope/, ''),
        headers: {
          // DashScope standard auth — works for both development and production proxies
          'Authorization': `Bearer ${process.env.VITE_DASHSCOPE_API_KEY}`,
          'X-DashScope-Api-Key': process.env.VITE_DASHSCOPE_API_KEY,
        },
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Proxy Error]', err.message);
          });
        },
      },
    },
  },
})
