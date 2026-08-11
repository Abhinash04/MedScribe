import { Text, View } from 'react-native';
import styles from './styles/LiveFieldsPreview.styles';

const PREVIEW_FIELDS = [
  ['patientName', 'Patient'],
  ['age', 'Age'],
  ['gender', 'Gender'],
  ['symptoms', 'Symptoms'],
  ['diagnosis', 'Diagnosis'],
];

const LiveFieldsPreview = ({ fields = {}, style, deferred = false }) => {
  if (deferred) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.headerLabel}>LIVE EXTRACTED DETAILS</Text>
        <Text style={styles.deferredNote}>
          Details are extracted once this dictation has been translated to
          English.
        </Text>
      </View>
    );
  }

  const entries = PREVIEW_FIELDS.map(([key, label]) => [
    key,
    label,
    fields?.[key],
  ]).filter(([, , val]) => {
    if (!val || !val.value) return false;
    if (Array.isArray(val.value)) return val.value.length > 0;
    return String(val.value).trim().length > 0;
  });

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.headerLabel}>LIVE EXTRACTED DETAILS</Text>
      <View style={styles.pillsRow}>
        {entries.map(([key, label, item]) => {
          const displayVal = Array.isArray(item.value)
            ? item.value.join(', ')
            : String(item.value);
          return (
            <View key={key} style={styles.pill}>
              <Text style={styles.pillLabel}>{label}:</Text>
              <Text style={styles.pillValue} numberOfLines={1}>
                {displayVal}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default LiveFieldsPreview;
