/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Placeholder brand palette — replace with Phrase design-system tokens when available.
        brand: { DEFAULT: '#2d6cdf', dark: '#1f4fa8' },
      },
    },
  },
  plugins: [],
};
