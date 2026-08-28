/** @type {import('tailwindcss').Config} */
// 主题色经 CSS 变量按 data-style/data-mode 切换；用 RGB 三通道变量 + <alpha-value>
// 以支持透明度修饰符（bg-ink/45、bg-accent/85 等），hex 变量仅供 CSS 直接引用
const themeColor = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: themeColor('--bg-rgb'),
        surface: themeColor('--surface-rgb'),
        ink: themeColor('--ink-rgb'),
        sub: themeColor('--sub-rgb'),
        line: themeColor('--line-rgb'),
        accent: themeColor('--accent-rgb'),
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
