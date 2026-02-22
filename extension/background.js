let ws = null;

function connectWebSocket() {
    // Connect to the local CLI's WebSocket server
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        console.log('[atcoder-tools-mini] WebSocket connected!');
    };

    ws.onmessage = (event) => {
        console.log('[atcoder-tools-mini] Message received:', event.data);
        try {
            const data = JSON.parse(event.data);
            if (data.action === 'submit') {
                console.log('[atcoder-tools-mini] Submission request received:', data);
                // Here we will eventually trigger the submission
                // Example: executeScript in the current tab or fetch logic
            }
        } catch (e) {
            console.error('[atcoder-tools-mini] Error parsing message:', e);
        }
    };

    ws.onclose = () => {
        console.log('[atcoder-tools-mini] WebSocket disconnected. Reconnecting in 5 seconds...');
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('[atcoder-tools-mini] WebSocket error:', error);
        ws.close();
    };
}

// Start connection loop
connectWebSocket();
