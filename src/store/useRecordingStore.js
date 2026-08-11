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
import {
  applyTranslation,
  editTranslation,
  emptyTranslation,
  markTranslationPending,
  needsTranslation,
  normalizeTranslation,
  setTranslationProgress,
} from '../services/consultationTranslation';

export const CONSULTATION_STAGE = {
  RECORDING: 'recording',
  REVIEW: 'review',
  REPORT: 'report',
};

export function generateSegmentId() {
  return `seg_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function generateSessionId() {
  return `sess_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

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
  chunks: [],
  partialText: '',
  errorMessage: '',
  errorCode: null,
  durationSeconds: 0,
  liveExtractedFields: {},
  reportDraft: null,
  stage: CONSULTATION_STAGE.RECORDING,
  createdAt: Date.now(),
  anuvadini: emptyAnuvadini(),
  transcriptSource: TRANSCRIPT_SOURCE.NATIVE,
  nativeRaw: '',
  refineProgress: { done: 0, total: 0 },
  captureUnavailable: false,
  language: null,
  recognizerFellBack: false,
  translation: emptyTranslation(),
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
      const nextSegments = [
        ...state.segments,
        makeSegment(trimmed, confidence),
      ];
      return {
        segments: nextSegments,
        chunks: chunksFrom(nextSegments),
        partialText: '',
      };
    });
  },

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
    set(state => ({
      anuvadini: applyResult(state.anuvadini, result, options),
    })),

  setRefineProgress: ({ done = 0, total = 0 } = {}) =>
    set({ refineProgress: { done, total } }),

  setCaptureUnavailable: captureUnavailable =>
    set({ captureUnavailable: !!captureUnavailable }),

  setSessionLanguage: language => set({ language: language ?? null }),

  setRecognizerFellBack: recognizerFellBack =>
    set({ recognizerFellBack: !!recognizerFellBack }),

  setTranslationPending: ({ sourceText, sourceKind } = {}) =>
    set(state => ({
      translation: markTranslationPending(state.translation, {
        sourceText,
        sourceKind,
      }),
    })),

  setTranslationResult: (result, options) =>
    set(state => ({
      translation: applyTranslation(state.translation, result, options),
    })),

  setTranslationText: text =>
    set(state => ({ translation: editTranslation(state.translation, text) })),

  setTranslationProgress: progress =>
    set(state => ({
      translation: setTranslationProgress(state.translation, progress),
    })),

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
      transcriptSource:
        sessionData.transcriptSource || TRANSCRIPT_SOURCE.NATIVE,
      nativeRaw: sessionData.nativeRaw || '',
      language: sessionData.language || null,
      recognizerFellBack: false,
      translation: normalizeTranslation(sessionData.translation),
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
      refineProgress: { done: 0, total: 0 },
      captureUnavailable: false,
      language: null,
      recognizerFellBack: false,
      translation: emptyTranslation(),
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

export const selectSourceTranscript = selectActiveTranscript;

export const selectEnglishTranscript = state =>
  needsTranslation(state.language)
    ? state.translation?.text || ''
    : selectActiveTranscript(state);

export const selectReportTranscript = state =>
  selectEnglishTranscript(state) || selectActiveTranscript(state);

export default useRecordingStore;
