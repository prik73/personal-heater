// Worker script to generate dynamic CPU load

let isRunning = false;
let targetLoad = 100; // Default to 100%

self.onmessage = (e: MessageEvent) => {
    const { type, value } = e.data;

    if (type === 'start') {
        if (isRunning) return;
        isRunning = true;
        console.log(`[Worker] Starting with load: ${targetLoad}%`);
        runLoop();

    } else if (type === 'stop') {
        isRunning = false;
        console.log(`[Worker] Stopping`);

    } else if (type === 'load') {
        targetLoad = Math.max(0, Math.min(100, value));
        // console.log(`[Worker] Load target updated to: ${targetLoad}%`);
    }
};

let ops = 0;
let lastReportTime = Date.now();
// Throttle log messages
let lastLogTime = 0;

const runLoop = () => {
    if (!isRunning) return;

    // Duty Cycle Logic
    // We operate on a roughly 100ms cycle
    // If load is 50%, we work 50ms, sleep 50ms.

    // Safety check removed to allow reporting of 0 ops
    // if (targetLoad === 0) { ... }

    const cycleDuration = 100; // ms
    const workDuration = Math.floor((targetLoad / 100) * cycleDuration);
    const startCycle = Date.now();

    // Log periodically what we are doing
    if (Date.now() - lastLogTime > 3000) {
        console.log(`[Worker] Crunching Math.sqrt() on random vectors at ${targetLoad}% load...`);
        lastLogTime = Date.now();
    }

    // Heavy Work Loop
    // Work until 'workDuration' has passed
    while (Date.now() - startCycle < workDuration) {
        // High density workload
        // Unrolling loop slightly for efficiency
        for (let i = 0; i < 500; i++) {
            Math.sqrt(Math.random() * 999999);
            ops++;
        }
    }

    // Reporting Logic
    const now = Date.now();
    if (now - lastReportTime >= 1000) {
        self.postMessage({ type: 'stats', ops: ops });
        ops = 0;
        lastReportTime = now;
    }

    // Calculate remaining time in the cycle to sleep
    const elapsed = Date.now() - startCycle;
    const sleepDuration = Math.max(0, cycleDuration - elapsed);

    // Schedule next cycle
    if (isRunning) {
        setTimeout(runLoop, sleepDuration);
    }
};
