/* ══════════════════════════════════════════════
   EL JUEGO — MJ LLERGO  |  game.js
   Surgical Extraction Game
   ══════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────
// ORGAN CONFIGURATION
// Positions are percentages of the board image (1441 × 2160 px).
// ─────────────────────────────────────────────
const ORGANS = [
  {
    id: 'heart',
    label: 'Corazón',
    left: '60.5%',   // ~x 872 / 1441
    top:  '35.2%',   // ~y 760 / 2160
    width: '10.0%',
  },
  {
    id: 'butterfly',
    label: 'Mariposa',
    left: '33.8%',   // ~x 487 / 1441
    top:  '40.0%',   // ~y 864 / 2160
    width: '8.5%',
  },
  {
    id: 'rib',
    label: 'Costilla',
    left: '42.7%',   // ~x 615 / 1441
    top:  '50.2%',   // ~y 1085 / 2160
    width: '9.2%',
  },
  {
    id: 'armbone',
    label: 'Hueso',
    left: '44.8%',   // ~x 645 / 1441
    top:  '65.5%',   // ~y 1415 / 2160
    width: '7.5%',
  },
];

// How long the player must hold to extract (ms)
const EXTRACTION_DURATION = 2500;

// Pixel tolerance around the slot before triggering a buzz
const HOLD_TOLERANCE = 14;

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let extractedCount = 0;

let hold = null;
// hold = {
//   organId: string,
//   startTime: DOMHighResTimeStamp,
//   rafId: number,
// }

// ─────────────────────────────────────────────
// ELEMENT REFERENCES
// ─────────────────────────────────────────────
const tweetzersCursorEl = document.getElementById('tweezers-cursor');
const tweezersImgEl     = document.getElementById('tweezers-img');
const introScreenEl     = document.getElementById('intro-screen');
const gameScreenEl      = document.getElementById('game-screen');
const victoryScreenEl   = document.getElementById('victory-screen');
const startBtnEl        = document.getElementById('start-btn');
const replayBtnEl       = document.getElementById('replay-btn');
const scoreLabelEl      = document.getElementById('score-label');
const audioErrorEl      = document.getElementById('audio-error');

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
function init() {
  positionSlots();
  bindEvents();
}

function positionSlots() {
  ORGANS.forEach(organ => {
    const slot = document.getElementById(`slot-${organ.id}`);
    if (!slot) return;
    slot.style.left  = organ.left;
    slot.style.top   = organ.top;
    slot.style.width = organ.width;
  });
}

// ─────────────────────────────────────────────
// TWEEZERS CURSOR
// ─────────────────────────────────────────────
function moveCursor(x, y) {
  tweetzersCursorEl.style.left = x + 'px';
  tweetzersCursorEl.style.top  = y + 'px';
}

function setTweezers(state /* 'open' | 'closed' */) {
  tweezersImgEl.src = state === 'closed'
    ? 'images/tweezers-closed-bk.png'
    : 'images/tweezers-open-bk.png';
}

// ─────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────
function bindEvents() {
  // Cursor tracking
  document.addEventListener('mousemove', onMouseMove);

  // Intro → Game transition
  startBtnEl.addEventListener('click', startGame);

  // Replay
  replayBtnEl.addEventListener('click', () => location.reload());

  // Organ slots: begin hold on mousedown
  ORGANS.forEach(organ => {
    const slot = document.getElementById(`slot-${organ.id}`);
    if (!slot) return;
    slot.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (slot.classList.contains('extracted')) return;
      beginHold(organ.id, slot);
    });
  });

  // Cancel hold on mouseup (anywhere)
  document.addEventListener('mouseup', () => {
    if (hold) cancelHold(false);
  });

  // Steady-hand check on mousemove
  document.addEventListener('mousemove', onHoldMouseMove);

  // Prevent context menu from interfering
  document.addEventListener('contextmenu', e => e.preventDefault());
}

// ─────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────
function startGame() {
  introScreenEl.classList.add('fade-out');
  setTimeout(() => {
    introScreenEl.classList.add('hidden');
    gameScreenEl.classList.remove('hidden');
  }, 700);
}

// ─────────────────────────────────────────────
// MOUSE HANDLERS
// ─────────────────────────────────────────────
function onMouseMove(e) {
  moveCursor(e.clientX, e.clientY);
}

function onHoldMouseMove(e) {
  if (!hold) return;

  const slot = document.getElementById(`slot-${hold.organId}`);
  if (!slot) return;

  const rect = slot.getBoundingClientRect();
  const outside =
    e.clientX < rect.left   - HOLD_TOLERANCE ||
    e.clientX > rect.right  + HOLD_TOLERANCE ||
    e.clientY < rect.top    - HOLD_TOLERANCE ||
    e.clientY > rect.bottom + HOLD_TOLERANCE;

  if (outside) {
    buzzAndCancel(slot);
  }
}

