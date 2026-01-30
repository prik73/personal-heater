import './style.css';
import { inject } from '@vercel/analytics';


inject();

interface CoreState {
  id: number;
  worker: Worker | null;
  load: number;
  ops: number;
}

const app = document.querySelector<HTMLDivElement>('#app')!;
const urlParams = new URLSearchParams(window.location.search);
const coreCount = parseInt(urlParams.get('cores') || '') || navigator.hardwareConcurrency || 4;
const cores: CoreState[] = [];
// currentMode removed as it was unused state

// --- HTML Injection ---
app.innerHTML = `
  <header>
    <h1>CPU STRESSOR</h1>
    <div class="subtitle">Dynamic Load Generator V2 <br><span class="heater-text">Personal Heater it is :)</span></div>
    <div class="monitor-hint">
      Use Task Manager / htop / Activity Monitor to verify load<br>
      (or just wait for the fans to spin up.) <br>
      <small style="opacity:0.7">Running ${coreCount} threads (Browser detected: ${navigator.hardwareConcurrency || 'Unknown'})</small>
    </div>
    
    <div class="mode-switcher">
        <button id="btn-mode-simple" class="mode-btn active">SIMPLE</button>
        <button id="btn-mode-pro" class="mode-btn">PRO</button>
        <button id="btn-mode-crash" class="mode-btn danger-btn">CRASH</button>
    </div>

    <div class="global-stats-container">
       <button id="btn-info" class="info-btn" aria-label="Information">i</button>
       <div class="stat-box">
          <div class="stat-label">TOTAL POWER</div>
          <div class="stat-value" id="total-load">0</div>
          <div class="stat-unit">OPS / SEC</div>
       </div>
    </div>
  </header>

  <!-- INFO VIEW -->
  <div id="view-info" class="view-section overlay-view">
    <div class="info-content">
        <button id="btn-close-info" class="close-btn">×</button>
        <h2>Under the Hood</h2>
        <p>This application creates <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers" target="_blank" style="color:var(--text-color); text-decoration:underline;">Web Workers</a> to run simple math.random calculations on purely separate threads.(from browser's pov)</p>
        
        <div class="info-stats">
            <div class="stat-row">
                <span>Browser Detected Cores:</span>
                <strong>${navigator.hardwareConcurrency || 'Unknown'}</strong>
            </div>
            <div class="stat-row">
                <span>Active Workers:</span>
                <strong>${coreCount}</strong>
            </div>
        </div>

        <h3>Advanced Control</h3>
        <p>You can override the number of threads by adding <code>?cores=N</code> to the URL.</p>
        
        <div class="quick-actions">
            <p>Try these presets:</p>
            <div class="action-buttons">
                <a href="/?cores=1" class="preset-btn">1 Core (Single Thread)</a>
                <a href="/?cores=4" class="preset-btn">4 Cores</a>
                <a href="/?cores=${navigator.hardwareConcurrency || 16}" class="preset-btn">Max Cores (${navigator.hardwareConcurrency || 16})</a>
            </div>
        </div>
    </div>
  </div>

  <!-- SIMPLE VIEW -->
  <div id="view-simple" class="view-section visible">
    <div class="master-control">
        <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
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

  <!-- CRASH VIEW -->
  <div id="view-crash" class="view-section">
      <div class="crash-container">
        <h2>MEMORY OVERLOAD</h2>
        <p>This will allocate infinite arrays until this specific <strong>browser tab</strong> crashes.</p>
        
      </div>
      <div class="crash-controls">
          <button id="crash-ignite" class="crash-btn">crash this tab</button>
      </div>
  </div>

  <div class="credits">
    made in supercold weather by <a href="https://prik.dev" target="_blank">prik</a>
  </div>
`;

// --- Elements ---
const viewSimple = document.getElementById('view-simple')!;
const viewPro = document.getElementById('view-pro')!;
const viewCrash = document.getElementById('view-crash')!;
const btnSimple = document.getElementById('btn-mode-simple')!;
const btnPro = document.getElementById('btn-mode-pro')!;
const btnCrash = document.getElementById('btn-mode-crash')!;
const totalLoadEl = document.getElementById('total-load')!;
const btnInfo = document.getElementById('btn-info')!;
const viewInfo = document.getElementById('view-info')!;
const btnCloseInfo = document.getElementById('btn-close-info')!;

btnInfo.addEventListener('click', () => {
  viewInfo.classList.add('visible');
});

btnCloseInfo.addEventListener('click', () => {
  viewInfo.classList.remove('visible');
});

// Close when clicking outside content
viewInfo.addEventListener('click', (e) => {
  if (e.target === viewInfo) {
    viewInfo.classList.remove('visible');
  }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && viewInfo.classList.contains('visible')) {
    viewInfo.classList.remove('visible');
  }
});

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
// --- Crash Logic ---
document.getElementById('crash-ignite')?.addEventListener('click', () => {
  if (!confirm("This will freeze and crash this tab. Are you sure?")) return;

  // Create two workers
  console.log("Spawning workers...");
  const w1 = new Worker(new URL('./crash-worker.ts', import.meta.url), { type: 'module' });
  const w2 = new Worker(new URL('./crash-worker.ts', import.meta.url), { type: 'module' });

  // Create a direct communication channel between them
  const channel = new MessageChannel();

  // Seed the chaos - sending to port1 puts it in port2's queue (so w2 will get it)
  console.log("Seeding channel...");
  channel.port1.postMessage("SEED PAYLOAD TO START THE CHAOS");

  // Send ports to workers
  console.log("Transferring ports...");
  w1.postMessage({ type: 'init', port: channel.port1 }, [channel.port1]);
  w2.postMessage({ type: 'init', port: channel.port2 }, [channel.port2]);

  // Let's add more workers for more chaos
  const w3 = new Worker(new URL('./crash-worker.ts', import.meta.url), { type: 'module' });
  const w4 = new Worker(new URL('./crash-worker.ts', import.meta.url), { type: 'module' });
  const channel2 = new MessageChannel();

  channel2.port1.postMessage("SEED 2");
  w3.postMessage({ type: 'init', port: channel2.port1 }, [channel2.port1]);
  w4.postMessage({ type: 'init', port: channel2.port2 }, [channel2.port2]);

  document.getElementById('crash-ignite')!.innerText = "MELTING... 💀";
});


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
btnCrash.addEventListener('click', () => setMode('crash'));

function setMode(mode: 'simple' | 'pro' | 'crash') {
  // Hide all
  viewSimple.classList.remove('visible');
  viewPro.classList.remove('visible');
  viewCrash.classList.remove('visible');

  btnSimple.classList.remove('active');
  btnPro.classList.remove('active');
  btnCrash.classList.remove('active');

  // Show selected
  if (mode === 'simple') {
    viewSimple.classList.add('visible');
    btnSimple.classList.add('active');
  } else if (mode === 'pro') {
    viewPro.classList.add('visible');
    btnPro.classList.add('active');
  } else {
    viewCrash.classList.add('visible');
    btnCrash.classList.add('active');
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
