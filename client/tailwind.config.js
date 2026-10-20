/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Built around the DoNext blue (#006fef) and navy (#012360).
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec2ff',
          400: '#4f9dff',
          500: '#1a80ff',
          600: '#006fef',
          700: '#0059c4',
          800: '#00479d',
          900: '#012360',
        },
        // Accent from the DoNext check mark
        success: {
          500: '#01bc7a',
          600: '#019a64',
        },
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        ring: {
          '0%, 100%': { transform: 'rotate(0)' },
          '20%, 60%': { transform: 'rotate(-14deg)' },
          '40%, 80%': { transform: 'rotate(14deg)' },
        },
      },
      animation: {
        wave: 'wave 0.9s ease-in-out infinite',
        // A ringing bell for reminders.
        ring: 'ring 0.8s ease-in-out 2',
        // Calmer than Tailwind's default 1s spin for loading indicators.
        'spin-slow': 'spin 1.5s linear infinite',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
};
