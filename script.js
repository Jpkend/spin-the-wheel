// script.js

let currentAngle = 0;
let spinning = false;
let items = [];
let currentGroupTurn = 0;
let removeOnSpin = false;
let removedIndices = [];
let itemColors = [];
let lastWinner = null;
let soundEnabled = true;

window.addEventListener('DOMContentLoaded', () => {
  const itemsControl = document.getElementById('itemsControl');
  const settingsControl = document.getElementById('settingsControl');
  const groupsControl = document.getElementById('groupsControl');

  if (itemsControl && settingsControl && groupsControl) {
    itemsControl.parentNode.insertBefore(settingsControl, groupsControl);
  }

  settingsControl.innerHTML = `
  <h3>Settings</h3>
  <label><input type="checkbox" id="removeCheckbox"> Remove spin result</label><br>
  <label><input type="checkbox" id="soundToggle" checked> Sound on</label><br>
  <button id="resetRemovedBtn" style="width: 120px;">Reset Removed</button>
`;

  const removeCheckbox = document.getElementById('removeCheckbox');
  const resetBtn = document.getElementById('resetRemovedBtn');
  const soundToggle = document.getElementById('soundToggle');

  removeCheckbox.addEventListener('change', e => removeOnSpin = e.target.checked);
  resetBtn.addEventListener('click', () => { removedIndices = []; lastWinner = null; updateWheel(); });
  soundToggle.addEventListener('change', () => { soundEnabled = soundToggle.checked; });

  const spinControl = document.getElementById('spinControl');
  const resultDisplay = document.getElementById('result');
  spinControl.appendChild(resultDisplay);
});

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const itemsInput = document.getElementById('itemsInput');
const resultDisplay = document.getElementById('result');
const spinSound = document.getElementById('spinSound');
const resultSound = document.getElementById('resultSound');
const setGroupsBtn = document.getElementById('setGroupsBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const numGroupsInput = document.getElementById('numGroupsInput');
const groupsContainer = document.getElementById('groupsContainer');

function degToRad(deg) { return deg * Math.PI / 180; }
function randomPastel() { return `hsl(${Math.floor(Math.random()*360)},70%,85%)`; }
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  lines.push(line);
  return lines;
}

function getItems() { return itemsInput.value.split('\n').map(l=>l.trim()).filter(Boolean); }
function parseItem(str) { const m = str.match(/^(.*)\s*\((\d+)\)/); return m ? { text: m[1].trim(), points: +m[2] } : { text: str, points: 0 }; }
function getActiveIndices() { return items.map((_,i) => i).filter(i => !removedIndices.includes(i)); }

function drawWheel(rotation) {
  const w = canvas.width, h = canvas.height, cx = w/2, cy = h/2, r = Math.min(cx,cy) - 10;
  ctx.clearRect(0,0,w,h);
  const active = getActiveIndices(); if (!active.length) return;
  const slice = 360 / active.length;

  active.forEach((orig,i) => {
    const midAngle = degToRad(rotation + i*slice + slice/2);
    ctx.fillStyle = itemColors[orig] || randomPastel();
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,degToRad(rotation + i*slice), degToRad(rotation + (i+1)*slice));
    ctx.fill(); ctx.stroke();

    const parsed = parseItem(items[orig]);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(midAngle);

    const maxWidth = r * 0.5;
    const halfSliceRad = degToRad(slice/2);
    const maxHeight = 2 * maxWidth * Math.sin(halfSliceRad);
    let fontSize = 24; const minFont = 10;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#333';

    ctx.font = `${fontSize}px Poppins, sans-serif`;
    let lines = wrapText(ctx, parsed.text, maxWidth);
    let lineHeight = fontSize * 1.2;
    while (fontSize > minFont && (lines.some(l => ctx.measureText(l).width > maxWidth) || lines.length * lineHeight > maxHeight)) {
      fontSize--; ctx.font = `${fontSize}px Poppins, sans-serif`; lines = wrapText(ctx, parsed.text, maxWidth); lineHeight = fontSize * 1.2;
    }
    lines.forEach((line,j) => ctx.fillText(line, r * 0.5, (j - (lines.length - 1) / 2) * lineHeight));
    ctx.restore();

    if (parsed.points) {
      const x = cx + Math.cos(midAngle) * (r * 0.95);
      const y = cy + Math.sin(midAngle) * (r * 0.95);
      ctx.save(); ctx.translate(x, y); ctx.rotate(midAngle + Math.PI/2);
      ctx.fillStyle = '#333'; ctx.font = 'bold 16px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(parsed.points, 0, 0);
      ctx.restore();
    }
  });

  ctx.fillStyle = 'red'; ctx.beginPath(); ctx.arc(cx + r + 10, cy, 8, 0, Math.PI*2); ctx.fill();
}

