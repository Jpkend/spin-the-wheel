/*********************************************************************
 * script.js
 *
 * Spin the Wheel Tool with Teams using a single textarea input.
 * Each line in the textarea should be: Item name (points)
 * Example: What is your name? (100)
 *
 * The wheel spins for 3 seconds and the winning item’s points
 * are added to the current team’s score. Optionally, the winning
 * item is removed from the list.
 *********************************************************************/

// DOM Elements
const itemsInput = document.getElementById("itemsInput");
const spinBtn = document.getElementById("spinBtn");
const wheelCanvas = document.getElementById("wheel");
const resultEl = document.getElementById("result");
const spinSound = document.getElementById("spinSound");
const bellSound = document.getElementById("bellSound");
const numGroupsInput = document.getElementById("numGroupsInput");
const setGroupsBtn = document.getElementById("setGroupsBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const turnIndicator = document.getElementById("turnIndicator");
const groupsContainer = document.getElementById("groupsContainer");

const ctx = wheelCanvas.getContext("2d");

let items = []; // array of objects { name, points }
let currentRotation = 0; // in radians
let isSpinning = false;
let pendingRemoval = null; // winning item's name to remove on next spin if checkbox is checked

// Teams (groups) variables
let groups = []; // array of objects { name, score, scoreEl }
let currentGroupIndex = 0;

// Story dice not used in this version (we're back to text items)

// Parse textarea input. Each line should be "Item (points)".
function parseItems() {
  const input = itemsInput.value;
  const lines = input.split("\n").map(line => line.trim()).filter(line => line.length > 0);
  const parsed = lines.map(line => {
    // Regex: capture text, optionally followed by points in parentheses.
    const match = line.match(/^(.*?)(?:\s*\((\d+)\))?$/);
    if (match) {
      const itemName = match[1].trim();
      const points = match[2] ? parseInt(match[2], 10) : 0;
      return { name: itemName, points: points };
    }
    return null;
  }).filter(item => item !== null);
  return parsed;
}

// Custom row distribution for the wheel slices.
function getRowDistribution(n) {
  switch (n) {
    case 1: return [1];
    case 2: return [2];
    case 3: return [3];
    case 4: return [2, 2];
    case 5: return [3, 2];
    case 6: return [3, 3];
    case 7: return [4, 3];
    case 8: return [4, 4];
    case 9: return [3, 3, 3];
    case 10: return [4, 3, 3];
  }
  // Fallback: 5 per row
  let rows = [];
  let remaining = n;
  const rowSize = 5;
  while (remaining > rowSize) {
    rows.push(rowSize);
    remaining -= rowSize;
  }
  if (remaining > 0) rows.push(remaining);
  return rows;
}

// Draw the wheel on the canvas
function drawWheel() {
  items = parseItems();
  const totalItems = items.length;
  const canvasSize = wheelCanvas.width;
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const radius = canvasSize / 2 - 2;

  ctx.clearRect(0, 0, canvasSize, canvasSize);

  if (totalItems === 0) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#eee";
    ctx.fill();
    ctx.stroke();
    return;
  }

  const sliceAngle = 2 * Math.PI / totalItems;
  for (let i = 0; i < totalItems; i++) {
    const startAngle = currentRotation + i * sliceAngle;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = getSliceColor(i, totalItems);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw slice label (item name)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#000";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(items[i].name, radius - 10, 10);
    ctx.restore();
  }
}

// Helper for numeric dice colors: use a set of grayscale values
function getSliceColor(index, total) {
  const grays = ["#000", "#222", "#444", "#666", "#888", "#aaa", "#ccc"];
  return grays[index % grays.length];
}

/* Teams functionality */
// Returns custom row distribution for teams, based on user requirements:
// 5 teams: first row 3, second row 2; 6 teams: 3+3; 8 teams: 4+4; etc.
function getGroupRowDistribution(n) {
  switch(n) {
    case 1: return [1];
    case 2: return [2];
    case 3: return [3];
    case 4: return [4];
    case 5: return [3, 2];
    case 6: return [3, 3];
    case 7: return [4, 3];
    case 8: return [4, 4];
    default:
      let arr = [];
      let rem = n;
      while(rem >= 4) {
        arr.push(4);
        rem -= 4;
      }
      if(rem > 0) arr.push(rem);
      return arr;
  }
}

