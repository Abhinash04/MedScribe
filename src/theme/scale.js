export const BASE_WIDTH = 390;

export const scaleFor = width => size =>
  Math.round(((width || BASE_WIDTH) / BASE_WIDTH) * size);

export default scaleFor;
