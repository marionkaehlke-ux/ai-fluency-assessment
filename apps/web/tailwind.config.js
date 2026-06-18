/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Helvetica', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        // Phrase Syntax design system tokens
        brand: {
          DEFAULT: '#1080fc',  // click-50 — primary interactive blue
          dark: '#0060d3',     // click-70
          midnight: '#0b2556', // click-90
          light: '#f1f9ff',    // click-10
        },
        surface: {
          page:     '#fafafa',
          card:     '#ffffff',
          recessed: '#f3f3f3',
        },
        border: {
          DEFAULT: '#dfdfdf',
        },
        content: {
          primary:   '#181818',
          secondary: '#505050',
          muted:     '#8c8c8c',
        },
        // AI/generative features — violet (support)
        ai: {
          DEFAULT: '#6255f1',
          dark:    '#4037c3',
          light:   '#f1f4fe',
        },
        // Semantic states
        success: { DEFAULT: '#31d583', dark: '#039754', light: '#f1fef6' },
        error:   { DEFAULT: '#e84831', dark: '#bd2c17', light: '#fcf4f3' },
        warning: { DEFAULT: '#e0a800', dark: '#a36a00', light: '#fffce5' },
      },
      borderRadius: {
        sm:  '4px',   // radius-50
        md:  '8px',   // radius-100
        lg:  '12px',  // radius-200
        xl:  '16px',  // radius-300
        '2xl': '24px', // radius-400
      },
      boxShadow: {
        card:   '0 0 2px 0 #1818181a, 0 1px 4px 0 #1818181a',
        popover:'0 0 2px 0 #1818181a, 0 1px 16px 0 #1818181a',
        modal:  '0 0 2px 0 #1818181a, 0 1px 100px 0 #1818181a',
      },
    },
  },
  plugins: [],
};
