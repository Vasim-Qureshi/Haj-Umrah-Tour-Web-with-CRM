import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],

  esbuild: {
    // Production me debugger remove hoga
    drop: mode === 'production' ? ['debugger'] : [],
  },
}))