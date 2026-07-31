import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/**
 * Microphone icon drawn from plain Views, sized by a single `size` prop.
 *
 * The app ships no icon font — every glyph here is composed from Views, which
 * is why this exists: the mic appears in the dashboard hero, the round start
 * button and the quick actions, and three hand-rolled copies would drift.
 * `AnimatedMicButton` keeps its own larger, hand-tuned copy for the hero
 * animation; everything else should use this.
 */
const MicGlyph = ({ size = 24, color = colors.textPrimary }) => {
  const capsuleWidth = size * 0.36;
  const capsuleHeight = size * 0.56;
  const cupSize = size * 0.62;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: capsuleWidth,
          height: capsuleHeight,
          borderRadius: capsuleWidth / 2,
          backgroundColor: color,
        }}
      />
      {/* Open half-circle cradle: a full circle with its top half clipped by
          the wrapper's height, which is cheaper than a border-radius trick. */}
      <View
        style={[
          styles.cradleClip,
          {
            width: cupSize,
            height: cupSize / 2,
            marginTop: size * 0.06,
          },
        ]}
      >
        <View
          style={{
            width: cupSize,
            height: cupSize,
            borderRadius: cupSize / 2,
            borderWidth: Math.max(1.5, size * 0.07),
            borderColor: color,
            marginTop: -cupSize / 2,
          }}
        />
      </View>
      <View
        style={{
          width: Math.max(1.5, size * 0.07),
          height: size * 0.12,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.4,
          height: Math.max(1.5, size * 0.07),
          borderRadius: size * 0.04,
          backgroundColor: color,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cradleClip: {
    overflow: 'hidden',
  },
});

export default MicGlyph;