// Dropdown modification for AtCoder Tasks Tab
(async function () {
    // We only run this on contest pages
    if (!location.href.includes('/contests/')) return;

    // We need to fetch the problems list
    const match = location.pathname.match(/^\/contests\/([^\/]+)/);
    if (!match) return;
    const contestId = match[1];

    // Find the Tasks tab
    const tabs = document.querySelectorAll('#main-container .nav > li');
    let tasksTabLi = null;
    let tasksTabLink = null;

    for (const li of tabs) {
        const a = li.querySelector('a');
        if (a && a.getAttribute('href') && a.getAttribute('href').match(/\/tasks\/?$/)) {
            tasksTabLi = li;
            tasksTabLink = a;
            break;
        }
    }

    if (!tasksTabLi || !tasksTabLink) return;

    // Fetch the task list so we can create the dropdown
    try {
        let doc;
        // If we are already on the tasks page, we don't need to fetch!
        if (location.pathname.match(/\/tasks\/?$/)) {
            doc = document;
        } else {
            const response = await fetch(`/contests/${contestId}/tasks`);
            if (!response.ok) return;
            const html = await response.text();
            const parser = new DOMParser();
            doc = parser.parseFromString(html, 'text/html');
        }

        // Find the index of the "Task Name" / "問題" column
        const table = doc.querySelector('table');
        if (!table) return;

        const ths = Array.from(table.querySelectorAll('thead > tr > th'));
        let probColIdx = -1;
        for (let i = 0; i < ths.length; i++) {
            const text = ths[i].textContent;
            if (text.includes('Task Name') || text.includes('問題')) {
                probColIdx = i;
                break;
            }
        }

        if (probColIdx === -1) return;

        const rows = doc.querySelectorAll('table tbody tr');
        if (rows.length === 0) return;

        const ul = document.createElement('ul');
        ul.className = 'dropdown-menu';
        ul.setAttribute('role', 'menu');

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length <= probColIdx) continue;

            const titleCell = cells[probColIdx];
            const link = titleCell.querySelector('a');
            if (!link) continue;

            const title = link.textContent.trim();
            const url = link.getAttribute('href');

            // Try to get alphabet from the first column if it's A, B, C...
            let alphabet = 'X';
            if (cells.length > 0) {
                const alphaText = cells[0].textContent.trim();
                if (/^[A-Z]+$/.test(alphaText)) {
                    alphabet = alphaText;
                }
            }

            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = url;
            a.innerHTML = `<span style='font-family: Consolas, "Courier New", monospace'>${alphabet} - </span>${title}`;
            li.appendChild(a);
            ul.appendChild(li);
        }

        // Add dropdown to the list item
        ul.classList.add('ca-dropdown-list');
        tasksTabLi.appendChild(ul);
        tasksTabLi.classList.add('dropdown-hover');

        // Handle hover by toggling Bootstrap's 'open' class on the li element
        tasksTabLi.addEventListener('mouseenter', () => {
            tasksTabLi.classList.add('open');
        });
        tasksTabLi.addEventListener('mouseleave', () => {
            tasksTabLi.classList.remove('open');
        });

        // Make the main link still clickable, but show a caret to indicate a dropdown
        tasksTabLink.innerHTML += ' <span class="caret"></span>';

        // Add CSS styles mirroring my-comfortable-atcoder for larger buttons
        const style = document.createElement('style');
        style.textContent = `
            .dropdown-hover:hover > .dropdown-menu {
                display: block;
            }
            .ca-dropdown-list {
                min-width: 350px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }
            .ca-dropdown-list > li > a {
                padding: 20px 28px;
                font-size: 24px;
            }
        `;
        document.head.appendChild(style);

    } catch (err) {
        console.error('[atcoder-tools-mini] Error fetching task list for dropdown:', err);
    }
})();
