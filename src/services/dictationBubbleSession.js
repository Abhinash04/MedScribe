let bubbleSessionActive = false;

export function isBubbleSessionActive() {
  return bubbleSessionActive;
}

export function setBubbleSessionActive(active) {
  bubbleSessionActive = active === true;
}
