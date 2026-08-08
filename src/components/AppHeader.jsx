import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import IPCLogo from './IPCLogo';
import { colors, spacing, typography } from '../theme';

const AppHeader = ({
  title = 'MedScribe',
  showBack = false,
  onBackPress,
  onLongPressTitle,
}) => {
  return (
    <View style={styles.headerRow}>
      {showBack ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          accessibilityHint="Returns to the previous screen"
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
          <IPCLogo size={24} />
        </View>
      )}

      <TouchableOpacity
        activeOpacity={1}
        onLongPress={onLongPressTitle}
        disabled={!onLongPressTitle}
      >
        <Text style={typography.brandTitle}>{title}</Text>
      </TouchableOpacity>
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
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    shadowColor: colors.primaryAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
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
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
  },
});

export default AppHeader;