// ─────────────────────────────────────────────
// HOLD MECHANIC
// ─────────────────────────────────────────────
function beginHold(organId, slot) {
  if (hold) return; // already holding something

  setTweezers('closed');
  slot.classList.add('extracting');

  hold = {
    organId,
    startTime: performance.now(),
    rafId: null,
  };

  hold.rafId = requestAnimationFrame(tickHold);
}

function tickHold(now) {
  if (!hold) return;

  const elapsed  = now - hold.startTime;
  const progress = Math.min(elapsed / EXTRACTION_DURATION, 1);

  updateRing(hold.organId, progress);

  if (progress >= 1) {
    // Successful extraction!
    const slot = document.getElementById(`slot-${hold.organId}`);
    const organId = hold.organId;
    hold = null;
    extractOrgan(organId, slot);
    return;
  }

  hold.rafId = requestAnimationFrame(tickHold);
}

function cancelHold(playBuzz) {
  if (!hold) return;

  cancelAnimationFrame(hold.rafId);
  const organId = hold.organId;
  hold = null;

  setTweezers('open');

  const slot = document.getElementById(`slot-${organId}`);
  if (slot) slot.classList.remove('extracting');

  resetRing(organId);
}

function buzzAndCancel(slot) {
  if (!hold) return;

  cancelAnimationFrame(hold.rafId);
  const organId = hold.organId;
  hold = null;

  setTweezers('open');
  resetRing(organId);

  // Play error sound
  audioErrorEl.currentTime = 0;
  audioErrorEl.play().catch(() => {});

  // Visual buzz shake
  slot.classList.remove('extracting');
  slot.classList.add('buzz');
  slot.addEventListener('animationend', () => {
    slot.classList.remove('buzz');
  }, { once: true });
}

// ─────────────────────────────────────────────
// PROGRESS RING HELPERS
// ─────────────────────────────────────────────
const RING_CIRCUM = 150.796; // 2π × r(24)

function updateRing(organId, progress) {
  const ring = document.getElementById(`ring-${organId}`);
  if (!ring) return;
  ring.style.strokeDashoffset = RING_CIRCUM * (1 - progress);
}

function resetRing(organId) {
  const ring = document.getElementById(`ring-${organId}`);
  if (!ring) return;
  ring.style.strokeDashoffset = RING_CIRCUM;
}

// ─────────────────────────────────────────────
// EXTRACTION
// ─────────────────────────────────────────────
function extractOrgan(organId, slot) {
  setTweezers('open');
  slot.classList.remove('extracting');

  const box      = document.getElementById(`box-${organId}`);
  const boxSlot  = box.querySelector('.box-slot');

  const slotRect = slot.getBoundingClientRect();
  const boxRect  = boxSlot.getBoundingClientRect();

  // Hide the slot from the board
  slot.classList.add('extracted');

  // Create a flying clone that animates to the panel
  const flyEl = document.createElement('img');
  flyEl.src = `images/piece-${organId}.png`;
  flyEl.setAttribute('draggable', 'false');
  flyEl.style.cssText = [
    'position:fixed',
    `left:${slotRect.left + slotRect.width  / 2}px`,
    `top:${slotRect.top  + slotRect.height / 2}px`,
    `width:${slotRect.width}px`,
    'height:auto',
    'transform:translate(-50%,-50%)',
    'pointer-events:none',
    'z-index:1000',
    'transition:left 0.55s cubic-bezier(0.4,0,0.2,1),top 0.55s cubic-bezier(0.4,0,0.2,1),width 0.55s cubic-bezier(0.4,0,0.2,1)',
    'will-change:left,top,width',
  ].join(';');

  document.body.appendChild(flyEl);

  // Kick off the animation on the next two frames to ensure styles are applied
  requestAnimationFrame(() => requestAnimationFrame(() => {
    flyEl.style.left  = (boxRect.left + boxRect.width  / 2) + 'px';
    flyEl.style.top   = (boxRect.top  + boxRect.height / 2) + 'px';
    flyEl.style.width = '30px';
  }));

  // After animation, finalise the collection
  const finalize = () => {
    flyEl.remove();
    fillBox(organId, box);
  };

  flyEl.addEventListener('transitionend', finalize, { once: true });
  // Fallback in case transitionend doesn't fire
  setTimeout(() => {
    if (flyEl.parentNode) finalize();
  }, 700);
}

function fillBox(organId, box) {
  box.classList.add('filled');

  // Start the song preview
  const audio = document.getElementById(`audio-${organId}`);
  if (audio) {
    audio.volume = 0.72;
    audio.play().catch(() => {});
  }

  // Update score
  extractedCount++;
  scoreLabelEl.textContent = `${extractedCount} / ${ORGANS.length}`;

  // Victory check
  if (extractedCount >= ORGANS.length) {
    setTimeout(showVictory, 900);
  }
}

// ─────────────────────────────────────────────
// VICTORY
// ─────────────────────────────────────────────
function showVictory() {
  victoryScreenEl.classList.remove('hidden');
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
init();
