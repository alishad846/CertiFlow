const path = require('node:path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'app/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, 'pages/**/*.{js,ts,jsx,tsx,mdx}')
  ],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        mist: '#F6F8FC',
        accent: {
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b7dfff',
          300: '#86c9ff',
          400: '#55afff',
          500: '#2a8df0',
          600: '#1f6fd0',
          700: '#1f56a8',
          800: '#1f4a85',
          900: '#1d406d'
        }
      },
      boxShadow: {
        glow: '0 20px 80px rgba(42, 141, 240, 0.12)'
      },
      backgroundImage: {
        'hero-grid':
          'linear-gradient(rgba(16,24,40,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(16,24,40,0.04) 1px, transparent 1px)'
      }
    }
  },
  plugins: []
};