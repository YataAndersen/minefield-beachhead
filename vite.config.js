import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

function copyStaticProjectFiles() {
  return {
    name: 'copy-static-project-files',
    closeBundle() {
      copyFileSync(resolve('CAMPOMINADO.html'), resolve('dist/CAMPOMINADO.html'));
      cpSync(resolve('assets/icons'), resolve('dist/assets/icons'), { recursive: true, force: true });
      cpSync(resolve('assets/sfx'), resolve('dist/assets/sfx'), { recursive: true, force: true });
    }
  };
}

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          animation: ['gsap'],
          audio: ['howler']
        }
      }
    }
  },
  plugins: [
    copyStaticProjectFiles(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'Minefield: Signal',
        short_name: 'Minefield',
        description: 'A tactical minesweeper game in operator mode.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'fullscreen',
        orientation: 'any',
        icons: [{
          src: 'assets/icons/roguelite/operator_panic.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }]
      }
    })
  ]
});
