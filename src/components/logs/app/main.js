const vscode = acquireVsCodeApi();
let fullPageContent = {};
let filteredContent = {};
let fpcCounter = -1;
let filterMatched = false;
let schemaColors;
let defaultContainer;
let isToBottom = false;
let isFollowRun = false;
let lastScrollTop = 0;
let typingTimer;

window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'init': {
            const containers = message.containers;
            schemaColors = JSON.parse(message.colors);
            if (containers.length === 1) {
                defaultContainer = containers[0];
                return;
            }

            const containersPanel = document.getElementById('containers-panel');
            containersPanel.classList.remove('display-none');
            containersPanel.classList.add('display-inline-block');

            const select = createElement('vscode-select');
            select.setAttribute('id', 'containers-select');
            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < containers.length; i += 1) {
                const option = createElement('vscode-option', containers[i], containers[i]);
                if (i === 0) {
                    option.setAttribute('selected', '');
                }
                select.appendChild(option);
            }
            containersPanel.appendChild(select);
        }
        case 'content': {
            const text = message.text.replace(/\n$/, '');
            if (!text) {
                return;
            }
            const newContent = text.split('\n');
            updateContent(newContent);
        }
    }
});

function debounce(func, wait, immediate) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        const later = function () {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) {
            func.apply(context, args);
        }
    };
}

function createElement(type, value, content) {
    const element = document.createElement(type);
    if (value) { element.value = value; }
    if (content) { element.textContent = content; }
    return element;
}

function init() {
    const runBtn = document.getElementById('runBtn');
    runBtn.addEventListener('click', (_event) => {
        changeVisibilityAfterRun();
        startLog();
    });

    const stopBtn = document.getElementById('stopBtn');
    stopBtn.addEventListener('click', (_event) => {
        isFollowRun = false;
        changeVisibilityAfterStop();
        stopLog();
    });

    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', (_event) => {
        changeVisibilityAfterClear();
        clear();
    });

    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', (_event) => {
        reset();
    });

    const bottomBtn = document.getElementById('bottomBtn');
    bottomBtn.addEventListener('click', (_event) => {
        scrollToBottom();
    });

    const wrapChk = document.getElementById('wrap-chk');
    wrapChk.addEventListener('vsc-change', function (event) {
        if (event.detail.checked) {
            document.getElementById('content').classList.remove('white-space-pre');
            document.getElementById('content').classList.add('white-space-wrap');
        } else {
            document.getElementById('content').classList.remove('white-space-wrap');
            document.getElementById('content').classList.add('white-space-pre');
        }
    });

    const filterSelect = document.getElementById('filter-select');
    filterSelect.addEventListener('vsc-change', (_event) => {
        resetFilter();
        if (isRun() && document.getElementById('filter-input').value) {
            runFilter();
        }
    });

    const filterInput = document.getElementById('filter-input');
    filterInput.addEventListener('keyup', (_event) => {
        resetFilter();
        if (!isRun() || document.getElementById('filter-select').value === 'all') {
            return;
        }
        if (typingTimer) {
            clearTimeout(typingTimer);
        }
        typingTimer = setTimeout(runFilter, 500);
    });

    const logPanel = document.getElementById('logPanel');
    const toBottom = debounce(function () {
        const st = logPanel.scrollTop;
        if (st > lastScrollTop) {
            // scroll down
            isToBottom = (logPanel.scrollTop + window.innerHeight) >= logPanel.scrollHeight;
        } else {
            // scroll up
            isToBottom = false;
        }
        lastScrollTop = st <= 0 ? 0 : st;
        renderByPagination();
    }, 250);
    logPanel.addEventListener("scroll", toBottom);
}

function resetContent() {
    fullPageContent = {};
    fpcCounter = -1;
}

function resetFilter() {
    filteredContent = {};
    filterMatched = false;
}

function runFilter() {
    emptyContent();
    saveFilteredContent();
    setHeightContentPanel();
    renderByPagination();
}

function changeVisibilityAfterRun() {
    if (getToTerminal()) {
        return;
    }
    document.getElementById('runBtn').classList.add('display-none');
    if (isFollow()) {
        switchClass('stopBtn', 'display-none', 'display-inline-block');
    }
    switchClass('clearBtn', 'display-none', 'display-inline-block');
}

