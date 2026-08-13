import { check, report } from './lib/fixture-harness.mjs';

const SPREAD_DEGREES = 55;
const FAN_OFFSETS = [-SPREAD_DEGREES, 0, SPREAD_DEGREES];
const DIRECTION_RIGHT = 1;
const DIRECTION_LEFT = -1;

const clampUnit = value => Math.min(1, Math.max(-1, value));
const toDegrees = value => (value * 180) / Math.PI;
const toRadians = value => (value * Math.PI) / 180;

function directionFor(anchorCentreX, screenWidth) {
  return anchorCentreX > screenWidth / 2 ? DIRECTION_LEFT : DIRECTION_RIGHT;
}

function verticalBiasDegrees(anchorCentreY, screenHeight, radius, clearance) {
  if (radius <= 0) {
    return 0;
  }
  const topRoom = (clearance - anchorCentreY) / radius;
  const bottomRoom = (screenHeight - clearance - anchorCentreY) / radius;
  const lower =
    topRoom <= -1
      ? -SPREAD_DEGREES
      : SPREAD_DEGREES + toDegrees(Math.asin(clampUnit(topRoom)));
  const upper =
    bottomRoom >= 1
      ? SPREAD_DEGREES
      : -SPREAD_DEGREES + toDegrees(Math.asin(clampUnit(bottomRoom)));
  const bias =
    lower > upper ? (lower + upper) / 2 : Math.min(upper, Math.max(lower, 0));
  return Math.min(SPREAD_DEGREES, Math.max(-SPREAD_DEGREES, bias));
}

function offsets(anchorCentreX, anchorCentreY, screenWidth, screenHeight, radius, clearance) {
  const direction = directionFor(anchorCentreX, screenWidth);
  const bias = verticalBiasDegrees(anchorCentreY, screenHeight, radius, clearance);
  const raw = FAN_OFFSETS.map(offset => {
    const angle = toRadians(bias + offset);
    return {
      x: Math.trunc(direction * radius * Math.cos(angle)),
      y: Math.trunc(radius * Math.sin(angle)),
    };
  });

  const half = Math.trunc(clearance / 2);
  const minX = Math.min(...raw.map(o => anchorCentreX + o.x - half));
  const maxX = Math.max(...raw.map(o => anchorCentreX + o.x + half));
  const minY = Math.min(...raw.map(o => anchorCentreY + o.y - half));
  const maxY = Math.max(...raw.map(o => anchorCentreY + o.y + half));

  let shiftX = 0;
  let shiftY = 0;
  if (minX < 0) {
    shiftX = -minX;
  } else if (maxX > screenWidth) {
    shiftX = screenWidth - maxX;
  }
  if (minY < 0) {
    shiftY = -minY;
  } else if (maxY > screenHeight) {
    shiftY = screenHeight - maxY;
  }

  return raw.map(o => ({ x: o.x + shiftX, y: o.y + shiftY }));
}

const SCREEN_W = 1080;
const SCREEN_H = 2400;
const RADIUS = 190;
const SATELLITE = 110;
const CLEARANCE = SATELLITE;
const HALF = SATELLITE / 2;

check(
  'G1.1 an anchor left of centre opens right',
  directionFor(100, SCREEN_W),
  DIRECTION_RIGHT,
);
check(
  'G1.2 an anchor right of centre opens left',
  directionFor(980, SCREEN_W),
  DIRECTION_LEFT,
);
check(
  'G1.3 dead centre opens right',
  directionFor(SCREEN_W / 2, SCREEN_W),
  DIRECTION_RIGHT,
);

const midBias = verticalBiasDegrees(SCREEN_H / 2, SCREEN_H, RADIUS, CLEARANCE);
check('G2.1 mid screen needs no vertical bias', midBias, 0);
check(
  'G2.2 near the top the fan is pushed down',
  verticalBiasDegrees(CLEARANCE, SCREEN_H, RADIUS, CLEARANCE) > 0,
  true,
);
check(
  'G2.3 near the bottom the fan is pushed up',
  verticalBiasDegrees(SCREEN_H - CLEARANCE, SCREEN_H, RADIUS, CLEARANCE) < 0,
  true,
);

