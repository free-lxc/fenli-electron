import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        '../scripts/index',
        '../scripts/utils',
        'adm-zip', // 外部依赖，由 Electron 打包工具处理
      ],
    },
  },
  resolve: {
    alias: {
      '@scripts': resolve(__dirname, 'src/scripts'),
    },
  },
});
