import { StyleSheet } from 'react-native';
import { spacing } from '../../theme';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginVertical: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  centerText: {
    textAlign: 'center',
  },
});

export default styles;