function changeVisibilityAfterClear() {
    if (document.getElementById('stopBtn').classList.contains('display-none')) {
        switchClass('clearBtn', 'display-inline-block', 'display-none');
        switchClass('runBtn', 'display-none', 'display-inline-block');
    }
}

function changeVisibilityAfterStop() {
    switchClass('stopBtn', 'display-inline-block', 'display-none');
}

function switchClass(id, classToRemove, classToAdd) {
    const element = document.getElementById(id);
    if (element.classList.contains(classToRemove)) {
        element.classList.remove(classToRemove);
    }
    if (!element.classList.contains(classToAdd)) {
        element.classList.add(classToAdd);
    }
}

function isRun() {
    return document.getElementById('runBtn').classList.contains('display-none');
}

function isFilterEnabled() {
    const filterInput = document.getElementById('filter-input').value;
    const mode = document.getElementById('filter-select').value;
    return filterInput.length > 0 && mode !== 'all';
}

function startLog() {
    resetContent();
    resetFilter();
    clear();
    isFollowRun = isFollow();
    const options = {
        container: getContainer(),
        follow: isFollowRun,
        timestamp: document.getElementById('timestamp-chk').checked,
        since: getSinceDuration(),
        tail: getTail(),
        terminal: getToTerminal()
    };
    vscode.postMessage({
        command: 'start',
        options: JSON.stringify(options)
    });
}

function stopLog() {
    vscode.postMessage({
        command: 'stop'
    });
}

function clear() {
    if (!isFollowRun) {
        resetContent();
        resetFilter();
    }
    setHeightContentPanel(true);
    emptyContent();
}

function reset() {
    const containersSelect = document.getElementById('containers-select');
    if (containersSelect) {
        containersSelect.selectedIndex = 0;
    }
    document.getElementById('follow-chk').checked = false;
    document.getElementById('timestamp-chk').checked = false;
    document.getElementById('since-input').value = '0';
    document.getElementById('since-select').selectedIndex = 0;
    document.getElementById('tail-input').value = '-1';
    document.getElementById('terminal-chk').checked = false;
}

function updateContent(newContent) {
    let content = {};
    let counter = 0;

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < newContent.length; i += 1) {
        if (newContent[i].length > 0) {
            content[counter] = newContent[i];
            fpcCounter++;
            fullPageContent[fpcCounter] = newContent[i];
            counter++;
        }
    }
    content = saveFilteredContent(content);
    setHeightContentPanel();
    renderByPagination(content);
    switchClass('clearBtn', 'display-none', 'display-inline-block');
}

function setHeightContentPanel(removeStyle) {
    if (removeStyle) {
        document.getElementById('innerLogPanel').style.removeProperty('height');
    } else {
        const content = isFilterEnabled() ? filteredContent : fullPageContent;
        const rows = Object.keys(content).length;
        const heightDiv = getDefaultDivHeightValue();
        document.getElementById('innerLogPanel').style.height = `${heightDiv * rows}px`;
    }
}

function saveFilteredContent(content) {
    const filterInput = document.getElementById('filter-input').value;
    const mode = document.getElementById('filter-select').value;
    let contentAfterFilter;
    if (filterInput.length > 0 && mode !== 'all') {
        contentAfterFilter = filter(content);
        let fcRows = Object.keys(filteredContent).length - 1;
        if (fcRows === -1) {
            filteredContent = contentAfterFilter;
            return contentAfterFilter;
        }
        for (let i = 0; i < Object.keys(contentAfterFilter).length; i += 1) {
            fcRows++;
            filteredContent[fcRows] = contentAfterFilter[i];
        }
    }
    return contentAfterFilter;
}

