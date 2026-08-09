import { ERROR_KIND } from './proxyContract.js';

export function emptyProgress(path = null, plan = '') {
  return { path, plan, texts: [] };
}

export function planSignature(chunks) {
  return (chunks ?? []).map(chunk => `${chunk.start}-${chunk.end}`).join(',');
}

export function resumable(progress, path, chunks) {
  return progress?.path === path && progress?.plan === planSignature(chunks);
}

export async function uploadChunks({
  chunks,
  progress = emptyProgress(),
  readChunk,
  send,
  stillCurrent = () => true,
  onProgress = null,
}) {
  const texts = (progress.texts ?? []).slice();
  const total = chunks.length;
  const settled = () =>
    chunks.filter(chunk => typeof texts[chunk.index] === 'string').length;
  let last = null;

  onProgress?.({ done: settled(), total });

  for (const chunk of chunks) {
    if (typeof texts[chunk.index] === 'string') {
      continue;
    }

    const payload = await readChunk(chunk);
    if (!payload) {
      last = { ok: false, text: '', errorKind: ERROR_KIND.NO_AUDIO };
      break;
    }

    last = await send(payload, chunk);

    if (!stillCurrent()) {
      return { superseded: true, result: last, progress: { ...progress, texts } };
    }

    if (!last?.ok) {
      break;
    }
    texts[chunk.index] = last.text;
    onProgress?.({ done: settled(), total });
  }

  const carried = { ...progress, texts };
  const complete = chunks.every(chunk => typeof texts[chunk.index] === 'string');

  if (!complete) {
    return {
      superseded: false,
      progress: carried,
      result: last ?? { ok: false, text: '', errorKind: ERROR_KIND.NO_AUDIO },
    };
  }

  return {
    superseded: false,
    progress: carried,
    result: { ok: true, errorKind: null, text: joinChunks(chunks, texts) },
  };
}

export function joinChunks(chunks, texts) {
  return chunks
    .map(chunk => String(texts?.[chunk.index] ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
