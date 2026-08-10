import { StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import styles from './styles/ScreenContainer.styles';

const ScreenContainer = ({ children, style }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.md,
          paddingLeft: insets.left + spacing.lg,
          paddingRight: insets.right + spacing.lg,
        },
        style,
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.primaryBackground}
        translucent
      />
      {children}
    </View>
  );
};

export default ScreenContainer;
