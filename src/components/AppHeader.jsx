import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import IPCLogo from './IPCLogo';
import { colors, typography } from '../theme';
import styles from './styles/AppHeader.styles';

const AppHeader = ({
  title = 'MedScribe',
  showBack = false,
  onBackPress,
  showHome = false,
  onHomePress,
  onLongPressTitle,
}) => {
  return (
    <View style={styles.headerRow}>
      {showHome ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onHomePress}
          accessibilityLabel="Go to dashboard"
          accessibilityRole="button"
          accessibilityHint="Returns to the dashboard"
          activeOpacity={0.7}
        >
          <Icon name="home" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : showBack ? (
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
        style={styles.titleContainer}
      >
        <Text style={typography.brandTitle}>{title}</Text>
      </TouchableOpacity>
      {showBack || showHome ? (
        <View style={styles.placeholderRight} />
      ) : null}
    </View>
  );
};

export default AppHeader;