const ANCHOR_POSITIONS = [
  ['top left', 60, 60],
  ['top centre', SCREEN_W / 2, 60],
  ['top right', SCREEN_W - 60, 60],
  ['left middle', 60, SCREEN_H / 2],
  ['centre', SCREEN_W / 2, SCREEN_H / 2],
  ['right middle', SCREEN_W - 60, SCREEN_H / 2],
  ['bottom left', 60, SCREEN_H - 60],
  ['bottom centre', SCREEN_W / 2, SCREEN_H - 60],
  ['bottom right', SCREEN_W - 60, SCREEN_H - 60],
];

let index = 1;
ANCHOR_POSITIONS.forEach(([label, cx, cy]) => {
  const fan = offsets(cx, cy, SCREEN_W, SCREEN_H, RADIUS, CLEARANCE);
  const allVerticallyVisible = fan.every(
    offset => cy + offset.y - HALF >= 0 && cy + offset.y + HALF <= SCREEN_H,
  );
  check(`G3.${index} ${label} keeps every button on screen vertically`, allVerticallyVisible, true);
  index += 1;
});

let horizontalIndex = 1;
ANCHOR_POSITIONS.forEach(([label, cx, cy]) => {
  const fan = offsets(cx, cy, SCREEN_W, SCREEN_H, RADIUS, CLEARANCE);
  const allHorizontallyVisible = fan.every(
    offset => cx + offset.x - HALF >= 0 && cx + offset.x + HALF <= SCREEN_W,
  );
  check(
    `G4.${horizontalIndex} ${label} keeps every button on screen horizontally`,
    allHorizontallyVisible,
    true,
  );
  horizontalIndex += 1;
});

const MID = [200, SCREEN_H / 2];

check(
  'G5.1 the fan always has three positions',
  offsets(MID[0], MID[1], SCREEN_W, SCREEN_H, RADIUS, CLEARANCE).length,
  3,
);
check(
  'G5.2 a zero radius collapses onto the anchor',
  offsets(MID[0], MID[1], SCREEN_W, SCREEN_H, 0, CLEARANCE).every(
    o => o.x === 0 && o.y === 0,
  ),
  true,
);
check(
  'G5.3 clear of every edge the middle button sits a full radius out',
  offsets(MID[0], MID[1], SCREEN_W, SCREEN_H, RADIUS, CLEARANCE)[1].x,
  RADIUS,
);
check(
  'G5.4 mirroring only flips the horizontal axis',
  offsets(MID[0], MID[1], SCREEN_W, SCREEN_H, RADIUS, CLEARANCE).map(o => o.y),
  offsets(SCREEN_W - MID[0], MID[1], SCREEN_W, SCREEN_H, RADIUS, CLEARANCE).map(
    o => o.y,
  ),
);
check(
  'G5.5 and mirrors the horizontal offsets exactly',
  offsets(MID[0], MID[1], SCREEN_W, SCREEN_H, RADIUS, CLEARANCE).map(o => -o.x),
  offsets(SCREEN_W - MID[0], MID[1], SCREEN_W, SCREEN_H, RADIUS, CLEARANCE).map(
    o => o.x,
  ),
);
check(
  'G5.6 the rigid shift preserves the spacing between buttons',
  (() => {
    const clear = offsets(MID[0], MID[1], SCREEN_W, SCREEN_H, RADIUS, CLEARANCE);
    const corner = offsets(60, 60, SCREEN_W, SCREEN_H, RADIUS, CLEARANCE);
    const gap = fan => fan[1].y - fan[0].y;
    return gap(clear) === gap(corner);
  })(),
  true,
);

const NARROW_H = 400;
check(
  'G6.1 a short screen still yields three positions',
  offsets(60, 200, SCREEN_W, NARROW_H, RADIUS, CLEARANCE).length,
  3,
);
check(
  'G6.2 and centres the fan when it cannot fully fit',
  Number.isFinite(verticalBiasDegrees(200, NARROW_H, RADIUS, CLEARANCE)),
  true,
);

report();
