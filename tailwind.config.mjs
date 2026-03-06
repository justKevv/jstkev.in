/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'pulse-opacity': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.2' },
        },
        flicker: {
          '0%, 90%, 100%': { opacity: '0.4' },
          '95%': { opacity: '0.15' },
        },
      },
      animation: {
        'pulse-opacity': 'pulse-opacity 3s ease-in-out infinite',
        flicker: 'flicker 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
