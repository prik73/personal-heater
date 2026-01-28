import './style.css';

interface CoreState {
  id: number;
  worker: Worker | null;
  load: number;
  ops: number;
}

const app = document.querySelector<HTMLDivElement>('#app')!;
const coreCount = navigator.hardwareConcurrency || 4;
const cores: CoreState[] = [];
// --- HTML Injection ---
app.innerHTML = `
  <header>
    <h1>CPU STRESSOR</h1>
    <div class="subtitle">Dynamic Load Generator V2 <br><span class="heater-text">Personal Heater it is :)</span></div>
    
    <div class="mode-switcher">
        <button id="btn-mode-simple" class="mode-btn active">SIMPLE</button>
        <button id="btn-mode-pro" class="mode-btn">PRO</button>
    </div>

    <div class="global-stats-container">
       <div class="stat-box">
          <div class="stat-label">TOTAL POWER</div>
          <div class="stat-value" id="total-load">0</div>
          <div class="stat-unit">OPS / SEC</div>
       </div>
    </div>
  </header>

  <!-- SIMPLE VIEW -->
  <div id="view-simple" class="view-section visible">
    <div class="master-control">
        <div style="display:flex; justify-content:space-between; margin-botftom:1rem;">
            <strong>MASTER CONTROL</strong>
            <span id="master-val">0%</span>
        </div>
        <input type="range" id="master-slider" min="0" max="100" value="0">
    </div>

    <div class="simple-list" id="simple-list"></div>
  </div>

  <!-- PRO VIEW -->
  <div id="view-pro" class="view-section">
    <div class="dashboard-grid" id="pro-grid"></div>
    
    <div style="display:flex; gap:1rem; justify-content:center; margin-top:2rem;">
        <button id="pro-stress-all" style="padding:10px 20px; background:#ff0055; border:none; color:white; border-radius:4px; font-weight:bold; cursor:pointer;">MAX ALL</button>
        <button id="pro-stop-all" style="padding:10px 20px; background:#00ff88; border:none; color:black; border-radius:4px; font-weight:bold; cursor:pointer;">STOP ALL</button>
    </div>
  </div>
  <div class="credits">
    made in supercold weather by <a href="https://prik.dev" target="_blank">prik</a>
  </div>
`;

// --- Elements ---
const viewSimple = document.getElementById('view-simple')!;
const viewPro = document.getElementById('view-pro')!;
const btnSimple = document.getElementById('btn-mode-simple')!;
const btnPro = document.getElementById('btn-mode-pro')!;
const totalLoadEl = document.getElementById('total-load')!;

// --- Initialization ---
function initCore(i: number) {
  // Start worker immediately but at 0 load
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  worker.postMessage({ type: 'start' });
  worker.postMessage({ type: 'load', value: 0 }); // Idle start

  const core: CoreState = {
    id: i,
    worker,
    load: 0,
    ops: 0
  };

  worker.onmessage = (e) => {
    if (e.data.type === 'stats') {
      core.ops = e.data.ops;
      updateStatsUI(core);
    }
  };

  cores.push(core);

  // Render Pro Card
  const proGrid = document.getElementById('pro-grid')!;
  const card = document.createElement('div');
  card.className = 'core-card';
  card.id = `pro-card-${i}`;
  card.innerHTML = `
        <div class="core-icon">⚡</div>
        <div class="core-label">CORE ${i}</div>
        <div class="core-speed" id="pro-speed-${i}">0 OPS</div>
    `;
  card.addEventListener('click', () => toggleProCore(i));
  proGrid.appendChild(card);

  // Render Simple Row
  const simpleList = document.getElementById('simple-list')!;
  const row = document.createElement('div');
  row.className = 'simple-core-row';
  row.innerHTML = `
        <div class="row-label">Core ${i}</div>
        <input type="range" class="row-slider" id="slider-${i}" min="0" max="100" value="0">
        <div class="row-val" id="val-${i}">0%</div>
    `;
  simpleList.appendChild(row);

  // Slider Logic
  const slider = document.getElementById(`slider-${i}`) as HTMLInputElement;
  const valDisplay = document.getElementById(`val-${i}`)!;

  slider.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    setCoreLoad(i, val);
    valDisplay.textContent = `${val}%`;
  });
}

for (let i = 0; i < coreCount; i++) initCore(i);


// --- Logic ---

function setCoreLoad(index: number, load: number) {
  const core = cores[index];
  core.load = load;
  core.worker?.postMessage({ type: 'load', value: load });

  // Sync UI elements
  // Sync Pro Card visual
  const card = document.getElementById(`pro-card-${index}`)!;
  if (load > 0) card.classList.add('active');
  else card.classList.remove('active');

  // Sync Simple Slider visual (if change came from outside)
  const slider = document.getElementById(`slider-${index}`) as HTMLInputElement;
  if (slider.value != String(load)) {
    slider.value = String(load);
    document.getElementById(`val-${index}`)!.textContent = `${load}%`;
  }
}

function updateStatsUI(core: CoreState) {
  // Update Global
  const totalOps = cores.reduce((acc, c) => acc + c.ops, 0);
  totalLoadEl.textContent = totalOps.toLocaleString();

  // Update Pro Card
  const speedEl = document.getElementById(`pro-speed-${core.id}`);
  if (speedEl) speedEl.textContent = `${(core.ops / 1000).toFixed(1)}k`;
}

function toggleProCore(index: number) {
  // Binary toggle for Pro Mode
  const core = cores[index];
  const newLoad = core.load > 0 ? 0 : 100;
  setCoreLoad(index, newLoad);
}

// --- Global Controls ---

// Mode Switching
btnSimple.addEventListener('click', () => setMode('simple'));
btnPro.addEventListener('click', () => setMode('pro'));

function setMode(mode: 'simple' | 'pro') {
  // currentMode = mode; // Unused
  if (mode === 'simple') {
    viewSimple.classList.add('visible');
    viewPro.classList.remove('visible');
    btnSimple.classList.add('active');
    btnPro.classList.remove('active');
  } else {
    viewSimple.classList.remove('visible');
    viewPro.classList.add('visible');
    btnSimple.classList.remove('active');
    btnPro.classList.add('active');
  }
}

// Master Slider
const masterSlider = document.getElementById('master-slider') as HTMLInputElement;
const masterVal = document.getElementById('master-val')!;

masterSlider.addEventListener('input', (e) => {
  const val = parseInt((e.target as HTMLInputElement).value);
  masterVal.textContent = `${val}%`;

  // Set all cores
  cores.forEach(c => setCoreLoad(c.id, val));
});

// Pro Buttons
document.getElementById('pro-stress-all')?.addEventListener('click', () => {
  cores.forEach(c => setCoreLoad(c.id, 100));
  masterSlider.value = "100";
  masterVal.textContent = "100%";
});

document.getElementById('pro-stop-all')?.addEventListener('click', () => {
  cores.forEach(c => setCoreLoad(c.id, 0));
  masterSlider.value = "0";
  masterVal.textContent = "0%";
});
