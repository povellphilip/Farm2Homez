/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 50: '#EEF4EF', 100: '#D9E6DC', 200: '#B3CDB9', 500: '#3F7354', 600: '#2F5E44', 700: '#244B36', 800: '#1C3B2B', 900: '#142B20' },
        sage: { 50: '#F3F5EF', 100: '#E7ECE0', 200: '#D3DCC8', 300: '#B7C4A8', 400: '#94A685', 500: '#738763' },
        ivory: { 50: '#FDFBF6', 100: '#F8F3E8', 200: '#EFE7D5', 300: '#E2D6BC' },
        charcoal: { 400: '#686E69', 500: '#5E655F', 600: '#474E49', 700: '#353B37', 800: '#252A27', 900: '#191D1A' },
        terracotta: { 50: '#FBF0EA', 100: '#F5DDD1', 400: '#D27D5B', 500: '#BD6340', 600: '#A04F2F', 700: '#823F25' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(25, 29, 26, 0.04), 0 8px 24px -12px rgba(25, 29, 26, 0.12)',
        lift: '0 2px 4px rgba(25, 29, 26, 0.05), 0 18px 40px -18px rgba(25, 29, 26, 0.22)',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.25rem' },
      maxWidth: { page: '78rem' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'fade-up': 'fade-up 280ms ease-out both' },
    },
  },
  plugins: [],
};
