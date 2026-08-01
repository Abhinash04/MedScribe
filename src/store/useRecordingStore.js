import { create } from 'zustand';
import { RECORDING_STATE } from '../constants/recordingStates';

/**
 * Recording Session Store.
 *
 * Manages utterances (segments) with rich metadata (timestamps, confidence,
 * edit flags), live extracted fields, duration timer, and session status.
 */

export function generateSegmentId() {
  return `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Session ids carry a random suffix for the same reason segment ids do: two
 * sessions started inside the same millisecond would otherwise collide, and the
 * id is the primary key of the autosave row.
 */
export function generateSessionId() {
  return `sess_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/** Legacy mirror of the segment texts, kept for readers that predate segments. */
function chunksFrom(segments) {
  return segments.map(segment => segment.text);
}

function makeSegment(text, confidence = 1.0) {
  return {
    id: generateSegmentId(),
    text,
    originalText: text,
    confidence,
    timestamp: Date.now(),
    edited: false,
  };
}

const initialState = {
  sessionId: generateSessionId(),
  status: RECORDING_STATE.IDLE,
  segments: [],
  chunks: [], // Maintained for backward compatibility
  partialText: '',
  errorMessage: '',
  errorCode: null,
  durationSeconds: 0,
  liveExtractedFields: {},
};

const useRecordingStore = create((set, get) => ({
  ...initialState,

  setStatus: status => set({ status }),

  setDurationSeconds: durationSeconds => set({ durationSeconds }),

  incrementDuration: () =>
    set(state => ({ durationSeconds: state.durationSeconds + 1 })),

  appendSegment: ({ text, confidence = 1.0 }) => {
    const trimmed = text?.trim();
    if (!trimmed) {
      return;
    }
    set(state => {
      const nextSegments = [...state.segments, makeSegment(trimmed, confidence)];
      return {
        segments: nextSegments,
        chunks: chunksFrom(nextSegments),
        partialText: '',
      };
    });
  },

  /** Backward-compatible alias. One append path, so the two cannot drift. */
  appendChunk: text => get().appendSegment({ text }),

  updateSegment: (id, newText) => {
    const trimmed = newText?.trim() ?? '';
    set(state => {
      const nextSegments = state.segments.map(seg =>
        seg.id === id
          ? { ...seg, text: trimmed, edited: trimmed !== seg.originalText }
          : seg,
      );
      return {
        segments: nextSegments,
        chunks: chunksFrom(nextSegments),
      };
    });
  },

  deleteSegment: id => {
    set(state => {
      const nextSegments = state.segments.filter(seg => seg.id !== id);
      return {
        segments: nextSegments,
        chunks: chunksFrom(nextSegments),
      };
    });
  },

  /**
   * Replaces the whole transcript with the doctor's edited text.
   *
   * This collapses the utterance breakdown into one segment, which is why it
   * returns early when the text is unchanged: saving the review screen without
   * editing anything must not destroy per-utterance boundaries and their
   * timestamps and confidences.
   */
  setFullTranscript: fullText => {
    const trimmed = fullText?.trim() ?? '';
    set(state => {
      const current = chunksFrom(state.segments).join(' ').trim();
      if (trimmed === current) {
        return state;
      }
      if (!trimmed) {
        return { segments: [], chunks: [] };
      }
      const replacement = { ...makeSegment(trimmed), edited: true };
      return { segments: [replacement], chunks: [trimmed] };
    });
  },

  setLiveExtractedFields: liveExtractedFields => set({ liveExtractedFields }),

  setPartial: partialText => set({ partialText: partialText ?? '' }),

  setError: (errorMessage, errorCode = null) =>
    set({
      status: RECORDING_STATE.ERROR,
      errorMessage,
      errorCode,
      partialText: '',
    }),

  restoreSession: sessionData => {
    if (!sessionData) return;
    const restored = sessionData.segments || [];
    set({
      sessionId: sessionData.id || generateSessionId(),
      segments: restored,
      chunks: chunksFrom(restored),
      liveExtractedFields: sessionData.liveExtractedFields || {},
      durationSeconds: sessionData.durationSeconds || 0,
      status: RECORDING_STATE.IDLE,
    });
  },

  reset: () =>
    set({
      ...initialState,
      sessionId: generateSessionId(),
      segments: [],
      chunks: [],
      durationSeconds: 0,
      liveExtractedFields: {},
    }),
}));

/**
 * Joined transcript selector for display and report extraction.
 */
export const selectFullTranscript = state =>
  chunksFrom(state.segments).join(' ').trim() || state.chunks.join(' ').trim();

export default useRecordingStore;
