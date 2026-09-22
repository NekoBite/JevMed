/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:      { DEFAULT: '#0F1E2E', soft: '#3A4C5E', faint: '#5C6F81' },
        primary:  { DEFAULT: '#14456E', dark: '#0E3354', light: '#E7EEF5', mid: '#2E6EA6' },
        seal:     { DEFAULT: '#6E4700', light: '#FBF3E2' },
        canvas:   '#F3F6F9',
        surface:  '#FFFFFF',
        line:     { DEFAULT: '#C4D0DB', strong: '#93A5B5' },
        ok:       { DEFAULT: '#14573C', light: '#E4F1EA' },
        warn:     { DEFAULT: '#7A4E00', light: '#FCF0DC' },
        danger:   { DEFAULT: '#8E1B1B', light: '#FBE7E7' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans TC', 'Noto Sans SC',
               'PingFang TC', 'PingFang SC', 'Microsoft JhengHei', 'Microsoft YaHei',
               'Hiragino Sans GB', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'Noto Serif TC', 'Noto Serif SC',
                'Songti TC', 'Songti SC', 'SimSun', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Deliberately one step larger than a typical app — primary users are 60+
        xs:   ['0.8125rem', { lineHeight: '1.5' }],
        sm:   ['0.9375rem', { lineHeight: '1.6' }],
        base: ['1.0625rem', { lineHeight: '1.7' }],
        lg:   ['1.1875rem', { lineHeight: '1.65' }],
        xl:   ['1.375rem',  { lineHeight: '1.5' }],
        '2xl':['1.625rem',  { lineHeight: '1.4' }],
        '3xl':['2rem',      { lineHeight: '1.3' }],
        '4xl':['2.5rem',    { lineHeight: '1.2' }],
      },
      borderRadius: { DEFAULT: '4px', md: '6px', lg: '8px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,30,46,.06), 0 2px 8px rgba(15,30,46,.06)',
        lift: '0 4px 14px rgba(15,30,46,.12)',
      },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
}
