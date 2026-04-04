/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
          900: '#064e3b',
        },
        // Cinematic palette
        void: {
          50: '#f0f4ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
          950: '#080b14',
        },
        aurora: {
          teal: '#2dd4bf',
          emerald: '#34d399',
          cyan: '#22d3ee',
          violet: '#a78bfa',
          indigo: '#818cf8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'drift': 'drift 20s linear infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'draw-line': 'draw-line 2s ease-out forwards',
        'counter-glow': 'counter-glow 2s ease-in-out infinite',
        'orbit': 'orbit 30s linear infinite',
        'orbit-reverse': 'orbit 25s linear infinite reverse',
        'shimmer': 'shimmer 2s linear infinite',
        'slide-up': 'slide-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.8s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        drift: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'draw-line': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        'counter-glow': {
          '0%, 100%': { textShadow: '0 0 20px rgba(45, 212, 191, 0.3)' },
          '50%': { textShadow: '0 0 40px rgba(45, 212, 191, 0.6), 0 0 80px rgba(45, 212, 191, 0.2)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-teal': '0 0 30px rgba(45, 212, 191, 0.15), 0 0 60px rgba(45, 212, 191, 0.05)',
        'glow-violet': '0 0 30px rgba(167, 139, 250, 0.15), 0 0 60px rgba(167, 139, 250, 0.05)',
        'glow-emerald': '0 0 30px rgba(52, 211, 153, 0.15), 0 0 60px rgba(52, 211, 153, 0.05)',
        'glow-white': '0 0 40px rgba(255, 255, 255, 0.08)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.12)',
        'glass-lg': '0 16px 64px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
