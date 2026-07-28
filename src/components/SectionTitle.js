import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme';

const SectionTitle = ({ title, subtitle, style }) => {
  return (
    <View style={[styles.container, style]}>
      {title ? <Text style={typography.largeHeading}>{title}</Text> : null}
      {subtitle ? (
        <Text style={[typography.mediumSubtitle, styles.subtitle]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginVertical: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.sm,
    maxWidth: 320,
  },
});

export default SectionTitle;
