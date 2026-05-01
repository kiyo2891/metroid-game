const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ===== パラメータ =====
const GRAVITY = 0.6;
const MOVE_SPEED = 4;
const DASH_SPEED = 7;
const JUMP_POWER = 12;
const INVINCIBLE_TIME = 60;
const BULLET_SPEED = 8;
const BULLET_COOLDOWN = 15;
const TILE = 32;

// ===== プレイヤー（初期から全能力装備）=====
const player = {
  x: 100, y: 100, w: 24, h: 36,
  vx: 0, vy: 0,
  onGround: false,
  jumpsLeft: 2,
  facing: 1,
  walkFrame: 0,
  hp: 3,
  maxHp: 3,
  invincible: 0,
  shootCooldown: 0,
  abilities: {
    doubleJump: true,   // 初期装備
    dash: true          // 初期装備
  },
  collectedItems: new Set()
};

// ===== ゲーム状態 =====
let gameState = 'playing'; // 'playing' | 'cleared'
let bossDefeated = false;

// ===== マップ定義 =====
const areas = {
  area1: {
    name: 'スタートエリア',
    bgColor: '#1a1a2e',
    tileColor: '#3b3b5c',
    map: [
      "1111111111111111111111111111111111111111",
      "1......................................1",
      "1......................................1",
      "1.....................11...............1",
      "1......111............11..............D1",
      "1.....................11..............11",
      "1.............111111....................1",
      "1.................................11...1",
      "1...111................................1",
      "1.111..................11..............1",
      "1......................................1",
      "1.........................1111.........1",
      "1......................................1",
      "1111111111111111111111111111111111111111"
    ],
    items: [
      { id: 'a1_hp1', type: 'hp', col: 16, row: 8, label: 'HP+' }
    ],
    enemies: [
      { x: 300, y: 384, w: 28, h: 28, vx: 1.2, range: [260, 460], hp: 2, color: '#f87171' },
      { x: 700, y: 384, w: 28, h: 28, vx: -1.2, range: [620, 820], hp: 2, color: '#f87171' }
    ],
    doors: [
      { col: 38, row: 4, target: 'area2', spawnCol: 2, spawnRow: 10 }
    ]
  },
  area2: {
    name: '洞窟エリア',
    bgColor: '#2e1a1a',
    tileColor: '#5c3b3b',
    map: [
      "1111111111111111111111111111111111111111",
      "1......................................1",
      "D......................................1",
      "11.....................................1",
      "1.......111............................1",
      "1......................................1",
      "1...111.........111.....111.............1",
      "1......................................1",
      "1......................................1",
      "1......................................1",
      "1.......H..............................1",
      "1...111....................1111.......D1",
      "1......................................1",
      "1111111111111111111111111111111111111111"
    ],
    items: [
      { id: 'a2_hp1', type: 'hp', col: 8, row: 10, label: 'HP+' }
    ],
    enemies: [
      { x: 400, y: 192, w: 28, h: 28, vx: 1.5, range: [350, 600], hp: 2, color: '#fb923c' },
      { x: 800, y: 320, w: 28, h: 28, vx: -1.0, range: [700, 950], hp: 3, color: '#a855f7' },
      { x: 1100, y: 384, w: 28, h: 28, vx: 1.3, range: [1050, 1250], hp: 2, color: '#f87171' }
    ],
    doors: [
      { col: 0, row: 2, target: 'area1', spawnCol: 37, spawnRow: 4 },
      { col: 38, row: 11, target: 'area3', spawnCol: 2, spawnRow: 10 }
    ]
  },
  area3: {
    name: 'ボスの間',
    bgColor: '#1e0a2e',
    tileColor: '#4c1d95',
    map: [
      "1111111111111111111111111111111111111111",
      "1......................................1",
      "1......................................1",
      "1......................................1",
      "1......................................1",
      "1......................................1",
      "1.................................11111",
      "1......................................1",
      "1......................................1",
      "1......................................1",
      "1......................................1",
      "D......................................1",
      "11.....................................1",
      "1111111111111111111111111111111111111111"
    ],
    items: [],
    enemies: [
      // ボス：HP高め、大きい、左右移動
      { x: 800, y: 320, w: 64, h: 64, vx: 2.0, range: [600, 1100], hp: 12, color: '#dc2626', isBoss: true, name: 'ガーディアン' }
    ],
    doors: [
      { col: 0, row: 11, target: 'area2', spawnCol: 37, spawnRow: 11 }
    ]
  }
};

let currentAreaId = 'area1';
let currentArea = areas[currentAreaId];
const bullets = [];