function createGroups(n) {
  groups = [];
  for (let i = 0; i < n; i++) {
    groups.push({ name: `Group ${i+1}`, score: 0, scoreEl: null });
  }
}

function renderGroupsUI() {
  groupsContainer.innerHTML = "";
  if (groups.length === 0) {
    turnIndicator.style.display = "none";
  } else {
    turnIndicator.style.display = "inline";
  }
  const dist = getGroupRowDistribution(groups.length);
  let index = 0;
  dist.forEach(rowCount => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "group-row";
    for (let i = 0; i < rowCount; i++) {
      const g = groups[index];
      index++;
      const groupDiv = document.createElement("div");
      groupDiv.className = "group-input";
      if (index - 1 === currentGroupIndex) {
        groupDiv.classList.add("active-turn");
      }
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = g.name;
      nameInput.className = "group-name";
      nameInput.addEventListener("input", () => {
        g.name = nameInput.value;
        updateTurnIndicator();
      });
      const scoreEl = document.createElement("div");
      scoreEl.className = "group-score";
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

function updateTurnIndicator() {
  if (groups.length === 0) {
    turnIndicator.style.display = "none";
    return;
  }
  turnIndicator.style.display = "inline";
  turnIndicator.textContent = `${groups[currentGroupIndex].name}'s Turn`;
}

function clearAllScores() {
  groups.forEach(g => g.score = 0);
  renderGroupsUI();
}

function createOrUpdateTeams() {
  const n = parseInt(numGroupsInput.value, 10) || 0;
  createGroups(n);
  currentGroupIndex = 0;
  renderGroupsUI();
}

// Spin the wheel with animation
function spinWheel() {
  if (isSpinning) return;
  items = parseItems();
  if (items.length === 0) {
    alert("No items entered!");
    return;
  }
  isSpinning = true;
  spinSound.currentTime = 0;
  spinSound.play();

  // Spin for 3 seconds: at least 3 full rotations plus a random extra.
  const extraDegrees = 1080 + Math.floor(Math.random() * 360);
  const extraRads = extraDegrees * Math.PI / 180;
  const targetRotation = currentRotation + extraRads;
  const duration = 3000;
  const startTime = performance.now();

  function animateSpin(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    // Interpolate between currentRotation and targetRotation
    currentRotation = currentRotation + (targetRotation - currentRotation) * eased;
    drawWheel();
    if (progress < 1) {
      requestAnimationFrame(animateSpin);
    } else {
      isSpinning = false;
      spinSound.pause();
      bellSound.currentTime = 0;
      bellSound.play();

      // Determine winning slice.
      const totalItems = items.length;
      const sliceAngle = 2 * Math.PI / totalItems;
      // Assume pointer at top center (adjust by π/2 since 0 is to the right)
      let pointerAngle = (2 * Math.PI - currentRotation + Math.PI / 2) % (2 * Math.PI);
      let winningIndex = Math.floor(pointerAngle / sliceAngle);
      if (winningIndex < 0) winningIndex = 0;
      if (winningIndex >= totalItems) winningIndex = totalItems - 1;

      const winningItem = items[winningIndex];
      resultEl.textContent = "Result: " + winningItem.name + (winningItem.points > 0 ? " (" + winningItem.points + " pts)" : "");

      // Add points to current team (if any teams exist)
      if (groups.length > 0) {
        groups[currentGroupIndex].score += winningItem.points;
        renderGroupsUI();
        currentGroupIndex = (currentGroupIndex + 1) % groups.length;
        updateTurnIndicator();
      }

      // If removal checkbox is checked, remove winning item from the textarea.
      const removeCheckbox = document.getElementById("removeCheckbox");
      if (removeCheckbox.checked) {
        let lines = itemsInput.value.split("\n");
        lines = lines.filter(line => !line.startsWith(winningItem.name));
        itemsInput.value = lines.join("\n");
        drawWheel();
      }
    }
  }
  requestAnimationFrame(animateSpin);
}

// Event Listeners
spinBtn.addEventListener("click", spinWheel);
itemsInput.addEventListener("input", drawWheel);
document.getElementById("setGroupsBtn").addEventListener("click", createOrUpdateTeams);
document.getElementById("clearAllBtn").addEventListener("click", clearAllScores);

// Initialization
createOrUpdateTeams();
drawWheel();
