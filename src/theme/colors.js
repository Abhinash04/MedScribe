export const colors = {
  primaryBackground: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F8FAFF',
  surfaceSoft: '#F6F3FF',
  surfaceBorder: '#EAF0FF',
  border: '#EAF0FF',
  borderSoft: '#F0F5FF',
  borderStrong: '#CBD5E1',

  primaryAccent: '#2F6BFF',
  primaryHover: '#1D4ED8',
  primaryActive: '#1E40AF',
  primaryDisabled: '#93C5FD',
  primaryLight: '#EFF6FF',
  primarySoft: '#F0F5FF',

  secondaryAccent: '#7C4DFF',
  accentGlow: 'rgba(47, 107, 255, 0.15)',
  accentGlowActive: 'rgba(47, 107, 255, 0.3)',

  textPrimary: '#16213E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  onPrimary: '#FFFFFF',

  success: '#22C55E',
  successLight: '#DFF8EC',
  successSoft: '#DFF8EC',

  warning: '#F59E0B',
  warningLight: '#FFFBEB', // Soft Orange
  warningSoft: '#FFFBEB',

  /**
   * Text and glyphs on the soft warning/success fills.
   *
   * `warning` and `success` are tuned for borders and solid fills; on their own
   * soft backgrounds they measure 2.07 and 2.04 against WCAG, below even the
   * 3.0 large-text floor. These are the readable pair: 4.84 and 6.38, both
   * clearing AA for normal text — which matters most for the 10px status pills.
   *
   * `successText` is green-800 rather than green-700 because green-700 lands at
   * 4.48 on `successSoft`, just under the bar.
   */
  warningText: '#B45309',
  successText: '#166534',

  danger: '#DC2626',
  error: '#DC2626',
  errorLight: '#FEF2F2', // Soft Red
  errorSoft: '#FEF2F2',

  info: '#2F6BFF',
  infoLight: '#EAF0FF', // Pastel Blue

  accentSoft: 'rgba(47, 107, 255, 0.12)',
  onPrimarySoft: 'rgba(255, 255, 255, 0.18)',
  onPrimaryMuted: 'rgba(255, 255, 255, 0.88)',
  
  violet: '#7C4DFF',
  violetSoft: '#F6F3FF', // Lavender Surface
  lavender: '#7C4DFF',
  lavenderSoft: '#F6F3FF',
  
  overlay: 'rgba(22, 33, 62, 0.65)',
};

export default colors;
