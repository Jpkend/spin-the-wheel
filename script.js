// ===== DOM References =====
const itemsTable       = document.getElementById('itemsTable');
const addRowBtn        = document.getElementById('addRowBtn');
const updateWheelBtn   = document.getElementById('updateWheelBtn');
const removeCb         = document.getElementById('removeCheckbox');

const numGroupsInput   = document.getElementById('numGroupsInput');
const setGroupsBtn     = document.getElementById('setGroupsBtn');
const clearAllBtn      = document.getElementById('clearAllBtn');
const groupsContainer  = document.getElementById('groupsContainer');

const spinBtn          = document.getElementById('spinBtn');
const turnIndicator    = document.getElementById('turnIndicator');
const resultEl         = document.getElementById('result');

const spinSound        = document.getElementById('spinSound');
const resultSound      = document.getElementById('resultSound');

const wheelCanvas      = document.getElementById('wheel');
const ctx              = wheelCanvas.getContext('2d');

// ===== Data Structures =====
let items = [];           // array of { label, points, color }
let excludedLabels = [];  // items "removed" from the wheel
let groups = [];          // array of { name, score, scoreEl }
let currentGroupIndex = 0;
let currentRotation = 0;  // in degrees
let isSpinning = false;
let pendingRemoval = null; // label to remove from wheel on next spin

// ====== UTILS ======
function randomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 85%)`;
}

// Row distribution for grouping
function getRowDistribution(n) {
  if (n === 0) return [];
  if (n <= 4) return [n];
  switch (n) {
    case 5: return [3,2];
    case 6: return [3,3];
    case 7: return [4,3];
    case 8: return [4,4];
    default:
      let dist = [];
      let remaining = n;
      while (remaining >= 4) {
        dist.push(4);
        remaining -= 4;
      }
      if (remaining > 0) dist.push(remaining);
      return dist;
  }
}

// ====== Items Table ======
function addTableRow(labelValue = '', pointsValue = '') {
  const tbody = itemsTable.querySelector('tbody');
  const row = document.createElement('tr');

  // Label cell with placeholder
  const labelTd = document.createElement('td');
  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.value = labelValue;
  labelInput.placeholder = 'Slice name';
  labelTd.appendChild(labelInput);

  // Points cell
  const pointsTd = document.createElement('td');
  const pointsInput = document.createElement('input');
  pointsInput.type = 'number';
  pointsInput.value = pointsValue;
  pointsTd.appendChild(pointsInput);

  // Remove button
  const removeTd = document.createElement('td');
  const removeBtn = document.createElement('button');
  removeBtn.className = 'removeRowBtn';
  removeBtn.textContent = 'X';
  removeBtn.addEventListener('click', () => {
    row.remove();
  });
  removeTd.appendChild(removeBtn);

  row.appendChild(labelTd);
  row.appendChild(pointsTd);
  row.appendChild(removeTd);
  tbody.appendChild(row);

  // Press Enter in Label => go to Points
  labelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pointsInput.focus();
    }
  });
  // Press Enter in Points => add a new row
  pointsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTableRow('', '');
      const allRows = itemsTable.querySelectorAll('tbody tr');
      if (allRows.length) {
        const lastRow = allRows[allRows.length - 1];
        const newLabel = lastRow.cells[0].querySelector('input');
        newLabel.focus();
      }
    }
  });
}

function parseItemsFromTable() {
  items = [];
  const rows = itemsTable.querySelectorAll('tbody tr');
  rows.forEach(r => {
    const labelInput  = r.cells[0].querySelector('input');
    const pointsInput = r.cells[1].querySelector('input');
    const label = labelInput.value.trim();
    const pts   = parseInt(pointsInput.value, 10) || 0;

    if (label && !excludedLabels.includes(label)) {
      items.push({
        label: label,
        points: pts,
        color: randomPastelColor()
      });
    }
  });
}

// ====== Groups Logic ======
function createGroups(n) {
  groups = [];
  for (let i = 0; i < n; i++) {
    groups.push({ name: `Group ${i+1}`, score: 0, scoreEl: null });
  }
}

function clearAllScores() {
  groups.forEach(g => g.score = 0);
  renderGroupsUI();
}

function renderGroupsUI() {
  groupsContainer.innerHTML = '';
  if (groups.length === 0) {
    turnIndicator.style.display = 'none'; // hide if 0 groups
    return;
  } else {
    turnIndicator.style.display = 'inline';
  }

  const dist = getRowDistribution(groups.length);
  let index = 0;

  dist.forEach(rowCount => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'group-row';

    for (let i = 0; i < rowCount; i++) {
      const g = groups[index];
      index++;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'group-input';

      // highlight if it's the current group
      if (index - 1 === currentGroupIndex) {
        groupDiv.classList.add('active-turn');
      }

      // name input
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = g.name;
      nameInput.className = 'group-name';
      nameInput.addEventListener('input', () => {
        g.name = nameInput.value;
        updateTurnIndicator();
      });

      // score display
      const scoreEl = document.createElement('div');
      scoreEl.className = 'group-score';
      scoreEl.textContent = g.score;
      g.scoreEl = scoreEl;

      groupDiv.appendChild(nameInput);
      groupDiv.appendChild(scoreEl);
      rowDiv.appendChild(groupDiv);
    }
    groupsContainer.appendChild(rowDiv);
  });

  updateTurnIndicator();
}

function highlightCurrentGroup() {
  if (!groups.length) {
    turnIndicator.style.display = 'none';
    return;
  }
  turnIndicator.style.display = 'inline';

  const groupBoxes = groupsContainer.querySelectorAll('.group-input');
  groupBoxes.forEach(box => box.classList.remove('active-turn'));
  if (groupBoxes[currentGroupIndex]) {
    groupBoxes[currentGroupIndex].classList.add('active-turn');
  }
}

function updateGroupScoreDisplay(groupIndex) {
  if (groups[groupIndex] && groups[groupIndex].scoreEl) {
    groups[groupIndex].scoreEl.textContent = groups[groupIndex].score;
  }
}

function updateTurnIndicator() {
  if (!groups.length) {
    turnIndicator.style.display = 'none';
    return;
  }
  turnIndicator.style.display = 'inline';
  const g = groups[currentGroupIndex];
  turnIndicator.textContent = `${g.name}'s Turn`;
}

