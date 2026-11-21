import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5189, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' },
    fs: {
      // Preserve Vite's defaults and keep ignored local credentials/records
      // outside the preview's HTTP surface, including raw-module requests.
      deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.local/**', '**/.sites-runtime/**', '**/.openai/**', '**/credentials/**', '**/*api-key*.txt', '**/server/**', '**/scripts/**'],
    },
    watch: { ignored: ['**/.local/**', '**/.sites-runtime/**'] },
  },
});
