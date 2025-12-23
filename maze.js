
// ---------- Levels ----------
const LEVELS = [
  { name: "Toddler", cols: 8,  rows: 8,  targetMs: 30_000 }, // small & friendly default
  { name: "Warm‑up", cols: 14, rows: 14, targetMs: 45_000 },
  { name: "Easy",    cols: 18, rows: 18, targetMs: 60_000 },
  { name: "Medium",  cols: 22, rows: 22, targetMs: 90_000 },
  { name: "Hard",    cols: 26, rows: 26, targetMs: 120_000 },
  { name: "Expert",  cols: 30, rows: 30, targetMs: 180_000 }
];
let currentLevel = 0; // start on "Toddler"

// ---------- Config ----------
let COLS = LEVELS[currentLevel].cols;
let ROWS = LEVELS[currentLevel].rows;
let CELL;

const canvas      = document.getElementById("game");
const ctx         = canvas.getContext("2d");
const statusEl    = document.getElementById("status");
const levelSelect = document.getElementById("levelSelect");

let grid, player, goal;
let gameOver = false;

// Trail (cells visited in order) + stylized segments
let trail = [];
let forwardSegments   = []; // [{from:{x,y}, to:{x,y}}]
let backtrackSegments = []; // [{from:{x,y}, to:{x,y}}]

// ---------- Saved Maze (for true restart of same layout) ----------
let savedMaze = null; // 2D array of wall objects {top,right,bottom,left}

// ---------- Timer ----------
let startTime = null;
let elapsed   = 0;
let timerId   = null;
let hasStarted = false;