function filter(logs) {
    const text = logs ? logs : fullPageContent;
    const filterInput = document.getElementById('filter-input').value;
    const mode = document.getElementById('filter-select').value;
    let content = {};
    if (filterInput.length > 0 && mode !== 'all') {
        const regex = new RegExp(filterInput);
        switch (mode) {
            case 'include':
                content = filterByFunction(text, (value) => regex.test(value));
                break;
            case 'exclude':
                content = filterByFunction(text, (value) => !regex.test(value));
                break;
            case 'before':
                if (!filterMatched) {
                    const filterBeforeResult = filterBefore(text, regex);
                    content = filterBeforeResult.content;
                    filterMatched = filterBeforeResult.matched;
                }
                break;
            case 'after':
                if (!filterMatched) {
                    const filterAfterResult = filterAfter(text, regex);
                    content = filterAfterResult.content;
                    filterMatched = filterAfterResult.matched;
                } else {
                    content = text;
                }
                break;
            default:
                break;
        }
    } else {
        content = text;
    }

    return content;
}

function filterByFunction(text, func) {
    const content = {};
    let counter = 0;
    let innerCounter = 0;
    while (true) {
        const value = text[counter];
        if (!value) {
            break;
        }
        if (func(value)) {
            content[innerCounter] = value;
            innerCounter++;
        }
        counter++;
    }
    return content;
}

function filterBefore(text, regex) {
    const content = {};
    let counter = 0;
    let matched = false;
    while (true) {
        const value = text[counter];
        matched = regex.test(value);
        if (!value || matched) {
            break;
        }
        content[counter] = value;
        counter++;
    }
    return { matched, content };
}

function filterAfter(text, regex) {
    const content = {};
    let counter = 0;
    let innerCounter = 0;
    let start = false;
    let matched = false;
    while (true) {
        const value = text[counter];
        if (!value) {
            break;
        }
        matched = regex.test(value);
        if (!start && matched) {
            start = true;
        }
        if (start) {
            content[innerCounter] = value;
            innerCounter++;
        }
        counter++;
    }
    return { matched, content };
}

function emptyContent() {
    const contentDiv = document.getElementById('innerLogPanel');
    let i = contentDiv.childNodes.length;
    while (i--) {
        contentDiv.removeChild(contentDiv.firstChild);
    }
    contentDiv.innerHTML = `<code id='content' class='${isWrapEnabled() ? 'white-space-wrap' : 'white-space-pre'} position-relative'></code>`;
}

function renderByPagination(contentToAdd) {
    if (contentToAdd && Object.keys(contentToAdd).length === 0) {
        return;
    }
    const fullFilteredContent = isFilterEnabled() ? filteredContent : fullPageContent;
    const totalRows = Object.keys(fullFilteredContent).length - 1;
    const heightDiv = getDefaultDivHeightValue();
    const currentPosition = document.getElementById('logPanel').scrollTop;
    const referenceRow = Math.floor(currentPosition / heightDiv);
    // identify rows range to draw
    let lowerRange = referenceRow - 250 < 0 ? 0 : referenceRow - 250;
    let upperRange = referenceRow + 250 > totalRows ? totalRows : referenceRow + 250;
    let isPrepend = false;

    const children = document.getElementById('content').children;
    if (children.length !== 0) {
        // identify rows range present in DOM
        const lowestRowInDOM = parseInt(children.item(0).id);
        const uppestRowInDOM = parseInt(children.item(children.length - 1).id);
        if (lowerRange < lowestRowInDOM) {
            if (upperRange >= lowestRowInDOM) {
                removeChildren(upperRange + 1, uppestRowInDOM);
                upperRange = lowestRowInDOM - 1;
                isPrepend = true;
                document.getElementById('content').style.top = `${lowerRange * heightDiv}px`;
            } else {
                emptyContent();
                document.getElementById('content').style.top = `${lowerRange * heightDiv}px`;
            }
            const content = extractRowsToDraw(fullFilteredContent, lowerRange, upperRange);
            render(beautifyLines(content), lowerRange, isPrepend);
        } else if (upperRange > uppestRowInDOM) {
            if (lowerRange <= uppestRowInDOM) {
                removeChildren(lowestRowInDOM, lowerRange - 1);
                document.getElementById('content').style.top = `${lowerRange * heightDiv}px`;
                lowerRange = uppestRowInDOM + 1;
            } else {
                emptyContent();
                document.getElementById('content').style.top = `${lowerRange * heightDiv}px`;
            }
            const content = extractRowsToDraw(fullFilteredContent, lowerRange, upperRange);
            render(beautifyLines(content), lowerRange, isPrepend);
        }
    } else {
        const content = extractRowsToDraw(fullFilteredContent, lowerRange, upperRange);
        document.getElementById('content').style.top = `${lowerRange * heightDiv}px`;
        render(beautifyLines(content), lowerRange, isPrepend);
    }
}

