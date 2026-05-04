/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['Georgia', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        navy: {
          950: '#060d1f',
          900: '#0a1628',
          800: '#0f2040',
          700: '#163058',
          600: '#1a3a6c',
        },
        teal: {
          accent: '#00d4c8',
          dim: '#008a82',
        },
        amber: {
          flag: '#f59e0b',
        },
      },
      animation: {
        'pulse-border': 'pulse-border 1.5s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'bounce-check': 'bounce-check 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float': 'float 20s ease-in-out infinite',
        'countup-flash': 'countup-flash 0.6s ease',
      },
      keyframes: {
        'pulse-border': {
          '0%, 100%': { borderColor: '#00d4c8', opacity: '1' },
          '50%': { borderColor: '#00d4c8', opacity: '0.4' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(40px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'bounce-check': {
          '0%': { transform: 'scale(0)' },
          '60%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '25%': { transform: 'translateY(-30px) translateX(15px)' },
          '50%': { transform: 'translateY(-15px) translateX(-10px)' },
          '75%': { transform: 'translateY(-25px) translateX(20px)' },
        },
        'countup-flash': {
          '0%': { backgroundColor: 'rgba(245, 158, 11, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
};
