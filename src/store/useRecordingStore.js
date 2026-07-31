import { create } from 'zustand';
import { RECORDING_STATE } from '../constants/recordingStates';

/**
 * Recording Session Store.
 *
 * Manages utterances (segments) with rich metadata (timestamps, confidence,
 * edit flags), live extracted fields, duration timer, and session status.
 */

function generateSegmentId() {
  return `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const initialState = {
  sessionId: `sess_${Date.now().toString(36)}`,
  status: RECORDING_STATE.IDLE,
  segments: [],
  chunks: [], // Maintained for backward compatibility
  partialText: '',
  errorMessage: '',
  errorCode: null,
  durationSeconds: 0,
  liveExtractedFields: {},
};

const useRecordingStore = create(set => ({
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
    const newSegment = {
      id: generateSegmentId(),
      text: trimmed,
      originalText: trimmed,
      confidence,
      timestamp: Date.now(),
      edited: false,
    };
    set(state => {
      const nextSegments = [...state.segments, newSegment];
      return {
        segments: nextSegments,
        chunks: nextSegments.map(s => s.text),
        partialText: '',
      };
    });
  },

  // Backward compatible appendChunk
  appendChunk: text => {
    const trimmed = text?.trim();
    if (!trimmed) {
      return;
    }
    const newSegment = {
      id: generateSegmentId(),
      text: trimmed,
      originalText: trimmed,
      confidence: 1.0,
      timestamp: Date.now(),
      edited: false,
    };
    set(state => {
      const nextSegments = [...state.segments, newSegment];
      return {
        segments: nextSegments,
        chunks: nextSegments.map(s => s.text),
        partialText: '',
      };
    });
  },

  updateSegment: (id, newText) => {
    const trimmed = newText?.trim() ?? '';
    set(state => {
      const nextSegments = state.segments.map(seg => {
        if (seg.id === id) {
          return {
            ...seg,
            text: trimmed,
            edited: trimmed !== seg.originalText,
          };
        }
        return seg;
      });
      return {
        segments: nextSegments,
        chunks: nextSegments.map(s => s.text),
      };
    });
  },

  deleteSegment: id => {
    set(state => {
      const nextSegments = state.segments.filter(seg => seg.id !== id);
      return {
        segments: nextSegments,
        chunks: nextSegments.map(s => s.text),
      };
    });
  },

  updateLastSegment: newText => {
    const trimmed = newText?.trim() ?? '';
    set(state => {
      if (state.segments.length === 0) return state;
      const lastIndex = state.segments.length - 1;
      const nextSegments = state.segments.map((seg, idx) => {
        if (idx === lastIndex) {
          return {
            ...seg,
            text: trimmed,
            edited: trimmed !== seg.originalText,
          };
        }
        return seg;
      });
      return {
        segments: nextSegments,
        chunks: nextSegments.map(s => s.text),
      };
    });
  },

  setFullTranscript: fullText => {
    const trimmed = fullText?.trim() ?? '';
    const newSegment = {
      id: generateSegmentId(),
      text: trimmed,
      originalText: trimmed,
      confidence: 1.0,
      timestamp: Date.now(),
      edited: true,
    };
    set({
      segments: trimmed ? [newSegment] : [],
      chunks: trimmed ? [trimmed] : [],
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
    set({
      sessionId: sessionData.id || `sess_${Date.now().toString(36)}`,
      segments: sessionData.segments || [],
      chunks: (sessionData.segments || []).map(s => s.text),
      liveExtractedFields: sessionData.liveExtractedFields || {},
      durationSeconds: sessionData.durationSeconds || 0,
      status: RECORDING_STATE.IDLE,
    });
  },

  reset: () =>
    set({
      ...initialState,
      sessionId: `sess_${Date.now().toString(36)}`,
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
  state.segments.map(s => s.text).join(' ').trim() || state.chunks.join(' ').trim();

export default useRecordingStore;
