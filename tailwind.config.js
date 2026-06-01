/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./CAMPOMINADO.html",
    "./game.js",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          gold: '#d9c36f',
          'gold-light': '#f4d66d',
          'gold-dim': '#d6c27a',
          olive: '#8f896b',
          'olive-dark': '#7e785c',
          dark: '#11110d',
          panel: '#15160f',
        }
      },
      fontFamily: {
        ops: ['"Black Ops One"', 'system-ui'],
        quantico: ['Quantico', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
