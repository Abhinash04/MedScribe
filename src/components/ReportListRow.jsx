import { Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { REPORT_STATUS } from '../db/reportsRepository';
import { colors } from '../theme';
import { formatRelativeDateTime } from '../utils/datetime';
import styles from './styles/ReportListRow.styles';

const AVATAR_TINTS = [
  { fill: colors.accentSoft, text: colors.secondaryAccent },
  { fill: colors.violetSoft, text: colors.violet },
  { fill: colors.warningSoft, text: colors.warningText },
  { fill: colors.successSoft, text: colors.successText },
];

export function initialsOf(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '??';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function tintFor(id) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum += id.charCodeAt(index);
  }
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

const ReportListRow = ({ report, onOpen, onDelete }) => {
  const isFinal = report.status === REPORT_STATUS.FINAL;
  const tint = tintFor(report.id);

  return (
    <Pressable
      style={({ pressed }) => [styles.reportRow, pressed && styles.pressed]}
      onPress={() => onOpen(report.id)}
      onLongPress={onDelete ? () => onDelete(report) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Open report for ${
        report.patientName || 'unnamed patient'
      }`}
      accessibilityHint={onDelete ? 'Long press to delete' : undefined}
    >
      <View style={[styles.avatar, { backgroundColor: tint.fill }]}>
        <Text style={[styles.avatarText, { color: tint.text }]}>
          {initialsOf(report.patientName)}
        </Text>
      </View>

      <View style={styles.reportBody}>
        <Text style={styles.patientName} numberOfLines={1}>
          {report.patientName || 'Unnamed patient'}
        </Text>
        <Text style={styles.reportMeta} numberOfLines={1}>
          {formatRelativeDateTime(report.createdAt)}
          {report.diagnosis ? ` · ${report.diagnosis}` : ''}
        </Text>
      </View>

      <View
        style={[
          styles.statusPill,
          isFinal ? styles.statusFinal : styles.statusDraft,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isFinal ? styles.statusTextFinal : styles.statusTextDraft,
          ]}
        >
          {isFinal ? 'FINAL' : 'DRAFT'}
        </Text>
      </View>

      <Icon name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
};

export default ReportListRow;
