/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        sub: 'var(--sub)',
        line: 'var(--line)',
        accent: 'var(--accent)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        ctl: 'var(--radius-ctl)',
        card: 'var(--radius-card)',
      },
    },
  },
  plugins: [],
};
