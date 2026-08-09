/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,html}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Arial', 'sans-serif'],
      },
      colors: {
        // Warm neutral surface palette
        sand: {
          50: '#fdfbf7',
          100: '#f8f3ea',
          200: '#efe6d6',
          300: '#e2d3ba',
          400: '#cdb693',
          500: '#b6976f',
          600: '#9a7a55',
          700: '#7c6045',
          800: '#5f4a37',
          900: '#43352a',
        },
        // Primary brand - honey / amber
        honey: {
          50: '#fff9ed',
          100: '#fff0d3',
          200: '#ffdea6',
          300: '#ffc66e',
          400: '#ffa733',
          500: '#f98c0b',
          600: '#e06f04',
          700: '#b95208',
          800: '#94400e',
          900: '#78350f',
        },
        // Secondary accent - soft violet
        orchid: {
          50: '#f5f4ff',
          100: '#ecebfe',
          200: '#dbd9fe',
          300: '#c0bbfc',
          400: '#a294f8',
          500: '#8b6df2',
          600: '#7a4de5',
          700: '#693cca',
          800: '#5833a5',
          900: '#492d85',
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
        'blob': '2.25rem',
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(67, 53, 42, 0.04), 0 4px 12px -2px rgba(67, 53, 42, 0.07)',
        'lift': '0 2px 4px rgba(67, 53, 42, 0.05), 0 12px 28px -8px rgba(67, 53, 42, 0.16)',
        'float': '0 4px 8px rgba(67, 53, 42, 0.06), 0 24px 48px -12px rgba(67, 53, 42, 0.22)',
        'inner-soft': 'inset 0 1px 2px rgba(255, 255, 255, 0.7), inset 0 -1px 2px rgba(67, 53, 42, 0.06)',
        'glow-honey': '0 0 0 4px rgba(255, 198, 110, 0.35)',
        'glow-orchid': '0 0 0 4px rgba(162, 148, 248, 0.32)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.94) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-side': {
          '0%': { opacity: '0', transform: 'translateX(-12px) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'drop-in': {
          '0%': { opacity: '0', transform: 'scale(0.6) rotate(-8deg)' },
          '60%': { transform: 'scale(1.08) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.28s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-side': 'slide-side 0.3s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        'breathe': 'breathe 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.4s linear infinite',
        'drop-in': 'drop-in 0.35s cubic-bezier(0.34, 1.5, 0.64, 1) both',
      },
    },
  },
  plugins: [],
}
