import { Pressable, Text, TextInput, View } from 'react-native';
import { PATIENT_FIELDS } from '../constants/patientFields';
import styles from './styles/AdditionalNotes.styles';

const labelFor = key => PATIENT_FIELDS.find(field => field.key === key)?.label ?? null;
const AdditionalNotes = ({ notes = [], onKeep, onChangeText }) => {
  if (!notes.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Not captured in any field</Text>
      <Text style={styles.hint}>
        Dictated but matched no report field. Keep what belongs in the report.
      </Text>

      {notes.map((note, index) => {
        const suggestion = labelFor(note.suggestedField);
        return (
          <View
            key={note.id ?? index}
            style={[styles.note, note.kept && styles.noteKept]}
          >
            <View style={styles.noteHeader}>
              <Text style={[styles.suggestion, !suggestion && styles.suggestionMuted]}>
                {suggestion ? `Looks like ${suggestion}` : 'Unclassified'}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.keep,
                  note.kept ? styles.keepOn : styles.keepOff,
                  pressed && styles.keepPressed,
                ]}
                onPress={() => onKeep?.(index, !note.kept)}
                accessibilityRole="switch"
                accessibilityState={{ checked: !!note.kept }}
                accessibilityLabel={
                  note.kept
                    ? `In the report. Tap to leave out: ${note.text}`
                    : `Left out. Tap to keep in the report: ${note.text}`
                }
                hitSlop={8}
              >
                <Text style={[styles.keepText, note.kept ? styles.keepTextOn : styles.keepTextOff]}>
                  {note.kept ? '✓ Kept' : 'Keep'}
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.text}
              value={note.text}
              onChangeText={text => onChangeText?.(index, text)}
              multiline
              accessibilityLabel="Dictated note"
            />
          </View>
        );
      })}
    </View>
  );
};

export default AdditionalNotes;
