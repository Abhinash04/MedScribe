import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

const AppHeader = ({ title = 'MedScribe', showBack = false, onBackPress }) => {
  return (
    <View style={styles.headerRow}>
      {showBack ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          accessibilityLabel="Go back to home screen"
          accessibilityRole="button"
          accessibilityHint="Returns to home screen"
          activeOpacity={0.7}
        >
          <View style={styles.backArrowIcon}>
            <View style={styles.arrowStem} />
            <View style={styles.arrowHeadTop} />
            <View style={styles.arrowHeadBottom} />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.logoBadge}>
          <View style={styles.crossVertical} />
          <View style={styles.crossHorizontal} />
        </View>
      )}

      <Text style={typography.brandTitle}>{title}</Text>

      {/* Empty view for symmetry when back button is shown */}
      {showBack ? <View style={styles.placeholderRight} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    position: 'relative',
    height: 56,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  crossVertical: {
    position: 'absolute',
    width: 3,
    height: 14,
    backgroundColor: colors.primaryAccent,
    borderRadius: 1.5,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 14,
    height: 3,
    backgroundColor: colors.primaryAccent,
    borderRadius: 1.5,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrowIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  arrowStem: {
    position: 'absolute',
    width: 14,
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
    top: 7,
  },
  arrowHeadTop: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
    left: 0,
    top: 4,
    transform: [{ rotate: '-45deg' }],
  },
  arrowHeadBottom: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
    left: 0,
    top: 10,
    transform: [{ rotate: '45deg' }],
  },
  placeholderRight: {
    width: 40,
    height: 40,
  },
});

export default AppHeader;
