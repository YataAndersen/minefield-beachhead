import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

function copyStaticProjectFiles() {
  return {
    name: 'copy-static-project-files',
    closeBundle() {
      copyFileSync(resolve('CAMPOMINADO.html'), resolve('dist/CAMPOMINADO.html'));
      cpSync(resolve('assets'), resolve('dist/assets'), { recursive: true, force: true });
    }
  };
}

export default defineConfig({
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
      devOptions: { enabled: true },
      manifest: {
        name: 'Minefield: Signal',
        short_name: 'Minefield',
        description: 'Um jogo tático de campo minado no modo operador.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [{
          src: 'assets/icons/emoji_olhando_jogador.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }]
      }
    })
  ]
});
