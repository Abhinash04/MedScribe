import { Text, View } from 'react-native';
import { typography } from '../theme';
import styles from './styles/SectionTitle.styles';

const SectionTitle = ({ title, subtitle, style }) => {
  return (
    <View style={[styles.container, style]}>
      {title ? <Text style={[typography.largeHeading, styles.centerText]}>{title}</Text> : null}
      {subtitle ? (
        <Text style={[typography.mediumSubtitle, styles.subtitle, styles.centerText]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

export default SectionTitle;
