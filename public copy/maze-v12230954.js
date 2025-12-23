
// ---------- Config ----------
let COLS = 22, ROWS = 22;     // You can change size with the buttons
let CELL;                      // computed from canvas size
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

let grid, player, goal;
let trail = []; // NEW: stores the path

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
    if (y > 0)           list.push(grid[y - 1][x]);      // up
    if (x < COLS - 1)    list.push(grid[y][x + 1]);      // right
    if (y < ROWS - 1)    list.push(grid[y + 1][x]);      // down
    if (x > 0)           list.push(grid[y][x - 1]);      // left
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

  trail = [{ x: player.x, y: player.y }]; // NEW: start trail at origin

  draw();
  statusEl.textContent = "Use Arrow keys / D‑pad / Gamepad";
}

// ---------- Render ----------
function draw() {
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

  // trail line (glowing path)
  drawTrail();

  // player with glow
  ctx.save();
  ctx.fillStyle = "#e74c3c";
  ctx.shadowColor = "rgba(231, 76, 60, 0.6)";
  ctx.shadowBlur = Math.max(12, Math.floor(CELL * 0.5));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.beginPath();
  ctx.arc(player.x * CELL + CELL / 2, player.y * CELL + CELL / 2, Math.max(8, CELL / 3), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrail() {
  if (!trail.length) return;

  ctx.save();
  ctx.strokeStyle = "#00bcd4"; // teal
  ctx.lineWidth = Math.max(4, Math.floor(CELL * 0.18));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.shadowColor = "rgba(0, 188, 212, 0.45)";
  ctx.shadowBlur = Math.max(8, Math.floor(CELL * 0.35));

  ctx.beginPath();
  let p0 = trail[0];
  ctx.moveTo(p0.x * CELL + CELL / 2, p0.y * CELL + CELL / 2);
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
  const x0 = player.x, y0 = player.y;

  if (dir === "up"    && canMove(player, "up"))    player.y--;
  if (dir === "right" && canMove(player, "right")) player.x++;
  if (dir === "down"  && canMove(player, "down"))  player.y++;
  if (dir === "left"  && canMove(player, "left"))  player.x--;

  if (player.x !== x0 || player.y !== y0) {
    trail.push({ x: player.x, y: player.y }); // NEW: extend trail
  }

  draw();
  checkWin();
}

function checkWin() {
  if (player.x === goal.x && player.y === goal.y) {
    statusEl.textContent = "You win! Press ‘New Maze’ to play again.";
  }
}

// ---------- Input: keyboard, D‑pad codes ----------
document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":    move("up");    break;
    case "ArrowRight": move("right"); break;
    case "ArrowDown":  move("down");  break;
    case "ArrowLeft":  move("left");  break;
    case "Enter":      break;
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

      if (dir && (dir !== lastDir || ts - lastTime > 160)) {
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
document.getElementById("regen").addEventListener("click", () => generateMaze());
document.getElementById("smaller").addEventListener("click", () => {
  COLS = Math.max(8, COLS - 2);
  ROWS = Math.max(8, ROWS - 2);
  generateMaze();
});
document.getElementById("bigger").addEventListener("click", () => {
  COLS = Math.min(50, COLS + 2);
  ROWS = Math.min(50, ROWS + 2);
  generateMaze();
});

// ---------- Resize handling (keep square) ----------
function fitCanvas() {
  const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.7);
  const s = Math.max(360, Math.min(1080, Math.floor(size)));
  canvas.width = s;
  canvas.height = s;
  CELL = Math.floor(canvas.width / COLS);
  draw();
}
window.addEventListener("resize", fitCanvas);

// ---------- Init ----------
fitCanvas();
generate()
