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
