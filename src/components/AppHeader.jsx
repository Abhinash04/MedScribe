import { Text, TouchableOpacity, View } from 'react-native';
import IPCLogo from './IPCLogo';
import { typography } from '../theme';
import styles from './styles/AppHeader.styles';

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

export default AppHeader;