function updateWheel() { items = getItems(); itemColors = items.map(() => randomPastel()); drawWheel(currentAngle); }

function finishSpin(finalAngle, active) {
  spinning = false; spinBtn.disabled = false;
  currentAngle = finalAngle % 360;
  const slice = 360 / active.length;
  const win = Math.floor(((-currentAngle + 360) % 360) / slice);
  const orig = active[win]; lastWinner = orig;

  const parsed = parseItem(items[orig]);
  resultDisplay.innerHTML = `Result: ${parsed.text}`;

  const groups = groupsContainer.querySelectorAll('.group-score');
  if (groups.length > 0) {
    const currentGroup = groups[currentGroupTurn];
    const currentScore = parseInt(currentGroup.textContent) || 0;
    currentGroup.textContent = currentScore + parsed.points;

    groupsContainer.querySelectorAll('.group-input').forEach(g => g.classList.remove('active-turn'));
    currentGroupTurn = (currentGroupTurn + 1) % groups.length;
    groupsContainer.children[currentGroupTurn].classList.add('active-turn');
  }

  updateWheel();
  if (soundEnabled) resultSound.play();
}

function spin() {
  if (spinning) return;
  if (removeOnSpin && lastWinner !== null) { removedIndices.push(lastWinner); lastWinner = null; updateWheel(); }
  items = getItems(); if (!items.length) { alert('Enter at least one item.'); return; }
  spinning = true; spinBtn.disabled = true; resultDisplay.textContent='Result:';
  if (soundEnabled) spinSound.play();
  const active = getActiveIndices(); if (!active.length) { alert('No active slices!'); spinning=false; spinBtn.disabled=false; return; }
  const total = 360*(3+Math.floor(Math.random()*4))+Math.random()*360; const start=performance.now();
  function animate(now) { const p=Math.min((now-start)/5000,1); drawWheel(currentAngle+total*(1-Math.pow(1-p,3))); if(p<1) requestAnimationFrame(animate); else finishSpin(currentAngle+total, active); }
  requestAnimationFrame(animate);
}

function createGroups() {
  const n = +numGroupsInput.value;
  groupsContainer.innerHTML = '';
  if (n <= 0) return;
  currentGroupTurn = 0;
  for (let i = 0; i < n; i++) {
    const box = document.createElement('div');
    box.className = 'group-input';

    const name = document.createElement('div');
    name.className = 'group-name';
    name.textContent = `Group ${i+1}`;
    name.addEventListener('dblclick', () => {
      const nm = prompt('Enter new group name', name.textContent);
      if (nm) name.textContent = nm;
    });

    const score = document.createElement('div');
    score.className = 'group-score';
    score.textContent = '0';

    box.appendChild(name);
    box.appendChild(score);
    groupsContainer.appendChild(box);
  }
  if (groupsContainer.firstChild) groupsContainer.firstChild.classList.add('active-turn');
}

function clearAllPoints(){ groupsContainer.querySelectorAll('.group-score').forEach(e => e.textContent = '0'); }

spinBtn.addEventListener('click', spin);
itemsInput.addEventListener('input', updateWheel);
setGroupsBtn.addEventListener('click', createGroups);
clearAllBtn.addEventListener('click', clearAllPoints);

updateWheel();

function createGroups() {
  let n = +numGroupsInput.value;
  if (n > 8) n = 8; // enforce max in code
  groupsContainer.innerHTML = '';
  if (n <= 0) return;

  currentGroupTurn = 0;

  for (let i = 0; i < n; i++) {
    const box = document.createElement('div');
    box.className = 'group-input';

    const name = document.createElement('div');
    name.className = 'group-name';
    name.textContent = `Group ${i+1}`;
    name.addEventListener('dblclick', () => {
      const nm = prompt('Enter new group name', name.textContent);
      if (nm) name.textContent = nm;
    });

    const score = document.createElement('div');
    score.className = 'group-score';
    score.textContent = '0';

    box.appendChild(name);
    box.appendChild(score);
    groupsContainer.appendChild(box);
  }

  if (groupsContainer.firstChild) {
    groupsContainer.firstChild.classList.add('active-turn');
  }
}