// ====== Wheel Drawing ======
function drawWheel() {
  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  if (!items.length) {
    ctx.beginPath();
    ctx.arc(250, 250, 250, 0, 2 * Math.PI);
    ctx.fillStyle = '#eee';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  const sliceAngle = 360 / items.length;
  for (let i = 0; i < items.length; i++) {
    const startDeg = i * sliceAngle + currentRotation;
    const endDeg   = startDeg + sliceAngle;
    const startRad = (startDeg * Math.PI) / 180;
    const endRad   = (endDeg   * Math.PI) / 180;

    // slice
    ctx.beginPath();
    ctx.moveTo(250, 250);
    ctx.arc(250, 250, 250, startRad, endRad);
    ctx.fillStyle = items[i].color;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // label
    ctx.save();
    ctx.translate(250, 250);
    ctx.rotate((startRad + endRad) / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#000';
    ctx.font = '16px sans-serif';
    ctx.fillText(items[i].label, 220, 5);
    ctx.restore();
  }

  // outer circle
  ctx.beginPath();
  ctx.arc(250, 250, 250, 0, 2 * Math.PI);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ====== Spin Logic ======
function spinWheel() {
  if (isSpinning) return;

  // If there's a pending removal, exclude that label
  if (pendingRemoval && removeCb.checked) {
    if (!excludedLabels.includes(pendingRemoval)) {
      excludedLabels.push(pendingRemoval);
    }
  }
  pendingRemoval = null;

  parseItemsFromTable();
  if (!items.length) {
    alert('No items to spin for!');
    drawWheel();
    return;
  }

  isSpinning = true;
  // remove arrow from the text => just "Result:"
  resultEl.textContent = 'Result:';

  spinSound.currentTime = 0;
  spinSound.play();

  // 3 full spins + up to 360 deg
  const extraDegrees = 1080 + Math.floor(Math.random() * 360);
  const startRotation = currentRotation;
  const endRotation   = currentRotation + extraDegrees;
  const duration      = 3000;
  const startTime     = performance.now();

  function animateSpin(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // ease-out cubic
    const t = 1 - Math.pow(1 - progress, 3);
    const current = startRotation + (endRotation - startRotation) * t;
    currentRotation = current % 360;

    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animateSpin);
    } else {
      // done spinning
      isSpinning = false;
      spinSound.pause();
      resultSound.currentTime = 0;
      resultSound.play();

      const sliceAngle = 360 / items.length;
      let pointerAngle = (360 - currentRotation) % 360;
      let index = Math.floor(pointerAngle / sliceAngle);
      if (index < 0) index = 0;
      if (index >= items.length) index = items.length - 1;

      const landedItem = items[index];
      if (landedItem) {
        // If points>0, show (X pts); otherwise omit
        const ptsStr = landedItem.points > 0 ? ` (${landedItem.points} pts)` : '';
        resultEl.textContent = `Result: ${landedItem.label}${ptsStr}`;

        // if we have groups, add points
        if (groups.length > 0 && groups[currentGroupIndex]) {
          groups[currentGroupIndex].score += landedItem.points;
          updateGroupScoreDisplay(currentGroupIndex);
        }
        pendingRemoval = landedItem.label;
      }

      // next group's turn
      if (groups.length > 0) {
        currentGroupIndex = (currentGroupIndex + 1) % groups.length;
      }
      updateTurnIndicator();
      highlightCurrentGroup();
    }
  }

  requestAnimationFrame(animateSpin);
}

// ====== Event Listeners ======
addRowBtn.addEventListener('click', () => {
  addTableRow('', '');
});

updateWheelBtn.addEventListener('click', () => {
  excludedLabels = [];
  pendingRemoval = null;
  parseItemsFromTable();
  drawWheel();
});

setGroupsBtn.addEventListener('click', () => {
  const n = parseInt(numGroupsInput.value, 10) || 0;
  createGroups(n);
  currentGroupIndex = 0;
  renderGroupsUI();
  parseItemsFromTable();
  drawWheel();
});

clearAllBtn.addEventListener('click', () => {
  clearAllScores();
});

spinBtn.addEventListener('click', spinWheel);

// ====== Initial Setup ======
addTableRow('', '10'); // single row w/ placeholder label, 10 points
createGroups(2);       // default 2 groups
renderGroupsUI();

parseItemsFromTable();
drawWheel();