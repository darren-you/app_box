import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function replaceStaticWebNamePlugin(webName: string): Plugin {
  let distDir = resolve(process.cwd(), 'dist');

  const replacePlaceholders = (filePath: string): void => {
    const source = readFileSync(filePath, 'utf8');
    const next = source.split('%VITE_WEB_NAME%').join(webName);

    if (source !== next) {
      writeFileSync(filePath, next, 'utf8');
    }
  };

  return {
    name: 'replace-static-web-name',
    apply: 'build',
    configResolved(config) {
      distDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!existsSync(distDir)) {
        return;
      }

      const pendingPaths = [distDir];

      while (pendingPaths.length > 0) {
        const currentPath = pendingPaths.pop();
        if (!currentPath) {
          continue;
        }

        for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
          const filePath = resolve(currentPath, entry.name);
          if (entry.isDirectory()) {
            pendingPaths.push(filePath);
            continue;
          }

          if (/\.(html|webmanifest)$/i.test(entry.name)) {
            replacePlaceholders(filePath);
          }
        }
      }
    }
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.BMS_PROXY_TARGET || 'http://localhost:8000';
  const webName = (env.VITE_WEB_NAME || '').trim();

  if (command === 'build') {
    if (!webName) {
      throw new Error('构建失败：缺少 VITE_WEB_NAME。请通过 deploy_config.sh 中的 WEB_NAME 注入网站名称。');
    }
  }

  return {
    plugins: [react(), ...(webName ? [replaceStaticWebNamePlugin(webName)] : [])],
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
