let ws = null;

function connectWebSocket() {
    // Connect to the local CLI's WebSocket server
    ws = new WebSocket('ws://localhost:49153');

    ws.onopen = () => {
        console.log('[atcoder-tools-mini] WebSocket connected!');
    };

    ws.onmessage = (event) => {
        console.log('[atcoder-tools-mini] Message received:', event.data);
        try {
            const data = JSON.parse(event.data);
            if (data.action === 'submit') {
                console.log('[atcoder-tools-mini] Submission request received:', data);
                // Execute fetch logic
                submitToAtCoder(data).catch(err => {
                    console.error('[atcoder-tools-mini] Error during submission:', err);
                });
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

async function submitToAtCoder(data) {
    const contestId = data.contest_id;
    if (!contestId) {
        throw new Error('contest_id is missing from the request data.');
    }

    const submitUrl = `https://atcoder.jp/contests/${contestId}/submit`;
    console.log(`[atcoder-tools-mini] Opening tab for ${submitUrl}`);

    // Create a new tab in the background (active: false means it won't steal focus!)
    const tab = await chrome.tabs.create({ url: submitUrl, active: false });

    // Wait for the tab to fully load
    await new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                // add a small delay to ensure DOM and CodeMirror are fully ready
                setTimeout(resolve, 500);
            }
        });
    });

    // Instead of relying on comfortable-atcoder, WE will monitor the submission!
    // This keeps the tool standalone but still gives the user the feedback they want.
    chrome.tabs.onUpdated.addListener(function closeListener(tabId, info, tabObj) {
        if (tabId === tab.id && info.status === 'complete' && tabObj.url && tabObj.url.includes('/submissions/me')) {
            console.log('[atcoder-tools-mini] Redirected to submissions page. Starting built-in monitor...');
            chrome.tabs.onUpdated.removeListener(closeListener);

            // Inject a script to pull the latest submission status
            const monitorInterval = setInterval(async () => {
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        func: () => {
                            // Find the top row of the submissions table (most recent)
                            const firstRow = document.querySelector('table tbody tr');
                            if (!firstRow) return { state: 'WAITING' };

                            const statusSpan = firstRow.querySelector('.label');
                            if (!statusSpan) return { state: 'WAITING' };

                            const statusText = statusSpan.textContent.trim();
                            const isWJ = statusText.includes('WJ') || statusText.includes('Judging') || statusText === '1/1' || statusText.includes('/');

                            const detailLink = firstRow.querySelector('td.text-right a');
                            const detailHref = detailLink ? detailLink.href : '';

                            return {
                                state: isWJ ? 'JUDGING' : 'DONE',
                                status: statusText,
                                // Also grab score/time if available
                                score: firstRow.cells[4] ? firstRow.cells[4].textContent.trim() : '',
                                time: firstRow.cells[7] ? firstRow.cells[7].textContent.trim() : '',
                                href: detailHref
                            };
                        }
                    });

                    if (results && results[0] && results[0].result) {
                        const res = results[0].result;
                        console.log('[atcoder-tools-mini] Monitor status:', res);

                        // Send updates back to the CLI via WebSocket!
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                action: 'judge_status',
                                data: res
                            }));
                        }

                        if (res.state === 'DONE') {
                            console.log('[atcoder-tools-mini] Judgement complete. Showing notification and closing tab.');
                            clearInterval(monitorInterval);
                            chrome.tabs.remove(tabId);

                            // --- comfortable-atcoder style notification ---
                            (async () => {
                                try {
                                    // Generate icon
                                    let foreColor = 'white';
                                    let backColor = '#f0ad4e'; // default (orange-ish)
                                    if (res.status === 'AC') {
                                        backColor = '#5cb85c'; // green
                                    } else if (res.status === 'WA') {
                                        backColor = 'hsl(0, 84%, 62%)'; // red
                                    }

                                    const width = 192;
                                    const height = 192;
                                    const canvas = new OffscreenCanvas(width, height);
                                    const ctx = canvas.getContext('2d');
                                    ctx.fillStyle = backColor;
                                    ctx.fillRect(0, 0, width, height);
                                    ctx.font = "bold 60px 'Lato','Helvetica Neue',arial,sans-serif";
                                    ctx.fillStyle = foreColor;
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillText(res.status, width / 2, height / 2);

                                    const blob = await canvas.convertToBlob({ type: 'image/png' });
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        const iconUrl = reader.result;
                                        chrome.notifications.create(
                                            {
                                                type: 'basic',
                                                iconUrl: iconUrl,
                                                title: `AtCoder: ${submitData.task_screen_name}`,
                                                message: `Result: ${res.status}\nScore: ${res.score}\nTime: ${res.time}`,
                                                requireInteraction: true
                                            },
                                            (notificationId) => {
                                                if (res.href) {
                                                    const clickHandler = (id) => {
                                                        if (id === notificationId) {
                                                            chrome.tabs.create({ url: res.href });
                                                            chrome.notifications.clear(id);
                                                            chrome.notifications.onClicked.removeListener(clickHandler);
                                                        }
                                                    };
                                                    chrome.notifications.onClicked.addListener(clickHandler);
                                                }
                                                // Auto clear after some time just like comfortable-atcoder
                                                setTimeout(() => {
                                                    chrome.notifications.clear(notificationId);
                                                }, 1000 * 10);
                                            }
                                        );
                                    };
                                    reader.readAsDataURL(blob);
                                } catch (err) {
                                    console.error('[atcoder-tools-mini] Notification error:', err);
                                }
                            })();
                        }
                    }
                } catch (err) {
                    console.log('[atcoder-tools-mini] Tab closed or error during monitoring:', err);
                    clearInterval(monitorInterval);
                }
            }, 1000); // Check every second
        }
    });

    console.log(`[atcoder-tools-mini] Injecting submission script into tab ${tab.id}`);

    // Inject content script into the page context
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: (submitData) => {
            console.log('[atcoder-tools-mini] Interacting with DOM...', submitData);

            // Set Task Screen Name
            const selectTask = document.querySelector('select[name="data.TaskScreenName"]');
            if (selectTask) {
                selectTask.value = submitData.task_screen_name;
                selectTask.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Set Language ID
            // AtCoder creates multiple select boxes, one for each task, inside #select-lang-{task_screen_name}
            const langSelectSelector = '#select-lang-' + submitData.task_screen_name + ' select';
            const selectLang = document.querySelector(langSelectSelector) || document.querySelector('select.form-control[data-placeholder="-"]');

            if (selectLang) {
                let found = false;
                for (const option of selectLang.options) {
                    if (option.value === submitData.language_id.toString()) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    console.error('[atcoder-tools-mini] Warning: Language ID ' + submitData.language_id + ' not found!');
                    // Try to auto-detect C++
                    for (const option of selectLang.options) {
                        if (option.text.includes('C++') && (option.text.includes('gcc') || option.text.includes('g++'))) {
                            console.log('[atcoder-tools-mini] Auto-fallback to: ' + option.text + ' (ID: ' + option.value + ')');
                            submitData.language_id = option.value;
                            found = true;
                            break;
                        }
                    }
                }

                if (found) {
                    selectLang.value = submitData.language_id;
                    selectLang.dispatchEvent(new Event('change', { bubbles: true }));

                    // If Select2 is used (AtCoder uses jQuery and Select2 for languages)
                    if (window.jQuery && window.jQuery(selectLang).select2) {
                        window.jQuery(selectLang).trigger('change');
                    }
                } else {
                    console.error('[atcoder-tools-mini] Error: Could not set Language. Make sure the ID is correct.');
                }
            } else {
                console.error('[atcoder-tools-mini] Language select dropdown NOT found in DOM! Selector was: ' + langSelectSelector);
            }

            // Set Source Code into Ace editor
            console.log('[atcoder-tools-mini] Attempting to set source code...');

            // AtCoder uses Ace Editor and a hidden plain-textarea!
            const plainTextArea = document.querySelector('textarea#plain-textarea');

            if (typeof window.ace !== 'undefined') {
                try {
                    console.log('[atcoder-tools-mini] Ace editor found on window. Setting value...');
                    const editor = window.ace.edit("editor");
                    editor.setValue(submitData.source_code, -1); // -1 moves cursor to start
                } catch (err) {
                    console.error('[atcoder-tools-mini] Failed to set Ace Editor value:', err);
                }
            }

            // Always set the plain textarea as a fallback
            if (plainTextArea) {
                console.log('[atcoder-tools-mini] Setting value on plain-textarea...');
                plainTextArea.value = submitData.source_code;
                plainTextArea.innerHTML = submitData.source_code;
                ['input', 'change', 'blur'].forEach(evt => {
                    plainTextArea.dispatchEvent(new Event(evt, { bubbles: true }));
                });
            } else {
                console.error('[atcoder-tools-mini] plain-textarea not found!');
            }

            // 4. Wait for Cloudflare Turnstile before clicking the Submit Button
            const submitBtn = document.getElementById('submit') || document.querySelector('button[type="submit"]');
            if (submitBtn) {
                console.log('[atcoder-tools-mini] Waiting for Cloudflare Turnstile verification...');

                // Polling for the Turnstile response token
                const checkInterval = setInterval(() => {
                    // Turnstile injects a hidden input with name "cf-turnstile-response"
                    const cfResponse = document.querySelector('[name="cf-turnstile-response"]');
                    if (cfResponse && cfResponse.value && cfResponse.value.length > 0) {
                        console.log('[atcoder-tools-mini] Turnstile Success! Clicking submit button...');
                        clearInterval(checkInterval);
                        submitBtn.click();
                    }
                }, 500);

                // Stop checking after 60 seconds to prevent infinite loops just in case
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.log('[atcoder-tools-mini] Stopped polling for Turnstile after 60 seconds.');
                }, 60000);

            } else {
                console.error('[atcoder-tools-mini] Submit button not found!');
            }
        },
        args: [data]
    });

    console.log('[atcoder-tools-mini] Tab operation completed!');
}
// Start connection loop
connectWebSocket();
