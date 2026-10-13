import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offline } from './scripts/offline';

export default defineConfig({ plugins: [react(), offline()] });
