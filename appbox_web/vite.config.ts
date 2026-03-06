import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.BMS_PROXY_TARGET || 'http://localhost:8000';

  if (command === 'build') {
    const webName = (env.VITE_WEB_NAME || '').trim();
    if (!webName) {
      throw new Error('构建失败：缺少 VITE_WEB_NAME。请通过 deploy_config.sh 中的 WEB_NAME 注入网站名称。');
    }
  }

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
