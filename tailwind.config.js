/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0a0b10',
        panel: '#10131c',
        panel2: '#161a26',
        border: '#1e2433',
        ink: '#e6ebf5',
        muted: '#7c8aa5',
        blue: {
          50: '#e7f0ff',
          100: '#c9deff',
          200: '#94bdff',
          300: '#5d94ff',
          400: '#3576ff',
          500: '#1a5cff',
          600: '#0b47d9',
          700: '#0836a8',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
