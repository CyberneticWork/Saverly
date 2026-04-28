export const colors = {
  // Brand (Saverly)
  primary: '#1C9A76',        // Saverly teal
  primaryLight: '#39B58F',   // Light teal
  primaryMedium: '#2CA482',  // Medium teal
  primaryDark: '#14765A',    // Deep teal
  primaryFaded: '#E6F6F0',   // Faded teal

  // Secondary / Accent (Saverly Orange)
  secondary: '#FFA11A',      // Brand orange
  secondaryLight: '#FFC15C', // Light orange
  secondaryFaded: '#FFF4E5', // Faded orange

  // Neutrals
  background: '#F8FBFA',     // Off-white
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#CFE5DE',         // Soft teal border
  divider: '#EDF6F2',        // Very light teal

  // Text
  text: '#2F3136',           // Brand charcoal
  textSecondary: '#5F6772',  // Muted gray
  textLight: '#97A1AC',      // Light gray
  textInverse: '#FFFFFF',

  // Status
  success: '#1B8B7F',        // Saverly teal
  error: '#D32F2F',
  warning: '#FF9500',        // Saverly orange
  info: '#0288D1',

  // Price indicators
  cheapest: '#1B8B7F',       // Saverly teal
  cheapestBg: '#E0F5F2',
  expensive: '#C62828',
  expensiveBg: '#FFEBEE',
  sale: '#FF9500',           // Saverly orange
  saleBg: '#FFF5E6',

  // Misc
  overlay: 'rgba(28, 154, 118, 0.58)', // Teal overlay
  shadow: '#000',
  transparent: 'transparent',
  starColor: '#FFA11A',      // Orange stars

  // Aliases for common patterns
  saleBadge: '#FFA11A',      // Orange badge
  successBg: '#E6F6F0',      // Teal background
  errorBg: '#FFEBEE',
  warningBg: '#FFF4E5',      // Orange background
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  h4: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16, letterSpacing: 0.5 },
  button: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
};
