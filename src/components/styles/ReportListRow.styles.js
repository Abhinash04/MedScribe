import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

export const styles = StyleSheet.create({
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    padding: spacing.md,
    paddingRight: 12,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reportBody: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reportMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDraft: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  statusFinal: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextDraft: {
    color: colors.warningText,
  },
  statusTextFinal: {
    color: colors.successText,
  },
});

export default styles;