function formatTime(ms) {
  const total = Math.max(0, ms | 0);
  const mm = Math.floor(total / 60000);
  const ss = Math.floor((total % 60000) / 1000);
  const mmm = total % 1000;
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(mmm).padStart(3,'0')}`;
}

// Unified one-line Timer + Target HUD
function updateTimeTargetDisplay(elapsedMs) {
  const el = document.getElementById('timeTarget');
  if (!el) return;
  const targetMs = LEVELS[currentLevel].targetMs;
  el.innerHTML = `
    <span class="label">⏱</span> ${formatTime(elapsedMs)}
    <span class="label">|</span>
    <span class="label">🎯 Target:</span> ${formatTime(targetMs)}
  `;
}

function startTimer() {
  if (hasStarted) return;
  hasStarted = true;
  startTime = performance.now();
  const tick = () => {
    elapsed = performance.now() - startTime;
    updateTimeTargetDisplay(elapsed);
    timerId = requestAnimationFrame(tick);
  };
  timerId = requestAnimationFrame(tick);
}
function stopTimer() {
  if (timerId) cancelAnimationFrame(timerId);
  timerId = null;
  updateTimeTargetDisplay(elapsed); // final value
}

// ---------- Level HUD / Dropdown ----------
function updateLevelHud() {
  // Refresh the combined display (elapsed persists unless you restart)
  updateTimeTargetDisplay(elapsed);
  if (levelSelect) levelSelect.value = String(currentLevel);
}
function populateLevelDropdown() {
  if (!levelSelect) return;
  levelSelect.innerHTML = '';
  LEVELS.forEach((L, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = `${idx + 1}. ${L.name} (${L.cols}×${L.rows})`;
    levelSelect.appendChild(opt);
  });
  levelSelect.value = String(currentLevel);
}
levelSelect?.addEventListener('change', (e) => {
  const idx = parseInt(e.target.value, 10);
  setLevel(idx);
});

function setLevel(idx) {
  currentLevel = Math.max(0, Math.min(LEVELS.length - 1, idx));
  const L = LEVELS[currentLevel];
  COLS = L.cols;
  ROWS = L.rows;

  // Build new grid FIRST so draw won't see a mismatched size
  generateMaze();

  // Then (re)fit canvas; safe to draw if it does
  fitCanvas();

  updateLevelHud();
}
function restartLevel() {
  // Old behavior regenerated a new maze; we keep New Maze for that.
  // Restart Level now restores the SAME layout:
  restoreSavedMaze();
}

// ---------- Maze cell ----------
function Cell(x, y) {
  this.x = x; this.y = y;
  this.visited = false;
  this.walls = { top: true, right: true, bottom: true, left: true };
}

// ---------- Generation: DFS backtracking ----------
function generateMaze() {
  CELL = Math.floor(canvas.width / COLS);
  grid = Array.from({ length: ROWS }, (_, y) =>
    Array.from({ length: COLS }, (_, x) => new Cell(x, y))
  );

  const stack = [];
  const start = grid[0][0];
  start.visited = true;
  stack.push(start);

  function unvisitedNeighbors(cell) {
    const list = [];
    const { x, y } = cell;
    if (y > 0)        list.push(grid[y - 1][x]);   // up
    if (x < COLS - 1) list.push(grid[y][x + 1]);   // right
    if (y < ROWS - 1) list.push(grid[y + 1][x]);   // down
    if (x > 0)        list.push(grid[y][x - 1]);   // left
    return list.filter(n => !n.visited);
  }

  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = unvisitedNeighbors(current);
    if (choices.length) {
      const next = choices[Math.floor(Math.random() * choices.length)];
      // carve passage
      if (next.y < current.y)      { current.walls.top = false;    next.walls.bottom = false; }
      else if (next.x > current.x) { current.walls.right = false;  next.walls.left = false; }
      else if (next.y > current.y) { current.walls.bottom = false; next.walls.top = false; }
      else if (next.x < current.x) { current.walls.left = false;   next.walls.right = false; }
      next.visited = true;
      stack.push(next);
    } else {
      stack.pop();
    }
  }

  player = { x: 0, y: 0 };
  goal   = { x: COLS - 1, y: ROWS - 1 };

  // Reset trail, segments, state
  trail = [{ x: player.x, y: player.y }];
  forwardSegments = [];
  backtrackSegments = [];
  gameOver = false;

  // Reset timer state + unified HUD
  hasStarted = false;
  elapsed = 0;
  startTime = null;
  updateTimeTargetDisplay(0);

  // ---------- Save current maze layout for true restart ----------
  savedMaze = grid.map(row =>
    row.map(cell => ({
      top: cell.walls.top,
      right: cell.walls.right,
      bottom: cell.walls.bottom,
      left: cell.walls.left
    }))
  );

  draw();
  statusEl.textContent = "Use Arrow keys / D‑pad / Gamepad";
}

// ---------- Restore SAME MAZE layout (true restart) ----------
function restoreSavedMaze() {
  if (!savedMaze) {
    // If no saved maze yet, just generate and save one
    generateMaze();
    statusEl.textContent = "New maze generated (no saved layout yet).";
    return;
  }

  // Rebuild grid from saved walls
  grid = savedMaze.map((row, y) =>
    row.map((walls, x) => {
      const c = new Cell(x, y);
      c.walls = { ...walls };
      return c;
    })
  );

  // Reset player, goal, trail, segments, timer
  player = { x: 0, y: 0 };
  goal   = { x: COLS - 1, y: ROWS - 1 };
  trail = [{ x: player.x, y: player.y }];
  forwardSegments = [];
  backtrackSegments = [];

  hasStarted = false;
  elapsed = 0;
  startTime = null;
  updateTimeTargetDisplay(0);

  gameOver = false;

  draw();
  statusEl.textContent = "Level restarted (same maze layout).";
}

// ---------- Render ----------
function draw() {
  // Defensive guard: no grid or size mismatch
  if (!grid || grid.length !== ROWS || (grid[0] && grid[0].length !== COLS)) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // walls (optional subtle shadow; remove if performance drops)
  ctx.strokeStyle = "#808995";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0,0,0,0.20)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = grid[y][x];
      const px = x * CELL, py = y * CELL;
      if (c.walls.top)    { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + CELL, py); ctx.stroke(); }
      if (c.walls.right)  { ctx.beginPath(); ctx.moveTo(px + CELL, py); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
      if (c.walls.bottom) { ctx.beginPath(); ctx.moveTo(px, py + CELL); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
      if (c.walls.left)   { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + CELL); ctx.stroke(); }
    }
  }

  // goal with glow
  ctx.save();
  ctx.fillStyle = "#2ecc71";
  ctx.shadowColor = "rgba(46, 204, 113, 0.55)";
  ctx.shadowBlur = Math.max(10, Math.floor(CELL * 0.45));
  const pad = Math.max(6, Math.floor(CELL * 0.12));
  ctx.fillRect(goal.x * CELL + pad, goal.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
  ctx.restore();

  // forward segments (solid teal with glow)
  drawSegments(forwardSegments, "#00bcd4", 0.18, "rgba(0, 188, 212, 0.45)", 0.35, false);

  // backtracked segments (orange dashed, lighter glow)
  drawSegments(backtrackSegments, "#ff9800", 0.16, "rgba(255, 152, 0, 0.35)", 0.28, true);

  // current trail stack (optional continuous line)
  drawTrailStack();

  // player with glow
  ctx.save();
  ctx.fillStyle = "#e74c3c";
  ctx.shadowColor = "rgba(231, 76, 60, 0.6)";
  ctx.shadowBlur = Math.max(12, Math.floor(CELL * 0.5));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.beginPath();
  const playerRadius = Math.max(8, CELL / 3);
  ctx.arc(player.x * CELL + CELL / 2, player.y * CELL + CELL / 2, playerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSegments(segments, color, width, glowColor, glowBlur, dashed=false) {
  if (!segments.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(4, Math.floor(CELL * width));
  ctx.lineJoin = "round";
  ctx.lineCap  = "round";
  ctx.shadowColor = glowColor;
  ctx.shadowBlur  = Math.max(8, Math.floor(CELL * glowBlur));
  if (dashed) ctx.setLineDash([Math.max(6, CELL * 0.25), Math.max(6, CELL * 0.18)]);
  ctx.beginPath();
  for (const seg of segments) {
    const fromX = seg.from.x * CELL + CELL / 2;
    const fromY = seg.from.y * CELL + CELL / 2;
    const toX   = seg.to.x   * CELL + CELL / 2;
    const toY   = seg.to.y   * CELL + CELL / 2;
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
  }
  ctx.stroke();
  ctx.restore();
}
function drawTrailStack() {
  if (!trail.length) return;
  ctx.save();
  ctx.strokeStyle = "#00bcd4";
  ctx.lineWidth = Math.max(4, Math.floor(CELL * 0.18));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0, 188, 212, 0.45)";
  ctx.shadowBlur  = Math.max(8, Math.floor(CELL * 0.35));
  ctx.beginPath();
  ctx.moveTo(trail[0].x * CELL + CELL / 2, trail[0].y * CELL + CELL / 2);
  for (let i = 1; i < trail.length; i++) {
    const p = trail[i];
    ctx.lineTo(p.x * CELL + CELL / 2, p.y * CELL + CELL / 2);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------- Movement ----------
function canMove(from, dir) {
  const c = grid[from.y][from.x];
  if      (dir === "up")    return !c.walls.top;
  else if (dir === "right") return !c.walls.right;
  else if (dir === "down")  return !c.walls.bottom;
  else if (dir === "left")  return !c.walls.left;
  return false;
}
function move(dir) {
  if (gameOver) return; // block input after win
  const x0 = player.x, y0 = player.y;

  if (dir === "up"    && canMove(player, "up"))    player.y--;
  if (dir === "right" && canMove(player, "right")) player.x++;
  if (dir === "down"  && canMove(player, "down"))  player.y++;
  if (dir === "left"  && canMove(player, "left"))  player.x--;

  // Start timer on first movement
  if (!hasStarted && (player.x !== x0 || player.y !== y0)) startTimer();

  // Only proceed if position changed
  if (player.x !== x0 || player.y !== y0) {
    const prev = trail[trail.length - 2];
    const currentTop = trail[trail.length - 1];
    const isBacktrack = prev && prev.x === player.x && prev.y === player.y;
    if (isBacktrack) {
      backtrackSegments.push({ from: currentTop, to: prev });
      trail.pop();
    } else {
      forwardSegments.push({ from: { x: x0, y: y0 }, to: { x: player.x, y: player.y } });
      trail.push({ x: player.x, y: player.y });
    }
  }

  draw();
  checkWin();
}

// ---------- Win ----------
function checkWin() {
  if (player.x === goal.x && player.y === goal.y) {
    gameOver = true;
    stopTimer();

    const L = LEVELS[currentLevel];
    const beatTarget = elapsed <= L.targetMs;
    const star = beatTarget ? "⭐" : "";
    statusEl.textContent = `You win! ${star} Time: ${formatTime(elapsed)} (Target: ${formatTime(L.targetMs)})`;
    // User chooses next challenge via dropdown
  }
}

// ---------- Input: keyboard ----------
document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":    move("up");    break;
    case "ArrowRight": move("right"); break;
    case "ArrowDown":  move("down");  break;
    case "ArrowLeft":  move("left");  break;
    case "Enter":      /* no next-level */ break;
    default:
      const code = e.keyCode || e.which;
      if (code === 38) move("up");
      else if (code === 39) move("right");
      else if (code === 40) move("down");
      else if (code === 37) move("left");
  }
});

// ---------- Input: Gamepad (polling) ----------
let haveGamepad = false;
window.addEventListener("gamepadconnected", () => { haveGamepad = true; statusEl.textContent = "Gamepad connected"; });
window.addEventListener("gamepaddisconnected", () => { haveGamepad = false; statusEl.textContent = "Gamepad disconnected"; });

let lastDir = null, lastTime = 0;
let inputRepeatMs = 160; // increase (e.g. 220) for slower repeat in kid mode
function pollGamepad(ts) {
  if (haveGamepad) {
    const gp = navigator.getGamepads()[0];
    if (gp) {
      const horiz = gp.axes[0] || 0;
      const vert  = gp.axes[1] || 0;
      const DEAD = 0.5;
      let dir = null;
      if (vert < -DEAD) dir = "up";
      else if (vert > DEAD) dir = "down";
      else if (horiz > DEAD) dir = "right";
      else if (horiz < -DEAD) dir = "left";

      if (dir && (dir !== lastDir || ts - lastTime > inputRepeatMs)) {
        move(dir);
        lastDir = dir;
        lastTime = ts;
      }
    }
  }
  requestAnimationFrame(pollGamepad);
}
requestAnimationFrame(pollGamepad);

// ---------- UI ----------
document.getElementById("regen")?.addEventListener("click", () => {
  // New Maze: build a new random layout (and save it)
  generateMaze();
});
document.getElementById("restart")?.addEventListener("click", () => {
  // Restart Level: restore the SAME maze layout
  restoreSavedMaze();
});

// ---------- Resize handling (keep square) ----------
function fitCanvas() {
  const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.7);
  const s = Math.max(360, Math.min(1080, Math.floor(size)));
  canvas.width = s;
  canvas.height = s;
  CELL = Math.floor(canvas.width / COLS);
  if (grid) draw(); // draw only if maze exists
}
window.addEventListener("resize", fitCanvas);

// ---------- Init ----------
populateLevelDropdown();
updateTimeTargetDisplay(0); // show initial timer/target line
fitCanvas();
