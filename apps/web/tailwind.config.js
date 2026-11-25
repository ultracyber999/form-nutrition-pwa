/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        elevated: 'var(--elevated)',
        line: 'var(--line)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        onAccent: 'var(--on-accent)',
        protein: 'var(--protein)',
        carb: 'var(--carb)',
        fat: 'var(--fat)',
        fiber: 'var(--fiber)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        focus: 'var(--focus)'
      },
      fontFamily: { sans: ['system-ui', 'Arial', 'sans-serif'] }
    }
  },
  plugins: []
};
