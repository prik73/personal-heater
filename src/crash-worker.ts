// Store received data to prevent Garbage Collection
const keepAlive: any[] = [];

// Listen for the "port" from main thread
self.onmessage = (e) => {
    if (e.data.type === 'init') {
        const port = e.data.port as MessagePort;

        // Start the hot potato game
        port.onmessage = (msg) => {
            // 1. Keep a reference effectively doubling the RAM usage of the payload immediately
            keepAlive.push(msg.data);

            // 2. Clone it and send it back (Structured Clone Algorithm forces a deep copy)
            // We append some local noise to make it grow
            const payload = msg.data;

            // Add local noise to grow the payload size
            const noise = new Array(100000).fill(Math.random());

            // Send back to the other worker (or self if loopback)
            port.postMessage({ payload, noise });
        };
    }
};
