let port = null;

function connectNative() {
    port = chrome.runtime.connectNative('com.atcoder_tools_mini');

    port.onMessage.addListener((msg) => {
        console.log('[atcoder-tools-mini] Native message received:', msg);
        if (msg.action === 'submit') {
            console.log('[atcoder-tools-mini] Submission request received:', msg);
            // Execute logic silently in the background!
            submitToAtCoder(msg).catch(err => {
                console.error('[atcoder-tools-mini] Error during submission:', err);
                showErrorNotification(`Submission Failed: ${msg.task_screen_name || 'Unknown'}`, err.message || String(err));
            });
        } else if (msg.action === 'gen') {
            console.log('[atcoder-tools-mini] Gen request received:', msg);
            generateContestData(msg).catch(err => {
                console.error('[atcoder-tools-mini] Error during gen:', err);
                port.postMessage({ action: 'gen_error', error: err.message });
            });
        }
    });

    port.onDisconnect.addListener(() => {
        console.log('[atcoder-tools-mini] Native host disconnected. Reconnecting in 2 seconds...', chrome.runtime.lastError);
        setTimeout(connectNative, 2000);
    });
}

// Initial Native Messaging connection attempt
connectNative();

async function generateContestData(data) {
    const contestId = data.contest_id;
    if (!contestId) {
        throw new Error('contest_id is missing for gen command.');
    }

    console.log(`[atcoder-tools-mini] Fetching tasks for ${contestId}...`);
    if (port) port.postMessage({ action: 'gen_log', message: `Fetching task list for ${contestId}...` });

    const tasksUrl = `https://atcoder.jp/contests/${contestId}/tasks`;
    const response = await fetch(tasksUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch tasks page: ${response.status}`);
    }
    const html = await response.text();

    const tbodyMatch = html.match(/<tbody>(.*?)<\/tbody>/is);
    if (!tbodyMatch) {
        throw new Error('Tasks table not found. (Not logged in or no tasks? Check Chrome session.)');
    }

    // Extract A, B, C etc. and their URLs
    const rowRegex = /<tr>\s*<td class="text-center(.*?)"><a href="(\/contests\/[^/]+\/tasks\/([^"]+))">([^<]+)<\/a><\/td>/gis;
    const tasks = [];
    let match;
    while ((match = rowRegex.exec(tbodyMatch[1])) !== null) {
        tasks.push({
            label: match[4].trim(), // "A", "B", ...
            url: `https://atcoder.jp${match[2]}`,
            screen_name: match[3]
        });
    }

    if (tasks.length === 0) {
        throw new Error('No tasks found in the table.');
    }

    if (port) port.postMessage({ action: 'gen_log', message: `Found ${tasks.length} tasks: ${tasks.map(t => t.label).join(', ')}` });

    const results = [];

    for (const task of tasks) {
        if (port) port.postMessage({ action: 'gen_log', message: `Downloading samples for ${task.label} (${task.screen_name})...` });

        const taskRes = await fetch(task.url);
        if (!taskRes.ok) {
            console.error(`Failed to fetch task ${task.label}`);
            if (port) port.postMessage({ action: 'gen_log', message: `  => Failed: HTTP ${taskRes.status}` });
            continue;
        }
        const taskHtml = await taskRes.text();

        // Regex to find Sample Input and Output blocks
        // Using `.*?` instead of `[^<]*` in case of hidden elements or <span>s.
        const sampleInRegex = /<h3>(?:Sample Input|入力例)\s*\d+.*?<\/h3>.*?<pre>(.*?)<\/pre>/gis;
        const sampleOutRegex = /<h3>(?:Sample Output|出力例)\s*\d+.*?<\/h3>.*?<pre>(.*?)<\/pre>/gis;

        const extractText = (htmlStr) => {
            let s = htmlStr.replace(/<br\s*\/?>/gi, '\n');
            s = s.replace(/<[^>]+>/g, '');
            s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            s = s.replace(/\r\n/g, '\n');
            // Trim ALL leading/trailing whitespace including newlines, then add a single newline at the end
            return s.trim() + '\n';
        };

        const inputs = [];
        const outputs = [];

        let inMatch;
        while ((inMatch = sampleInRegex.exec(taskHtml)) !== null) {
            inputs.push(extractText(inMatch[1]));
        }

        let outMatch;
        while ((outMatch = sampleOutRegex.exec(taskHtml)) !== null) {
            outputs.push(extractText(outMatch[1]));
        }

        // AtCoder often has dual tabs (lang-ja, lang-en) causing duplicate sample blocks in HTML.
        // We deduplicate them by checking exact pairs.
        const deduplicatedSamples = [];
        const seen = new Set();

        const maxLen = Math.min(inputs.length, outputs.length);
        for (let i = 0; i < maxLen; i++) {
            const inText = inputs[i];
            const outText = outputs[i];
            const hash = inText + "|_|" + outText;
            if (!seen.has(hash)) {
                seen.add(hash);
                deduplicatedSamples.push({
                    input: inText,
                    output: outText
                });
            }
        }

        results.push({
            label: task.label,
            screen_name: task.screen_name,
            samples: deduplicatedSamples
        });

        if (port) {
            if (deduplicatedSamples.length > 0) {
                port.postMessage({ action: 'gen_log', message: `  => Success (${deduplicatedSamples.length} samples)` });
            } else {
                port.postMessage({ action: 'gen_log', message: `  => Warning: No samples found` });
            }
        }

        // Be polite to AtCoder servers to prevent 429 Too Many Requests
        await new Promise(r => setTimeout(r, 600));
    }

    if (port) {
        port.postMessage({
            action: 'gen_result',
            contest_id: contestId,
            tasks: results
        });
    }
}

