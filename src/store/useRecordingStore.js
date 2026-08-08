import { create } from 'zustand';
import { RECORDING_STATE } from '../constants/recordingStates';
import {
  activeText,
  applyResult,
  emptyAnuvadini,
  markPending,
  normalizeAnuvadini,
  switchSource,
  TRANSCRIPT_SOURCE,
} from '../services/consultationTranscripts';

export const CONSULTATION_STAGE = {
  RECORDING: 'recording',
  REVIEW: 'review',
  REPORT: 'report',
};

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
  // The editable report draft, held here so it survives an "Add More Speech"
  // round trip through the recording screen. Manual edits would otherwise be
  // lost when the report screen remounts and re-extracts.
  reportDraft: null,
  // Where the consultation had got to, so an interrupted one reopens on the
  // screen the doctor was actually on.
  stage: CONSULTATION_STAGE.RECORDING,
  createdAt: Date.now(),
  // The alternative transcript. `segments` remain the native one — duplicating
  // that text here would give the same transcript two owners.
  anuvadini: emptyAnuvadini(),
  transcriptSource: TRANSCRIPT_SOURCE.NATIVE,
  // The recognizer's own words, frozen when dictation ends. Segments stay
  // editable; this is the baseline the "what AI changed" comparison uses, so a
  // doctor's edit cannot rewrite history.
  nativeRaw: '',
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

  setReportDraft: reportDraft => set({ reportDraft }),

  setStage: stage => set({ stage }),

  setNativeRaw: nativeRaw => set({ nativeRaw }),

  setAnuvadiniPending: () =>
    set(state => ({ anuvadini: markPending(state.anuvadini) })),

  setAnuvadiniResult: (result, options) =>
    set(state => ({ anuvadini: applyResult(state.anuvadini, result, options) })),

  setAnuvadiniText: text =>
    set(state => ({ anuvadini: { ...state.anuvadini, text: text ?? '' } })),

  setTranscriptSource: source =>
    set(state => ({
      transcriptSource: switchSource(
        {
          nativeText: chunksFrom(state.segments).join(' ').trim(),
          anuvadini: state.anuvadini,
          source: state.transcriptSource,
        },
        source,
      ),
    })),

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
      reportDraft: sessionData.draft || null,
      stage: sessionData.stage || CONSULTATION_STAGE.RECORDING,
      createdAt: sessionData.createdAt || Date.now(),
      anuvadini: normalizeAnuvadini(sessionData.anuvadiniTranscript),
      transcriptSource: sessionData.transcriptSource || TRANSCRIPT_SOURCE.NATIVE,
      nativeRaw: sessionData.nativeRaw || '',
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
      reportDraft: null,
      stage: CONSULTATION_STAGE.RECORDING,
      createdAt: Date.now(),
      anuvadini: emptyAnuvadini(),
      transcriptSource: TRANSCRIPT_SOURCE.NATIVE,
      nativeRaw: '',
    }),
}));

export const selectFullTranscript = state =>
  chunksFrom(state.segments).join(' ').trim() || state.chunks.join(' ').trim();

export const selectActiveTranscript = state =>
  activeText({
    nativeText: selectFullTranscript(state),
    anuvadini: state.anuvadini,
    source: state.transcriptSource,
  });

export default useRecordingStore;
