import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // One copy of viem for the app and the wallet SDK (backend/wallet/README.md).
  resolve: { dedupe: ['viem'] },
})
