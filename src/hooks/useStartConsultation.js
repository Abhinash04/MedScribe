import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import { purgeAbandoned } from '../services/consultationAudio';
import {
  clearActiveSession,
  getActiveSession,
} from '../services/sessionPersistenceService';
import { clearRefinementState } from '../services/transcriptRefinement';
import useRecordingStore, {
  CONSULTATION_STAGE,
} from '../store/useRecordingStore';

const SCREEN_FOR_STAGE = {
  [CONSULTATION_STAGE.REPORT]: ['Report'],
  [CONSULTATION_STAGE.REVIEW]: ['TranscriptReview'],
};

export default function useStartConsultation() {
  const navigation = useNavigation();
  const resetRecording = useRecordingStore(state => state.reset);
  const restoreSession = useRecordingStore(state => state.restoreSession);

  const startFresh = useCallback(
    async session => {
      if (session?.id) {
        await clearActiveSession(session.id);
        await purgeAbandoned(0);
      }
      resetRecording();
      clearRefinementState();
      navigation.navigate('Recording');
    },
    [navigation, resetRecording],
  );

  const resume = useCallback(
    session => {
      restoreSession(session);
      const [screen] = SCREEN_FOR_STAGE[session.stage] ?? [];
      if (screen) {
        navigation.navigate(screen);
        return;
      }
      navigation.navigate('Recording', { resume: true });
    },
    [navigation, restoreSession],
  );

  return useCallback(async () => {
    const active = await getActiveSession();
    if (!active?.segments?.length) {
      await startFresh(active);
      return;
    }

    Alert.alert(
      'Consultation in progress',
      'A dictation from this session has not been finished yet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start new',
          style: 'destructive',
          onPress: () => {
            startFresh(active);
          },
        },
        { text: 'Resume', onPress: () => resume(active) },
      ],
    );
  }, [startFresh, resume]);
}