// ===== 入力 =====
const keys = {};
const keysPrev = {};
addEventListener('keydown', e => { keys[e.code] = true; });
addEventListener('keyup',   e => { keys[e.code] = false; });
const justPressed = code => keys[code] && !keysPrev[code];

// ===== カメラ =====
const camera = { x: 0, y: 0 };

// ===== タイル =====
function getTile(col, row) {
  const map = currentArea.map;
  if (row < 0 || row >= map.length) return '1';
  if (col < 0 || col >= map[row].length) return '1';
  const t = map[row][col];
  return (t === '1') ? '1' : '.';
}

function collideTiles(obj, dx, dy) {
  obj.x += dx;
  let left   = Math.floor(obj.x / TILE);
  let right  = Math.floor((obj.x + obj.w - 1) / TILE);
  let top    = Math.floor(obj.y / TILE);
  let bottom = Math.floor((obj.y + obj.h - 1) / TILE);
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (getTile(c, r) === '1') {
        if (dx > 0) obj.x = c * TILE - obj.w;
        else if (dx < 0) obj.x = (c + 1) * TILE;
        obj.vx = 0;
      }
    }
  }

  obj.y += dy;
  let hitY = false;
  left   = Math.floor(obj.x / TILE);
  right  = Math.floor((obj.x + obj.w - 1) / TILE);
  top    = Math.floor(obj.y / TILE);
  bottom = Math.floor((obj.y + obj.h - 1) / TILE);
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (getTile(c, r) === '1') {
        if (dy > 0) {
          obj.y = r * TILE - obj.h;
          obj.onGround = true;
          obj.jumpsLeft = player.abilities.doubleJump ? 2 : 1;
        }
        else if (dy < 0) obj.y = (r + 1) * TILE;
        obj.vy = 0;
        hitY = true;
      }
    }
  }
  if (!hitY && dy !== 0) obj.onGround = false;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function changeArea(targetId, spawnCol, spawnRow) {
  currentAreaId = targetId;
  currentArea = areas[targetId];
  player.x = spawnCol * TILE;
  player.y = spawnRow * TILE;
  player.vx = 0; player.vy = 0;
  bullets.length = 0;
  showAreaName = currentArea.name;
  areaNameTimer = 120;
}

let showAreaName = currentArea.name;
let areaNameTimer = 120;

let message = '';
let messageTimer = 0;
function showMessage(text, frames = 120) {
  message = text;
  messageTimer = frames;
}

function applyItem(item) {
  if (item.type === 'hp') {
    player.maxHp++;
    player.hp = player.maxHp;
    showMessage('最大HP +1!');
  }
  player.collectedItems.add(item.id);
}

