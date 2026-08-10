import { Pressable, Text, TextInput, View } from 'react-native';
import { LOW_CONFIDENCE_THRESHOLD } from '../constants/fieldMarkers';
import { NOT_AVAILABLE } from '../constants/patientFields';
import { colors } from '../theme';
import styles from './styles/ReportField.styles';

const ReportField = ({
  label,
  entry,
  isList = false,
  multiline = false,
  required = false,
  keyboard,
  onChange,
}) => {
  const value = entry?.value;
  const editable = typeof onChange === 'function';
  const hasValue = isList ? value?.length > 0 : !!value;
  const needsAttention = required && !hasValue;
  const isUncertain =
    hasValue && !entry?.edited && entry?.confidence < LOW_CONFIDENCE_THRESHOLD;
  const isAuto = hasValue && !entry?.edited && !!entry?.auto;

  const items = isList && Array.isArray(value) ? value : [];

  const replaceItem = (index, text) =>
    onChange(items.map((item, position) => (position === index ? text : item)));

  const removeItem = index =>
    onChange(items.filter((_, position) => position !== index));

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isUncertain ? (
          <Text
            style={styles.uncertainBadge}
            accessibilityLabel={`Low confidence, inferred from "${entry.source}"`}
          >
            UNCERTAIN
          </Text>
        ) : null}
        {isAuto ? (
          <Text
            style={styles.uncertainBadge}
            accessibilityLabel="Classified from the dictation, not explicitly stated"
          >
            AUTO
          </Text>
        ) : null}
        {entry?.edited ? (
          <Text
            style={styles.editedBadge}
            accessibilityLabel="Edited by the doctor"
          >
            EDITED
          </Text>
        ) : null}
      </View>

      {isList ? (
        <View>
          {items.map((item, index) => (
            <View key={`item-${index}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              {editable ? (
                <>
                  <TextInput
                    style={[styles.value, styles.input, styles.bulletText]}
                    value={item}
                    onChangeText={text => replaceItem(index, text)}
                    placeholder={label}
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={`${label} item ${index + 1}`}
                  />
                  <Pressable
                    onPress={() => removeItem(index)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${label} item ${index + 1}`}
                  >
                    <Text style={styles.removeItem}>✕</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.value, styles.bulletText]}>{item}</Text>
              )}
            </View>
          ))}

          {items.length === 0 ? (
            <Text style={[styles.value, styles.missing]}>{NOT_AVAILABLE}</Text>
          ) : null}

          {editable ? (
            <Pressable
              onPress={() => onChange([...items, ''])}
              accessibilityRole="button"
              accessibilityLabel={`Add ${label} item`}
              style={styles.addRow}
            >
              <Text style={styles.addText}>+ Add item</Text>
            </Pressable>
          ) : null}
        </View>
      ) : editable ? (
        <TextInput
          style={[
            styles.value,
            styles.input,
            multiline && styles.multiline,
            needsAttention && styles.inputMissing,
          ]}
          value={value ?? ''}
          onChangeText={onChange}
          placeholder={NOT_AVAILABLE}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          keyboardType={keyboard}
          accessibilityLabel={label}
        />
      ) : hasValue ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        <Text style={[styles.value, styles.missing]}>{NOT_AVAILABLE}</Text>
      )}
    </View>
  );
};

export default ReportField;
