import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Responsive breakpoints: tablet and desktop only (no mobile)
      screens: {
        tablet: '768px',
        desktop: '1024px',
      },
    },
  },
  plugins: [typography],
};