function extractRowsToDraw(content, from, to) {
    const contentExtracted = {};
    for (let i = from; i <= to; i += 1) {
        contentExtracted[i] = content[i];
    }
    return contentExtracted;
}

function beautifyLines(contentLines) {
    const content = {};
    if (Object.keys(contentLines).length === 0) {
        return content;
    }

    const heightDiv = getDefaultDivHeightValue();
    // eslint-disable-next-line prefer-const
    for (let [key, value] of Object.entries(contentLines)) {
        if (!value) {
            continue;
        }
        value = value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        value = highlightWords(value);
        value = /\n$/.test(value) ? value : `${value}\n`;
        content[key] = `<div id="${key}" style="min-height: ${heightDiv}px">${value}</div>`;
    }
    return content;
}

function highlightWords(row) {
    if (!schemaColors) {
        return row;
    }
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < schemaColors.length; i += 1) {
        const rule = schemaColors[i];
        const regexp = new RegExp(rule.regex, "gi");
        if (regexp.test(row)) {
            row = row.replaceAll(regexp, repl);
            row = row.replaceAll('#ruleColor', rule.color);
        }
    }
    return row;
}

function repl() {
    const match = arguments[0];
    const offset = arguments[arguments.length - 2];
    const originalString = arguments[arguments.length - 1];
    if (!originalString) {
        return match;
    }
    const indexOpenSpan = originalString.substring(0, offset + match.length).lastIndexOf("<span");
    const indexCloseSpan = originalString.substring(0, offset + match.length).lastIndexOf("</span>");
    if (indexOpenSpan === -1 || indexOpenSpan < indexCloseSpan) {
        return `<span class="#ruleColor">${match}</span>`;
    } else {
        return match;
    }
}

function removeChildren(from, to) {
    if (to < from) {
        return;
    }
    for (let i=from; i<=to; i++) {
        const toDelete = document.getElementById(i.toString());
        if (toDelete) {
            toDelete.remove();
        }
    }
}

function render(content, from, prepend) {
    if (Object.keys(content).length === 0) {
        const fragment = document.createRange().createContextualFragment('No logs ...');
        document.getElementById('content').appendChild(fragment);
    } else {
        const contentToDisplay = concatenateObjectValuesAsString(content, from);
        const fragment = document.createRange().createContextualFragment(contentToDisplay);
        if (prepend) {
            document.getElementById('content').prepend(fragment);
        } else {
            document.getElementById('content').appendChild(fragment);
        }
        if (isToBottom) {
            scrollToBottom();
        }
    }
}

function concatenateObjectValuesAsString(object, ix) {
    let valuesConcatenated = '';
    while (true) {
        const value = object[ix];
        if (!value) {
            break;
        }
        valuesConcatenated += value;
        ix++;
    }
    return valuesConcatenated;
}

function scrollToBottom() {
    document.getElementById('bottom').scrollIntoView();
}

function getContainer() {
    const containersSelect = document.getElementById('containers-select');
    if (containersSelect) {
        return containersSelect.value;
    }
    return defaultContainer;
}

function isFollow() {
    return document.getElementById('follow-chk').checked;
}

function getSinceDuration() {
    const sinceType = document.getElementById('since-select').value;
    const sinceInput = document.getElementById('since-input').value;
    if (isNaN(sinceInput) || sinceInput <= 0 || sinceType.trim() === '') {
        return 0;
    }
    return `${sinceInput}${sinceType}`;
}

function getTail() {
    const tailValue = document.getElementById('tail-input').value;
    if (isNaN(tailValue) || tailValue <= 0) {
        return -1;
    }
    return tailValue;
}

function getToTerminal() {
    return document.getElementById('terminal-chk').checked;
}

function isWrapEnabled() {
    return document.getElementById('wrap-chk').checked;
}

function getDefaultDivHeightValue() {
    return document.getElementById('follow-lbl').offsetHeight;
}

(function () {
    init();
})();