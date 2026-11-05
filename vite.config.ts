import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Relative base so the build works on GitHub Pages under /<repo>/ (or any path).
// `npm run dev:phone` serves over HTTPS on your network, because phones only
// allow the camera on secure pages.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'phone' ? [basicSsl()] : [],
}));