// ===== 更新 =====
function update() {
  // クリア後はリスタート受付のみ
  if (gameState === 'cleared') {
    if (justPressed('Enter')) location.reload();
    for (const k in keys) keysPrev[k] = keys[k];
    return;
  }

  const dashing = player.abilities.dash && keys['ShiftLeft'];
  const speed = dashing ? DASH_SPEED : MOVE_SPEED;
  if (keys['ArrowLeft'])  { player.vx = -speed; player.facing = -1; }
  else if (keys['ArrowRight']) { player.vx = speed; player.facing = 1; }
  else player.vx = 0;

  if (justPressed('Space') && player.jumpsLeft > 0) {
    player.vy = -JUMP_POWER;
    player.jumpsLeft--;
    player.onGround = false;
  }

  player.vy += GRAVITY;
  if (player.vy > 15) player.vy = 15;

  collideTiles(player, player.vx, 0);
  collideTiles(player, 0, player.vy);

  if (player.vx !== 0 && player.onGround) player.walkFrame++;
  else player.walkFrame = 0;

  // 弾発射
  if (player.shootCooldown > 0) player.shootCooldown--;
  if (justPressed('KeyZ') && player.shootCooldown === 0) {
    bullets.push({
      x: player.x + (player.facing === 1 ? player.w : -8),
      y: player.y + 14,
      w: 8, h: 4,
      vx: BULLET_SPEED * player.facing,
      life: 60
    });
    player.shootCooldown = BULLET_COOLDOWN;
  }

  // 弾の処理
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.life--;
    const col = Math.floor((b.x + b.w / 2) / TILE);
    const row = Math.floor((b.y + b.h / 2) / TILE);
    if (getTile(col, row) === '1' || b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = currentArea.enemies.length - 1; j >= 0; j--) {
      const e = currentArea.enemies[j];
      if (rectsOverlap(b, e)) {
        e.hp--;
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          // ボス撃破判定
          if (e.isBoss) {
            bossDefeated = true;
            gameState = 'cleared';
          }
          currentArea.enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  currentArea.enemies.forEach(e => {
    e.x += e.vx;
    if (e.x < e.range[0] || e.x + e.w > e.range[1]) e.vx *= -1;
  });

  if (player.invincible > 0) player.invincible--;
  else {
    currentArea.enemies.forEach(e => {
      if (rectsOverlap(player, e)) {
        // ボスは2ダメージ
        const dmg = e.isBoss ? 2 : 1;
        player.hp -= dmg;
        player.invincible = INVINCIBLE_TIME;
        player.vy = -8;
        player.vx = (player.x < e.x ? -6 : 6);
        if (player.hp <= 0) {
          player.x = 100; player.y = 100;
          player.hp = player.maxHp;
          showMessage('やられた! 復活します');
        }
      }
    });
  }

  // アイテム取得
  currentArea.items.forEach(item => {
    if (player.collectedItems.has(item.id)) return;
    const ix = item.col * TILE;
    const iy = item.row * TILE;
    const itemRect = { x: ix + 4, y: iy + 4, w: 24, h: 24 };
    if (rectsOverlap(player, itemRect)) {
      applyItem(item);
    }
  });

  // 扉
  if (justPressed('ArrowUp')) {
    currentArea.doors.forEach(door => {
      const dx = door.col * TILE;
      const dy = door.row * TILE;
      const doorRect = { x: dx, y: dy, w: TILE, h: TILE * 2 };
      if (rectsOverlap(player, doorRect)) {
        changeArea(door.target, door.spawnCol, door.spawnRow);
      }
    });
  }

  if (messageTimer > 0) messageTimer--;
  if (areaNameTimer > 0) areaNameTimer--;

  camera.x = player.x - canvas.width / 2 + player.w / 2;
  camera.y = player.y - canvas.height / 2 + player.h / 2;
  const mapW = currentArea.map[0].length * TILE;
  const mapH = currentArea.map.length * TILE;
  camera.x = Math.max(0, Math.min(camera.x, mapW - canvas.width));
  camera.y = Math.max(0, Math.min(camera.y, mapH - canvas.height));

  for (const k in keys) keysPrev[k] = keys[k];
}

// ===== 描画 =====
function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0) return;
  const px = player.x - camera.x;
  const py = player.y - camera.y;

  ctx.save();
  if (player.facing === -1) {
    ctx.translate(px + player.w, py);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(px, py);
  }

  const swing = Math.sin(player.walkFrame * 0.3) * 4;
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(4, 28 + Math.max(0, swing), 6, 8 - Math.max(0, swing));
  ctx.fillRect(14, 28 - Math.min(0, swing), 6, 8 + Math.min(0, swing));

  ctx.fillStyle = '#4ade80';
  ctx.fillRect(4, 12, 16, 16);
  ctx.fillRect(18, 13, 4, 10);
  ctx.fillRect(2, 13, 4, 10);

  ctx.fillStyle = '#fcd5b5';
  ctx.fillRect(6, 0, 12, 12);

  ctx.fillStyle = '#000';
  ctx.fillRect(13, 4, 2, 2);

  ctx.restore();
}

