import { View } from 'react-native';
import { colors } from '../theme';
import styles from './styles/MicGlyph.styles';

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

export default MicGlyph;
