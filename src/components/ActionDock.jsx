import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { colors, spacing } from '../theme';
import styles, { DOCK_HEIGHT } from './styles/ActionDock.styles';

const bottomOffset = inset => Math.max(inset, spacing.sm);

/**
 * Space a scrolling screen must leave below its content so the last row clears
 * the dock.
 */
export function useActionDockClearance() {
  const insets = useSafeAreaInsets();
  return DOCK_HEIGHT + bottomOffset(insets.bottom) + spacing.lg;
}

const glyphColor = item => {
  if (item.emphasis) {
    return colors.onPrimary;
  }
  if (item.done) {
    return colors.successText;
  }
  return colors.textSecondary;
};

const DockItem = ({ item }) => (
  <Pressable
    style={({ pressed }) => [
      styles.item,
      item.disabled && styles.itemDisabled,
      pressed && !item.disabled && styles.itemPressed,
    ]}
    onPress={item.onPress}
    disabled={item.disabled}
    accessibilityRole="button"
    accessibilityLabel={item.accessibilityLabel ?? item.label}
    accessibilityState={{ disabled: !!item.disabled }}
  >
    <View
      style={[
        styles.tile,
        item.done && styles.tileDone,
        item.emphasis && styles.tileEmphasis,
      ]}
    >
      {item.busy ? (
        <ActivityIndicator size="small" color={glyphColor(item)} />
      ) : (
        <Icon name={item.icon} size={20} color={glyphColor(item)} />
      )}
    </View>
    <Text
      style={[
        styles.label,
        item.done && styles.labelDone,
        item.emphasis && styles.labelEmphasis,
      ]}
      numberOfLines={1}
    >
      {item.label}
    </Text>
  </Pressable>
);

/**
 * A floating dock of actions for a focused workflow screen — the counterpart to
 * BottomDock, which carries destinations. Items are supplied by the screen, so
 * this component holds no knowledge of what the actions do.
 *
 * It steps aside while the keyboard is up: on a form screen the dock would
 * otherwise sit on top of the keyboard and cost a row of editing space.
 */
const ActionDock = ({ items = [], emphasis = null }) => {
  const insets = useSafeAreaInsets();
  const [keyboardUp, setKeyboardUp] = useState(false);
  const shift = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardUp(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardUp(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(shift, {
      toValue: keyboardUp ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [keyboardUp, shift]);

  if (!items.length) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset(insets.bottom),
          opacity: shift,
          transform: [
            {
              translateY: shift.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents={keyboardUp ? 'none' : 'box-none'}
    >
      <View style={styles.card}>
        {items.map(item => (
          <DockItem
            key={item.key}
            item={{ ...item, emphasis: emphasis === item.key && !item.disabled }}
          />
        ))}
      </View>
    </Animated.View>
  );
};

export default ActionDock;