function drawEnemy(e) {
  const ex = e.x - camera.x;
  const ey = e.y - camera.y;

  if (e.isBoss) {
    // ボス：大きく、角がある悪役風
    ctx.fillStyle = e.color;
    ctx.fillRect(ex, ey + 8, e.w, e.h - 8);
    // 角
    ctx.beginPath();
    ctx.moveTo(ex + 8, ey + 8);
    ctx.lineTo(ex + 16, ey - 8);
    ctx.lineTo(ex + 24, ey + 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ex + e.w - 24, ey + 8);
    ctx.lineTo(ex + e.w - 16, ey - 8);
    ctx.lineTo(ex + e.w - 8, ey + 8);
    ctx.fill();
    // 目
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ex + 12, ey + 20, 10, 10);
    ctx.fillRect(ex + e.w - 22, ey + 20, 10, 10);
    ctx.fillStyle = '#000';
    ctx.fillRect(ex + 16, ey + 24, 4, 4);
    ctx.fillRect(ex + e.w - 18, ey + 24, 4, 4);
    // 口
    ctx.fillStyle = '#000';
    ctx.fillRect(ex + 16, ey + 44, e.w - 32, 6);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(ex + 18 + i * 8, ey + 44, 3, 4);
    }
    // ボスHPバー（頭上）
    const barW = e.w;
    ctx.fillStyle = '#000';
    ctx.fillRect(ex, ey - 16, barW, 5);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ex, ey - 16, barW * (e.hp / 12), 5);
    return;
  }

  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.arc(ex + e.w / 2, ey + e.h / 2 - 2, e.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(ex + 4, ey + e.h - 6, 4, 6);
  ctx.fillRect(ex + 12, ey + e.h - 4, 4, 4);
  ctx.fillRect(ex + 20, ey + e.h - 6, 4, 6);
  ctx.fillStyle = '#fff';
  ctx.fillRect(ex + 8, ey + 10, 4, 4);
  ctx.fillRect(ex + 16, ey + 10, 4, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(ex + 9, ey + 11, 2, 2);
  ctx.fillRect(ex + 17, ey + 11, 2, 2);
}

function drawItem(item) {
  if (player.collectedItems.has(item.id)) return;
  const ix = item.col * TILE - camera.x;
  const iy = item.row * TILE - camera.y;
  const pulse = Math.sin(Date.now() / 200) * 2;

  ctx.fillStyle = 'rgba(255, 230, 100, 0.3)';
  ctx.beginPath();
  ctx.arc(ix + 16, iy + 16, 16 + pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(ix + 8, iy + 8, 16, 16);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(item.label, ix + 16, iy + 19);
}

function drawDoor(door) {
  const dx = door.col * TILE - camera.x;
  const dy = door.row * TILE - camera.y;
  // ボスエリアへの扉は色を変える
  const isBossDoor = door.target === 'area3';
  ctx.fillStyle = isBossDoor ? '#7c2d12' : '#854d0e';
  ctx.fillRect(dx + 4, dy, 24, TILE * 2);
  ctx.fillStyle = isBossDoor ? '#dc2626' : '#facc15';
  ctx.fillRect(dx + 22, dy + 28, 3, 3);
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↑', dx + 16, dy - 4);
  if (isBossDoor) {
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('BOSS', dx + 16, dy - 16);
  }
}

function drawBullet(b) {
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(b.x - camera.x + 1, b.y - camera.y + 1, b.w - 2, b.h - 2);
}

function drawHUD() {
  for (let i = 0; i < player.maxHp; i++) {
    ctx.fillStyle = i < player.hp ? '#ef4444' : '#444';
    ctx.beginPath();
    ctx.arc(20 + i * 24, 20, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 能力アイコン（常時点灯）
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#22d3ee';
  ctx.fillText('◆ 二段J', 20, 50);
  ctx.fillStyle = '#facc15';
  ctx.fillText('◆ ダッシュ', 90, 50);

  if (messageTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(canvas.width / 2 - 200, canvas.height - 60, 400, 36);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, canvas.width / 2, canvas.height - 38);
  }

  if (areaNameTimer > 0) {
    const alpha = Math.min(1, areaNameTimer / 30);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(showAreaName, canvas.width / 2, 50);
  }
}

// クリア画面
function drawClearScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GAME CLEAR!', canvas.width / 2, canvas.height / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('ガーディアンを倒した!', canvas.width / 2, canvas.height / 2);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText('Enter / タップでもう一度プレイ', canvas.width / 2, canvas.height / 2 + 40);
}

function draw() {
  ctx.fillStyle = currentArea.bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const map = currentArea.map;
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === '1') {
        ctx.fillStyle = currentArea.tileColor;
        ctx.fillRect(c * TILE - camera.x, r * TILE - camera.y, TILE, TILE);
        ctx.strokeStyle = '#555580';
        ctx.strokeRect(c * TILE - camera.x, r * TILE - camera.y, TILE, TILE);
      }
    }
  }

  currentArea.doors.forEach(drawDoor);
  currentArea.items.forEach(drawItem);
  currentArea.enemies.forEach(drawEnemy);
  bullets.forEach(drawBullet);
  drawPlayer();
  drawHUD();

  if (gameState === 'cleared') drawClearScreen();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

// ===== タッチコントロール =====
(function () {
  function bindTouchBtn(id, code) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const press   = e => { e.preventDefault(); keys[code] = true; };
    const release = e => { e.preventDefault(); keys[code] = false; };
    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
  }

  bindTouchBtn('btn-left',   'ArrowLeft');
  bindTouchBtn('btn-right',  'ArrowRight');
  bindTouchBtn('btn-up',     'ArrowUp');
  bindTouchBtn('btn-jump',   'Space');
  bindTouchBtn('btn-attack', 'KeyZ');
  bindTouchBtn('btn-dash',   'ShiftLeft');

  // クリア画面タップ → リスタート
  canvas.addEventListener('touchstart', e => {
    if (gameState === 'cleared') { e.preventDefault(); location.reload(); }
  }, { passive: false });
})();