async function showErrorNotification(title, message) {
    try {
        const width = 192;
        const height = 192;
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'hsl(0, 84%, 62%)'; // red
        ctx.fillRect(0, 0, width, height);
        ctx.font = "bold 60px 'Lato','Helvetica Neue',arial,sans-serif";
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ERR', width / 2, height / 2);

        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const reader = new FileReader();
        reader.onloadend = () => {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: reader.result,
                title: title,
                message: message,
                priority: 2
            });
        };
        reader.readAsDataURL(blob);
    } catch (err) {
        console.error('[atcoder-tools-mini] Notification error:', err);
    }
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

    // Wait for the new submitUrl tab to fully load
    await new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tId, info) {
            if (tId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                // add a small delay to ensure DOM and CodeMirror are fully ready
                setTimeout(resolve, 500);
            }
        });
    });

    // Instead of relying on comfortable-atcoder, WE will monitor the submission
    chrome.tabs.onUpdated.addListener(function closeListener(tId, info, tabObj) {
        if (tId === tab.id && info.status === 'complete' && tabObj.url && tabObj.url.includes('/submissions/me')) {
            console.log('[atcoder-tools-mini] Redirected to submissions page. Starting built-in monitor...');
            chrome.tabs.onUpdated.removeListener(closeListener);

            // Signal the CLI to exit immediately since the submission is complete!
            if (port) {
                port.postMessage({ status: 'submitted' });
            }

            // Fetch directly from Service Worker to avoid background tab throttling
            const monitorInterval = setInterval(async () => {
                try {
                    const response = await fetch(`https://atcoder.jp/contests/${contestId}/submissions/me`, { cache: 'no-store' });
                    if (!response.ok) return;
                    const html = await response.text();

                    const tbodyMatch = html.match(/<tbody>(.*?)<\/tbody>/is);
                    if (!tbodyMatch) return;

                    const firstRowMatch = tbodyMatch[1].match(/<tr>(.*?)<\/tr>/is);
                    if (!firstRowMatch) return;

                    const rowHtml = firstRowMatch[1];
                    const tdsMatch = [...rowHtml.matchAll(/<td[^>]*>(.*?)<\/td>/gis)];
                    if (tdsMatch.length < 7) return;

                    const score = tdsMatch[4][1].replace(/<[^>]+>/g, '').trim();
                    const statusText = tdsMatch[6][1].replace(/<[^>]+>/g, '').trim();
                    const isWJ = statusText.includes('WJ') || statusText.includes('Judging') || statusText === '1/1' || statusText.includes('/');
                    const time = tdsMatch.length > 7 ? tdsMatch[7][1].replace(/<[^>]+>/g, '').trim() : '';

                    const detailHrefMatch = rowHtml.match(/href="(\/contests\/[^/]+\/submissions\/\d+)"/);
                    const href = detailHrefMatch ? `https://atcoder.jp${detailHrefMatch[1]}` : '';

                    const res = {
                        state: isWJ ? 'JUDGING' : 'DONE',
                        status: statusText,
                        score: score,
                        time: time,
                        href: href
                    };

                    if (res) {
                        console.log('[atcoder-tools-mini] Monitor status:', res);

                        if (port) {
                            port.postMessage({
                                action: 'judge_status',
                                data: res
                            });
                        }

                        if (res.state === 'DONE') {
                            console.log('[atcoder-tools-mini] Judgement complete. Showing notification and closing tab.');
                            clearInterval(monitorInterval);
                            chrome.tabs.remove(tab.id);

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
                                    ctx.font = "80px 'Lato','Helvetica Neue',arial,sans-serif";
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
                                                title: `AtCoder: ${data.task_screen_name}`,
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
        func: async (submitData) => {
            console.log('[atcoder-tools-mini] Interacting with DOM...', submitData);
            return new Promise((resolve, reject) => {
                // Set Task Screen Name
                const selectTask = document.querySelector('select[name="data.TaskScreenName"]');
                if (selectTask) {
                    selectTask.value = submitData.task_screen_name;
                    selectTask.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Set Language ID
                const langSelectSelector = '#select-lang-' + submitData.task_screen_name + ' select';
                const selectLang = document.querySelector(langSelectSelector) || document.querySelector('select.form-control[data-placeholder="-"]');

                if (selectLang) {
                    let found = false;

                    if (Array.isArray(submitData.language_id)) {
                        for (const option of selectLang.options) {
                            const textMatch = submitData.language_id.every(kw => option.text.toLowerCase().includes(kw.toLowerCase()));
                            if (textMatch) {
                                console.log('[atcoder-tools-mini] Language matched by keywords: ' + option.text + ' (ID: ' + option.value + ')');
                                submitData.language_id = option.value;
                                found = true;
                                break;
                            }
                        }
                    } else {
                        for (const option of selectLang.options) {
                            if (option.value === submitData.language_id.toString()) {
                                found = true;
                                break;
                            }
                        }
                    }

                    if (!found) {
                        for (const option of selectLang.options) {
                            const optText = option.text.toLowerCase();
                            if (optText.includes('c++') && (optText.includes('gcc') || optText.includes('g++'))) {
                                submitData.language_id = option.value;
                                found = true;
                                break;
                            }
                        }
                    }

                    if (found) {
                        selectLang.value = submitData.language_id;
                        selectLang.dispatchEvent(new Event('change', { bubbles: true }));

                        if (window.jQuery && window.jQuery(selectLang).select2) {
                            window.jQuery(selectLang).trigger('change');
                        }
                    } else {
                        return reject(new Error('Could not set Language. Keywords or ID not found.'));
                    }
                } else {
                    return reject(new Error('Language select dropdown NOT found in DOM! Selector was: ' + langSelectSelector));
                }

                // Set Source Code
                const plainTextArea = document.querySelector('textarea#plain-textarea');

                if (typeof window.ace !== 'undefined') {
                    try {
                        const editor = window.ace.edit("editor");
                        editor.setValue(submitData.source_code, -1);
                    } catch (err) {
                        console.error('[atcoder-tools-mini] Failed to set Ace Editor value:', err);
                    }
                }

                if (plainTextArea) {
                    plainTextArea.value = submitData.source_code;
                    plainTextArea.innerHTML = submitData.source_code;
                    ['input', 'change', 'blur'].forEach(evt => {
                        plainTextArea.dispatchEvent(new Event(evt, { bubbles: true }));
                    });
                } else {
                    return reject(new Error('plain-textarea not found!'));
                }

                // Wait for Cloudflare Turnstile if it exists, otherwise submit immediately
                const submitBtn = document.getElementById('submit') || document.querySelector('button[type="submit"]');
                if (submitBtn) {
                    console.log('[atcoder-tools-mini] Checking for Cloudflare Turnstile...');

                    // If the cf-turnstile-response element doesn't exist at all, we might be in a contest where bot protection is off
                    const turnstileContainer = document.querySelector('[name="cf-turnstile-response"]');
                    if (!turnstileContainer) {
                        console.log('[atcoder-tools-mini] Turnstile not detected on page. Clicking submit button immediately!');
                        submitBtn.click();
                        resolve();
                        return;
                    }

                    console.log('[atcoder-tools-mini] Turnstile detected. Waiting for verification...');
                    const checkInterval = setInterval(() => {
                        const cfResponse = document.querySelector('[name="cf-turnstile-response"]');
                        if (cfResponse && cfResponse.value && cfResponse.value.length > 0) {
                            console.log('[atcoder-tools-mini] Turnstile Success! Clicking submit button...');
                            clearInterval(checkInterval);
                            submitBtn.click();
                            resolve();
                        }
                    }, 500);

                    setTimeout(() => {
                        clearInterval(checkInterval);
                        reject(new Error('Turnstile verification timed out after 60 seconds.'));
                    }, 60000);

                } else {
                    reject(new Error('Submit button not found!'));
                }
            });
        },
        args: [data]
    });

    console.log('[atcoder-tools-mini] Tab operation completed!');
}
