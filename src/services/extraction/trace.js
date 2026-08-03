/**
 * Opt-in visibility into the pipeline, for telling an extraction failure apart
 * from a transcription failure on a real device.
 *
 * Disabled by default and free of side effects when disabled: `emit` returns
 * before building anything, so a normal extraction run pays only a boolean
 * check. Nothing here logs.
 */

let sink = null;

export function setTraceSink(fn) {
  sink = typeof fn === 'function' ? fn : null;
}

export function isTracing() {
  return sink !== null;
}

export function emit(stage, build) {
  if (!sink) {
    return;
  }
  sink(stage, typeof build === 'function' ? build() : build);
}
