export const tokens = {
  version: '2.0.0',
  themes: {
    dark: {
  bg: '#121411',
  surface: '#1B1E19',
  elevated: '#252A21',
  line: '#41463C',
  fg: '#F6F7F2',
  muted: '#B0B6A8',
  accent: '#D5F955',
  onAccent: '#121411',
  protein: '#D5F955',
  carb: '#9BBDF8',
  fat: '#F2BC78',
  fiber: '#84CFC1',
  warning: '#F2BC78',
  danger: '#F4A8A2',
  focus: '#D5F955'
},
    light: {
  bg: '#EEEFE8',
  surface: '#FFFFFF',
  elevated: '#E5E8DE',
  line: '#BFC5B6',
  fg: '#171A15',
  muted: '#555F50',
  accent: '#416119',
  onAccent: '#FFFFFF',
  protein: '#416119',
  carb: '#285AA2',
  fat: '#895B13',
  fiber: '#176A62',
  warning: '#895B13',
  danger: '#A33838',
  focus: '#416119'
}
  },
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  radii: { control: 12, card: 18, pill: 999 },
  breakpoints: { tablet: 768, desktop: 1200 },
  touchMin: 44,
  fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, Arial, sans-serif',
  fontSizes: { caption: 12, small: 14, body: 16, heading: 20, title: 30, metric: 34 },
  motionMs: { fast: 120, normal: 200 },
  contentMax: 1600
} as const;

export type ThemeName = keyof typeof tokens.themes;
export type SemanticTheme = typeof tokens.themes.dark;
