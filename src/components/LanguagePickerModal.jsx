import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { RECOGNIZER } from '../services/languageCapabilities';
import { colors } from '../theme';
import styles from './styles/LanguagePickerModal.styles';

const BADGE = {
  [RECOGNIZER.ON_DEVICE]: {
    label: 'ON DEVICE',
    pill: styles.badgeOnDevice,
    text: styles.badgeTextOnDevice,
  },
  [RECOGNIZER.CLOUD_ONLY]: {
    label: 'CLOUD ONLY',
    pill: styles.badgeCloudOnly,
    text: styles.badgeTextCloudOnly,
  },
  [RECOGNIZER.UNVERIFIED]: {
    label: 'UNVERIFIED',
    pill: styles.badgeUnverified,
    text: styles.badgeTextUnverified,
  },
};

const LanguageRow = ({ language, selected, onSelect }) => {
  const badge = BADGE[language.recognizer] ?? BADGE[RECOGNIZER.UNVERIFIED];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
      onPress={() => onSelect(language.code)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${language.englishName}, ${language.tag}`}
      accessibilityHint={
        language.recognizer === RECOGNIZER.CLOUD_ONLY
          ? 'This device may not recognise this language without a language pack'
          : undefined
      }
    >
      <View style={styles.rowBody}>
        <Text style={styles.nativeName}>{language.nativeName}</Text>
        <Text style={styles.englishName}>
          {language.englishName} · {language.tag}
        </Text>
      </View>

      <View style={[styles.badge, badge.pill]}>
        <Text style={[styles.badgeText, badge.text]}>{badge.label}</Text>
      </View>

      {selected ? (
        <Icon name="check" size={18} color={colors.primaryAccent} />
      ) : null}
    </Pressable>
  );
};

const LanguagePickerModal = ({
  visible,
  languages = [],
  selected,
  onSelect,
  onDismiss,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onDismiss}
  >
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Dictation Language</Text>
          <Text style={styles.message}>
            Dictate in the language you are most comfortable with. The patient
            report is always written in English.
          </Text>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {languages.map(language => (
            <LanguageRow
              key={language.code}
              language={language}
              selected={language.code === selected}
              onSelect={onSelect}
            />
          ))}
        </ScrollView>

        <Text style={styles.footnote}>
          Dictation in a language other than English is sent to a translation
          service to produce the English report.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.close, pressed && styles.rowPressed]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

export default LanguagePickerModal;
