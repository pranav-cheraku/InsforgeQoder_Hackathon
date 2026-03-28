// Design tokens mirroring demo/src/index.css CSS variables

export const colors = {
  // Base
  background: '#F8F8F8',    // hsl(0 0% 97.6%)
  foreground: '#111111',    // hsl(0 0% 6.7%)

  // Card
  card: '#FFFFFF',
  cardForeground: '#111111',

  // Primary (brand red)
  primary: '#D0253A',       // hsl(351 82% 50%)
  primaryForeground: '#FFFFFF',

  // Muted
  muted: '#EBEBEB',         // hsl(0 0% 92%)
  mutedForeground: '#6B7280', // hsl(220 9% 46%)

  // Border / Input
  border: '#EBEBEB',        // hsl(0 0% 92.2%)
  input: '#EBEBEB',

  // Semantic
  dealGreen: '#0EB87F',     // hsl(160 84% 39%)
  dotGreen: '#16A97B',      // hsl(160 72% 40%)
  dotGray: '#D4D4D4',       // hsl(0 0% 83%)
  bgAlert: '#FEF2F2',       // hsl(0 86% 97%)
};

export const radius = {
  card: 16,
  thumb: 10,
  pill: 999,
  sm: 8,
  md: 12,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const fonts = {
  brand: 'Syne_700Bold',
  sansBold: 'DMSans_700Bold',
  sansSemiBold: 'DMSans_600SemiBold',
  sansRegular: 'DMSans_400Regular',
  mono: 'DMMono_400Regular',
  monoBold: 'DMMono_500Medium',
};
