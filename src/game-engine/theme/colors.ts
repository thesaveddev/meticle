export const Colors = {
  primary: '#FF6B6B',
  primaryLight: '#FF8E8E',
  primaryDark: '#E05555',
  secondary: '#4ECDC4',
  secondaryLight: '#7EDDD6',
  secondaryDark: '#3DBDB5',
  accent: '#FFE66D',
  accentLight: '#FFF1A0',
  accentDark: '#F5D442',

  success: '#2ECC71',
  successLight: '#58D68D',
  successDark: '#27AE60',

  error: '#FF6B6B',
  errorLight: '#FF8E8E',
  errorDark: '#E74C3C',

  warning: '#F39C12',
  warningLight: '#F5B041',
  warningDark: '#D68910',

  info: '#74B9FF',
  infoLight: '#A0D2FF',
  infoDark: '#4A90D9',

  background: '#FFF5E6',
  backgroundSecondary: '#FFFBF5',
  surface: '#FFFFFF',
  surfaceSecondary: '#FFF9F0',

  card: '#FFFFFF',
  cardBorder: '#F0E6D5',

  text: '#2D3436',
  textSecondary: '#636E72',
  textLight: '#B2BEC3',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#FFFFFF',

  border: '#DFE6E9',
  borderLight: '#E8EDF0',
  borderDashed: '#A0AEC0',

  shadow: 'rgba(0, 0, 0, 0.12)',
  shadowLight: 'rgba(0, 0, 0, 0.06)',
  shadowDrag: 'rgba(0, 0, 0, 0.22)',

  overlay: 'rgba(0, 0, 0, 0.4)',

  disabled: '#B2BEC3',
  disabledBackground: '#F0F0F0',

  grey100: '#F8F9FA',
  grey200: '#E9ECEF',
  grey300: '#DEE2E6',
  grey400: '#CED4DA',
  grey500: '#ADB5BD',

  progressComplete: '#2ECC71',
  progressCurrent: '#FFE66D',
  progressUpcoming: '#DFE6E9',
  progressCompleteBorder: '#27AE60',
  progressCurrentBorder: '#F5D442',
  progressUpcomingBorder: '#B2BEC3',

  flipCardFront: '#F8F9FA',
  flipCardPattern: '#4ECDC4',
  flipCardBack: '#FFFFFF',

  dropZoneInactive: '#F8F9FA',
  dropZoneActive: '#E8F8F5',
  dropZoneBorder: '#DFE6E9',
  dropZoneBorderActive: '#4ECDC4',

  audioButton: '#4ECDC4',
  audioButtonPulse: '#7EDDD6',
  audioButtonDisabled: '#B2BEC3',

  celebrationGreen: '#2ECC71',
  gentleRed: '#FF8E8E',
} as const;

export type ColorKey = keyof typeof Colors;
