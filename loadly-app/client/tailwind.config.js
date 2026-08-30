/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          900: '#1C2541',
          800: '#243154',
          700: '#2D3D67',
        },
        slate: {
          600: '#3A506B',
          500: '#5C7A99',
          400: '#7B9AB8',
        },
        mint: '#5BC0BE',
        cream: '#F8F9FA',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
