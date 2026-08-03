export const Colors = {
  primary: '#4CAF50',
  primaryDark: '#388E3C',
  primaryLight: '#C8E6C9',
  secondary: '#FF9800',
  secondaryLight: '#FFE0B2',
  success: '#66BB6A',
  successLight: '#E8F5E9',
  warning: '#FFA726',
  warningLight: '#FFF3E0',
  error: '#EF5350',
  errorLight: '#FFEBEE',
  info: '#42A5F5',
  infoLight: '#E3F2FD',
  background: '#FFF8F0',
  surface: '#FFFFFF',
  text: {
    primary: '#2E2E2E',
    secondary: '#757575',
    light: '#9E9E9E',
    white: '#FFFFFF',
  },
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  overlay: 'rgba(0, 0, 0, 0.4)',
  shadow: 'rgba(0, 0, 0, 0.08)',

  child: {
    primary: '#66BB6A',
    primaryDark: '#43A047',
    primaryLight: '#C8E6C9',
    secondary: '#FFB74D',
    secondaryLight: '#FFE0B2',
    accent: '#BA68C8',
    accentLight: '#E1BEE7',
    play: '#42A5F5',
    playLight: '#BBDEFB',
    background: '#FFF8F0',
    card: '#FFFFFF',
    text: '#4A3728',
    textLight: '#8D7B6E',
    textInverse: '#FFFFFF',
    progressFill: '#66BB6A',
    progressTrack: '#E8F5E9',
    success: '#81C784',
    successBg: '#E8F5E9',
    hint: '#E3F2FD',
    hintText: '#1565C0',
    pause: '#FFF3E0',
    avatarBorder: '#FFB74D',
    danger: '#EF5350',
    dangerLight: '#FFEBEE',
    outline: '#A5D6A7',
  },

  world: {
    forest: '#E8F5E9',
    forestDark: '#66BB6A',
    ocean: '#E3F2FD',
    oceanDark: '#42A5F5',
    desert: '#FFF3E0',
    desertDark: '#FFA726',
    space: '#EDE7F6',
    spaceDark: '#7E57C2',
    garden: '#FBE9E7',
    gardenDark: '#FF7043',
    arctic: '#E1F5FE',
    arcticDark: '#29B6F6',
  },

  parent: {
    surface: '#FFFFFF',
    primary: '#5C6BC0',
    primaryLight: '#E8EAF6',
    accent: '#26A69A',
    accentLight: '#E0F2F1',
    warning: '#FFA726',
    warningLight: '#FFF3E0',
    text: '#37474F',
    textSecondary: '#78909C',
    border: '#ECEFF1',
  },
} as const;

const worldColorMap: Record<string, { bg: string; dark: string }> = {
  forest: { bg: Colors.world.forest, dark: Colors.world.forestDark },
  ocean: { bg: Colors.world.ocean, dark: Colors.world.oceanDark },
  desert: { bg: Colors.world.desert, dark: Colors.world.desertDark },
  space: { bg: Colors.world.space, dark: Colors.world.spaceDark },
  garden: { bg: Colors.world.garden, dark: Colors.world.gardenDark },
  arctic: { bg: Colors.world.arctic, dark: Colors.world.arcticDark },
};

export const getWorldColors = (worldId: string): { bg: string; dark: string } => {
  return worldColorMap[worldId] ?? { bg: Colors.child.primaryLight, dark: Colors.child.primary };
};

export const Typography = {
  header: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.child.text,
    letterSpacing: -0.5,
  },
  title1: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.child.text,
  },
  title2: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.child.text,
  },
  title3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.child.text,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.child.text,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.child.textLight,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.child.textLight,
  },
  childTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.child.text,
    letterSpacing: 0.5,
  },
  childBody: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: Colors.child.text,
    lineHeight: 28,
  },
  childButton: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  childButtonSmall: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  childLabel: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.child.text,
  },
  parentTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  parentBody: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  parentValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  parentSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.secondary,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 999,
  child: 20,
} as const;

export const Shadows = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  child: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  childButton: {
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 5,
  },
} as const;
