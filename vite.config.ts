import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Iterated-Prisoner-s-Dilemma-Simulator/',
  server: {
    port: 3000
  }
});;
