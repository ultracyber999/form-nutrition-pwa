export const tokens = {
  version: '1.0.0',
  themes: {
    dark: {
      bg: '#0D1211',
      surface: '#151C1A',
      elevated: '#1B2421',
      line: '#293630',
      fg: '#F0F5F2',
      muted: '#A0B0A7',
      accent: '#B9F284',
      onAccent: '#14200E',
      protein: '#B9F284',
      carb: '#91BAFA',
      fat: '#EFC27D',
      fiber: '#7ACDC2',
      warning: '#EFC27D',
      danger: '#F0A19A',
      focus: '#B9F284'
    },
    light: {
      bg: '#F4F7F4',
      surface: '#FFFFFF',
      elevated: '#EAF1EA',
      line: '#CBD6CE',
      fg: '#14211A',
      muted: '#4D6254',
      accent: '#376A24',
      onAccent: '#FFFFFF',
      protein: '#376A24',
      carb: '#285AA2',
      fat: '#895B13',
      fiber: '#176A62',
      warning: '#895B13',
      danger: '#A33838',
      focus: '#376A24'
    }
  },
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  radii: { control: 12, card: 18, pill: 999 },
  breakpoints: { tablet: 768, desktop: 1200 },
  touchMin: 44,
  fontFamily: 'system-ui, Arial, sans-serif',
  fontSizes: { caption: 12, small: 14, body: 16, heading: 20, title: 30, metric: 34 },
  motionMs: { fast: 120, normal: 200 },
  contentMax: 1600
} as const;

export type ThemeName = keyof typeof tokens.themes;
export type SemanticTheme = typeof tokens.themes.dark;
