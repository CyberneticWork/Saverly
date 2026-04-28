/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B5E20', light: '#4CAF50', dark: '#0A3D0C', faded: '#E8F5E9' },
        secondary: { DEFAULT: '#FF6F00', light: '#FFA726', faded: '#FFF3E0' },
      },
    },
  },
  plugins: [],
};
