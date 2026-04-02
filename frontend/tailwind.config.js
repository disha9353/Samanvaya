/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F4F1DE', // Sand Beige / light bg
          500: '#2EC4B6', // Aqua Green
          600: '#25A196', // Aqua dark
          700: '#1C7C73', // Aqua darker
          900: '#0A2540', // Deep Ocean Blue
        },
        secondary: {
          50: '#90DBF4', // Soft Sky Blue
          500: '#4CAF50', // Earth Green
          600: '#3D8C40', 
        },
        accent: '#FF6B6B', // Coral Accent
        dark: {
          bg: '#0A2540', // Deep Ocean Blue bg
          surface: '#0F3155', // slightly lighter ocean for cards
        },
      },
      boxShadow: {
        glow: '0 0 15px rgba(46,196,182,0.4)',
        glass: '0 8px 32px 0 rgba(10, 37, 64, 0.3)',
      },
      backdropBlur: {
        md: '12px',
        lg: '16px',
      },
      animation: {
        wave: 'wave 15s ease-in-out infinite alternate',
      },
      keyframes: {
        wave: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        }
      }
    },
  },
  plugins: [],
}
