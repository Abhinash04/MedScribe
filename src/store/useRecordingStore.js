import { create } from 'zustand';
import { RECORDING_STATE } from '../constants/recordingStates';

/**
 * Recording session state.
 *
 * Lives outside the screen so Phase 3 (FR-5 information extraction and
 * FR-6 structured report generation) can read the finished transcript
 * without prop drilling or re-running recognition.
 *
 * The transcript is stored as chunks rather than one string because the
 * recognizer is single-utterance: each restart of the auto-restart loop
 * contributes one more chunk.
 */
/**
 * Note: microphone amplitude is deliberately NOT stored here. It arrives
 * 10-20x/second and would re-render every subscriber at that rate. It lives
 * in a Reanimated shared value in `speechService` instead.
 */
const initialState = {
  status: RECORDING_STATE.IDLE,
  chunks: [],
  partialText: '',
  errorMessage: '',
  errorCode: null,
};

const useRecordingStore = create(set => ({
  ...initialState,

  setStatus: status => set({ status }),

  appendChunk: text => {
    const trimmed = text?.trim();
    if (!trimmed) {
      return;
    }
    set(state => ({
      chunks: [...state.chunks, trimmed],
      partialText: '',
    }));
  },

  setPartial: partialText => set({ partialText: partialText ?? '' }),

  setError: (errorMessage, errorCode = null) =>
    set({
      status: RECORDING_STATE.ERROR,
      errorMessage,
      errorCode,
      partialText: '',
    }),

  reset: () => set({ ...initialState, chunks: [] }),
}));

/**
 * Joined transcript for display (FR-4) and for Phase 3 field extraction (FR-5).
 */
export const selectFullTranscript = state => state.chunks.join(' ').trim();

export default useRecordingStore;
