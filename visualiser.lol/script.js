const preloadedGifs = [];
['1.gif', '2.gif', '3.gif', '4.gif', 'opening.gif'].forEach(src => {
    const img = new Image();
    img.src = `/load/${src}`;
    preloadedGifs.push(img);
});

const promptInput = document.getElementById('prompt');
const generateBtn = document.getElementById('generate-btn');
const configBtns = document.querySelectorAll('.config-action');
const projectsBtns = document.querySelectorAll('.projects-action');
const newProjectBtn = document.getElementById('new-project-btn');
const studioBtn = document.getElementById('studio-btn');
const studioBtnText = document.getElementById('studio-btn-text');
const studioBtnIcon = document.getElementById('studio-btn-icon');
const githubBtn = document.getElementById('github-btn'); 
const fullscreenBtn = document.getElementById('fullscreen-btn');
const replayBtn = document.getElementById('replay-btn');
const codePeekBtn = document.getElementById('code-peek-btn');
const consoleToggleBtn = document.getElementById('console-toggle-btn');
const consoleDrawer = document.getElementById('console-drawer');
const closeConsoleBtn = document.getElementById('close-console-btn');
const consoleLogs = document.getElementById('console-logs');

const projectsModal = document.getElementById('projects-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const projectsList = document.getElementById('projects-list');
const previewFrame = document.getElementById('preview-frame');
const codeView = document.getElementById('code-view');
const appContainer = document.getElementById('app-container');
const downloadBtn = document.getElementById('download-btn');
const chatHistoryContainer = document.getElementById('chat-history');
const limitDisplay = document.getElementById('daily-limit-display');
const studioLoader = document.getElementById('studio-loader');
const studioLoaderText = document.getElementById('studio-loader-text');
const appFavicon = document.getElementById('app-favicon');

let currentGeneratedHtml = ''; 
let loaderTimer;
let currentLoadingStep = 0;
let conversationHistory = []; 
let isFirstGeneration = true; 
let currentProjectId = null; 
let isCodeViewActive = false;
let errorCount = 0;

// Queue State
let isGenerating = false;
const promptQueue = [];

const MAX_DAILY_REQUESTS = 500; 

const loadingSequence = [
    { text: "Understanding the task...", gif: "1.gif", time: 2000 },
    { text: "Making the first draft...", gif: "3.gif", time: 3000 },
    { text: "Polishing the result...", gif: "4.gif", time: 10000 },
    { text: "Finishing up...", gif: "2.gif", time: 60000 } 
];

const studioMessages = ["Preparing your codespace...", "Curating your tool library...", "Finishing up..."];
const successSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const errorSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

function initDailyLimit() {
    const today = new Date().toDateString();
    let usage = JSON.parse(localStorage.getItem('visualiser_usage') || '{}');
    if (usage.date !== today) {
        usage = { date: today, count: 0 };
        localStorage.setItem('visualiser_usage', JSON.stringify(usage));
    }
    updateLimitUI(usage.count);
}
function updateLimitUI(count) {
    const remaining = MAX_DAILY_REQUESTS - count;
    if(limitDisplay) limitDisplay.innerText = remaining <= 0 ? "Limit reached" : `${remaining} generations left`;
}
function incrementUsage() {
    let usage = JSON.parse(localStorage.getItem('visualiser_usage') || '{}');
    usage.count += 1;
    localStorage.setItem('visualiser_usage', JSON.stringify(usage));
    updateLimitUI(usage.count);
}
function setLimitReached() {
    let usage = JSON.parse(localStorage.getItem('visualiser_usage') || '{}');
    usage.count = MAX_DAILY_REQUESTS;
    localStorage.setItem('visualiser_usage', JSON.stringify(usage));
    updateLimitUI(usage.count);
}
function canGenerate() {
    let usage = JSON.parse(localStorage.getItem('visualiser_usage') || '{}');
    return usage.count < MAX_DAILY_REQUESTS;
}
initDailyLimit();

function updateGenerateButtonState(isQueueing) {
    if (isQueueing) {
        generateBtn.innerHTML = `
            Queue
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        `;
    } else {
        generateBtn.innerHTML = `
            Enter
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>
        `;
    }
}

configBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const currentKey = localStorage.getItem('gemini_api_key') || '';
        const newKey = prompt('Enter your Google AI Studio API Key:', currentKey);
        if (newKey !== null && newKey.trim() !== '') {
            localStorage.setItem('gemini_api_key', newKey.trim());
            alert('API Key saved!');
        }
    });
});

promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generateBtn.click();
    }
});

document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        promptInput.value = chip.innerText;
        promptInput.focus();
    });
});

downloadBtn.addEventListener('click', () => {
    if (!currentGeneratedHtml) { alert('Generate something first before downloading!'); return; }
    const blob = new Blob([currentGeneratedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'visualiser.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

if (githubBtn) {
    githubBtn.addEventListener('click', () => {
        if (!currentProjectId) { alert("Please save your project in the Studio first before publishing."); return; }
        
        localStorage.setItem('visualiser_current_project_id', currentProjectId);
        
        if (currentGeneratedHtml) localStorage.setItem('visualiser_pending_gh', currentGeneratedHtml);
        window.location.href = '/gh';
    });
}

newProjectBtn.addEventListener('click', () => {
    isFirstGeneration = true;
    currentProjectId = null;
    conversationHistory = [];
    currentGeneratedHtml = '';
    previewFrame.srcdoc = '';
    chatHistoryContainer.innerHTML = '';
    promptInput.value = '';
    appContainer.className = 'view-home';
    studioBtnText.innerText = 'Open in Studio';
    studioBtnIcon.style.display = 'none';
    promptQueue.length = 0; 
    isGenerating = false;
    updateGenerateButtonState(false);
    clearConsole();
    
    if (appFavicon) appFavicon.href = '/favicon.png';
    if (isCodeViewActive) {
        isCodeViewActive = false;
        previewFrame.style.display = 'block';
        codeView.style.display = 'none';
        codePeekBtn.classList.remove('active');
    }
});

replayBtn.addEventListener('click', () => {
    if (currentGeneratedHtml) {
        clearConsole();
        previewFrame.srcdoc = injectErrorCatcher(currentGeneratedHtml);
    }
});

codePeekBtn.addEventListener('click', () => {
    if (!currentGeneratedHtml) return;
    isCodeViewActive = !isCodeViewActive;
    if (isCodeViewActive) {
        previewFrame.style.display = 'none';
        codeView.style.display = 'block';
        codeView.textContent = currentGeneratedHtml;
        codePeekBtn.classList.add('active');
    } else {
        previewFrame.style.display = 'block';
        codeView.style.display = 'none';
        codePeekBtn.classList.remove('active');
    }
});

fullscreenBtn.addEventListener('click', () => {
    const container = document.querySelector('.iframe-container');
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => { alert(`Error attempting to enable fullscreen: ${err.message}`); });
    } else {
        document.exitFullscreen();
    }
});

consoleToggleBtn.addEventListener('click', () => {
    consoleDrawer.classList.toggle('open');
    if (consoleDrawer.classList.contains('open')) {
        consoleToggleBtn.classList.add('active');
        const badge = consoleToggleBtn.querySelector('.error-badge');
        if (badge) badge.style.display = 'none';
    } else {
        consoleToggleBtn.classList.remove('active');
    }
});

closeConsoleBtn.addEventListener('click', () => {
    consoleDrawer.classList.remove('open');
    consoleToggleBtn.classList.remove('active');
});

function clearConsole() {
    errorCount = 0;
    consoleLogs.innerHTML = `<div class="console-empty">No errors yet. You're a legend.</div>`;
    let badge = consoleToggleBtn.querySelector('.error-badge');
    if (badge) badge.style.display = 'none';
}

function addConsoleError(msg) {
    if (errorCount === 0) consoleLogs.innerHTML = ''; 
    errorCount++;
    
    let badge = consoleToggleBtn.querySelector('.error-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'error-badge';
        consoleToggleBtn.appendChild(badge);
    }
    if (!consoleDrawer.classList.contains('open')) badge.style.display = 'block';

    const logEl = document.createElement('div');
    logEl.className = 'log-entry';
    logEl.innerHTML = `
        <div class="log-text">${msg}</div>
        <div class="log-actions">
            <button class="log-btn explain-btn">Explain</button>
            <button class="log-btn fix-btn">Fix</button>
        </div>
    `;

    logEl.querySelector('.explain-btn').addEventListener('click', () => explainError(msg));
    logEl.querySelector('.fix-btn').addEventListener('click', () => {
        promptInput.value = `Fix this JavaScript error: ${msg}`;
        generateBtn.click();
    });

    consoleLogs.appendChild(logEl);
    consoleDrawer.classList.add('open');
    consoleToggleBtn.classList.add('active');
    badge.style.display = 'none';
}

window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'studio-iframe-error') {
        addConsoleError(event.data.message);
    }
});

function injectErrorCatcher(html) {
    const errorScript = `
    <script>
        window.onerror = function(msg, url, line, col, error) {
            window.parent.postMessage({ type: 'studio-iframe-error', message: msg }, '*');
            return false;
        };
        window.addEventListener('unhandledrejection', function(event) {
            window.parent.postMessage({ type: 'studio-iframe-error', message: event.reason?.message || "Unhandled Promise Rejection" }, '*');
        });
        const origError = console.error;
        console.error = function(...args) {
            window.parent.postMessage({ type: 'studio-iframe-error', message: args.join(' ') }, '*');
            origError.apply(console, args);
        };
    </script>`;
    
    if (html.includes('<head>')) return html.replace('<head>', '<head>' + errorScript);
    return errorScript + html;
}

async function explainError(errorMsg) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) { alert("API key required to explain errors."); return; }

    addChatBubble(`Explain this error: ${errorMsg}`, true);
    
    const tempBubble = document.createElement('div');
    tempBubble.className = 'chat-bubble model-bubble';
    tempBubble.innerText = 'Analyzing stack trace...';
    chatHistoryContainer.appendChild(tempBubble);
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                system_instruction: { parts: [{ text: "You are a senior web dev. Briefly explain the provided JavaScript error in 2-3 sentences max. Be casual, direct, and suggest a likely fix. No markdown code blocks." }] },
                contents: [{ role: "user", parts: [{ text: errorMsg }] }]
            })
        });
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();
        tempBubble.innerText = data.candidates[0].content.parts[0].text;
    } catch (e) {
        tempBubble.innerText = "Couldn't fetch an explanation right now. Give the fix button a crack instead.";
    }
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
}

projectsBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        renderProjectsList();
        projectsModal.style.display = 'flex';
    });
});
closeModalBtn.addEventListener('click', () => { projectsModal.style.display = 'none'; });

studioBtn.addEventListener('click', async () => {
    if (!currentGeneratedHtml) { alert('Nothing to save yet!'); return; }

    const isAlreadyStudio = appContainer.classList.contains('view-studio');

    if (!isAlreadyStudio) {
        studioLoader.style.display = 'flex';
        let msgIdx = 0;
        studioLoaderText.innerText = studioMessages[msgIdx];
        const studioInterval = setInterval(() => {
            msgIdx++;
            if (msgIdx < studioMessages.length) studioLoaderText.innerText = studioMessages[msgIdx];
        }, 1500);

        await new Promise(resolve => setTimeout(resolve, 4500));
        clearInterval(studioInterval);
        studioLoader.style.display = 'none';
        appContainer.className = 'view-studio';
        if (appFavicon) appFavicon.href = '/studio_favicon.png';
    }

    const projects = JSON.parse(localStorage.getItem('visualiser_projects') || '[]');

    if (currentProjectId) {
        const idx = projects.findIndex(p => p.id === currentProjectId);
        if (idx !== -1) {
            projects[idx].html = currentGeneratedHtml;
            projects[idx].history = conversationHistory;
            projects[idx].timestamp = Date.now();
        }
    } else {
        currentProjectId = Date.now().toString();
        let name = "Untitled Project";
        if (conversationHistory.length > 0) {
            name = conversationHistory[0].parts[0].text.replace('Create or update this visual component: ', '').substring(0, 30) + '...';
        }
        projects.push({
            id: currentProjectId, name: name, html: currentGeneratedHtml,
            history: conversationHistory, timestamp: Date.now()
        });
    }

    localStorage.setItem('visualiser_projects', JSON.stringify(projects));
    
    studioBtnIcon.style.display = 'inline-block';
    if (isAlreadyStudio) {
        studioBtnIcon.innerHTML = successSvg;
        studioBtnText.innerText = 'Saved';
        setTimeout(() => {
            studioBtnIcon.innerHTML = `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>`;
            studioBtnText.innerText = 'Save';
        }, 2000);
    } else {
        studioBtnIcon.innerHTML = `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>`;
        studioBtnText.innerText = 'Save';
    }
});

function renderProjectsList() {
    const projects = JSON.parse(localStorage.getItem('visualiser_projects') || '[]');
    projectsList.innerHTML = '';
    if (projects.length === 0) {
        projectsList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No projects yet.</p>';
        return;
    }
    projects.sort((a, b) => b.timestamp - a.timestamp).forEach(proj => {
        const item = document.createElement('div');
        item.className = 'project-item';
        const date = new Date(proj.timestamp).toLocaleString();
        item.innerHTML = `<span class="project-name">${proj.name}</span><span class="project-date">${date}</span>`;
        item.addEventListener('click', () => loadProject(proj.id));
        projectsList.appendChild(item);
    });
}

function loadProject(id) {
    const projects = JSON.parse(localStorage.getItem('visualiser_projects') || '[]');
    const proj = projects.find(p => p.id === id);
    if (!proj) return;

    currentProjectId = proj.id;
    conversationHistory = proj.history;
    currentGeneratedHtml = proj.html;

    chatHistoryContainer.innerHTML = '';
    proj.history.forEach(msg => {
        if (msg.role === 'user') {
            const cleanText = msg.parts[0].text.replace('Create or update this visual component: ', '');
            addChatBubble(cleanText, true);
        } else {
            addChatBubble("Visual updated.", false, 'success');
        }
    });

    clearConsole();
    promptQueue.length = 0;
    isGenerating = false;
    updateGenerateButtonState(false);
    
    previewFrame.srcdoc = injectErrorCatcher(currentGeneratedHtml);
    appContainer.className = 'view-studio';
    isFirstGeneration = false;
    projectsModal.style.display = 'none';
    if (appFavicon) appFavicon.href = '/studio_favicon.png';
    
    if (typeof initRepoView === 'function') initRepoView();
    
    studioBtnIcon.style.display = 'inline-block';
    studioBtnIcon.innerHTML = `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>`;
    studioBtnText.innerText = 'Save';
    
    isCodeViewActive = false;
    previewFrame.style.display = 'block';
    codeView.style.display = 'none';
    codePeekBtn.classList.remove('active');
    
    setTimeout(() => { chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight; }, 50);
}

function setLiveSubtaskText(text) {
    const initSub = document.getElementById('initial-loader-subtext');
    if (initSub) initSub.innerText = text;
    
    const chatSub = document.getElementById('chat-loading-subtext');
    if (chatSub) chatSub.innerText = text;
}

function updateLoaderUI(stepData) {
    const gifPath = `/load/${stepData.gif}`;
    
    const initGif = document.getElementById('initial-loader-gif');
    const initText = document.getElementById('initial-loader-text');
    if (initGif) initGif.src = gifPath;
    if (initText) initText.innerText = stepData.text;

    const chatImg = document.querySelector('#chat-loading-bubble img');
    const chatText = document.getElementById('chat-loading-text');
    if (chatImg) chatImg.src = gifPath;
    if (chatText) chatText.innerText = stepData.text;
}

function processLoadingSequence() {
    if (currentLoadingStep < loadingSequence.length) {
        const stepData = loadingSequence[currentLoadingStep];
        updateLoaderUI(stepData);
        const waitTime = stepData.time;
        currentLoadingStep++;
        if (currentLoadingStep < loadingSequence.length) {
            loaderTimer = setTimeout(processLoadingSequence, waitTime);
        }
    }
}

function startInitialLoading() {
    appContainer.className = 'view-loading';
    setLiveSubtaskText('');
    currentLoadingStep = 0;
    processLoadingSequence();
}

function startRevisionLoading() {
    setLiveSubtaskText('');
    
    const tempLoadingBubble = document.createElement('div');
    tempLoadingBubble.id = 'chat-loading-bubble';
    tempLoadingBubble.classList.add('chat-bubble', 'loading-bubble');
    tempLoadingBubble.innerHTML = `
        <img class="mini-gif dark-mode-gif" src=""> 
        <div class="loading-text-col">
            <span id="chat-loading-text"></span>
            <span id="chat-loading-subtext" class="loader-subtext"></span>
        </div>`;
    chatHistoryContainer.appendChild(tempLoadingBubble);
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    
    currentLoadingStep = 0;
    processLoadingSequence();
}

function stopLoading() {
    clearTimeout(loaderTimer);
    if (!isFirstGeneration) {
        const tempBubble = document.getElementById('chat-loading-bubble');
        if (tempBubble) tempBubble.remove();
    }
}

function addChatBubble(text, isUser, type = 'normal') {
    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble');
    bubble.classList.add(isUser ? 'user-bubble' : 'model-bubble');
    if (type === 'success') {
        bubble.innerHTML = `<div style="display:flex;align-items:center;gap:0.5rem;">${successSvg} <span>${text}</span></div>`;
    } else if (type === 'error') {
        bubble.innerHTML = `<div style="display:flex;align-items:center;gap:0.5rem;">${errorSvg} <span>${text}</span></div>`;
    } else {
        bubble.innerText = text;
    }
    chatHistoryContainer.appendChild(bubble);
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
}

generateBtn.addEventListener('click', () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) { alert('You need to set your API key first!'); return; }
    if (!canGenerate()) { alert('Limit reached! Check back tomorrow.'); return; }

    const userPrompt = promptInput.value.trim();
    if (!userPrompt) return;

    if (isFirstGeneration && promptQueue.length === 0 && !isGenerating) {
        currentProjectId = null;
        studioBtnText.innerText = 'Open in Studio';
        studioBtnIcon.style.display = 'none';
    }

    addChatBubble(userPrompt, true);
    promptInput.value = ''; 
    clearConsole();

    promptQueue.push(userPrompt);
    processQueue();
});

async function processQueue() {
    if (isGenerating || promptQueue.length === 0) return;
    
    isGenerating = true;
    updateGenerateButtonState(true);
    
    const userPrompt = promptQueue.shift();

    if (userPrompt === 'husxjfw-crash') {
        if (isFirstGeneration) startInitialLoading(); else startRevisionLoading();
        
        setTimeout(() => {
            const crashHtml = `<!DOCTYPE html><html><head><style>body{background:#0f172a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;}</style></head><body><h2>Loading visual...</h2><script>setTimeout(() => { console.error("Uncaught TypeError: Cannot read properties of undefined (reading 'init')"); throw new Error("Intentional test error triggered by husxjfw-crash sequence"); }, 1500);</script></body></html>`;
            currentGeneratedHtml = crashHtml;
            previewFrame.srcdoc = injectErrorCatcher(crashHtml);
            
            if (isFirstGeneration) {
                appContainer.className = 'view-workspace';
                isFirstGeneration = false;
            }
            
            addChatBubble("Visual updated.", false, 'success');
            incrementUsage();
            stopLoading();
            
            isGenerating = false;
            if (promptQueue.length === 0) updateGenerateButtonState(false);
            processQueue();
        }, 3000);
        return;
    }

    conversationHistory.push({ role: "user", parts: [{ text: `Create or update this visual component: ${userPrompt}` }] });
    
    if (isFirstGeneration) startInitialLoading(); else startRevisionLoading();

    if (isCodeViewActive) {
        isCodeViewActive = false;
        previewFrame.style.display = 'block';
        codeView.style.display = 'none';
        codePeekBtn.classList.remove('active');
    }

    try {
        const apiResponse = await callGeminiAPI(localStorage.getItem('gemini_api_key'));
        const generatedHtml = apiResponse.code;
        
        if (isFirstGeneration) {
            appContainer.className = 'view-workspace';
            isFirstGeneration = false;
            setTimeout(() => { chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight; }, 50);
        }
        
        conversationHistory.push({ role: "model", parts: [{ text: apiResponse.rawText }] });
        addChatBubble("Visual updated.", false, 'success');
        incrementUsage();
        
        currentGeneratedHtml = generatedHtml; 
        previewFrame.srcdoc = injectErrorCatcher(generatedHtml);

    } catch (error) {
        console.error("Error generating visual:", error);
        addChatBubble(`Error: ${error.message}`, false, 'error');
        conversationHistory.pop(); 
        if (isFirstGeneration) appContainer.className = 'view-home';
    } finally {
        stopLoading();
        isGenerating = false;
        if (promptQueue.length === 0) updateGenerateButtonState(false);
        processQueue(); 
    }
}

async function callGeminiAPI(apiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`;
    
    const systemInstruction = `You are an expert web developer. The user wants a web-based visualiser, graph, or interactive element. 
Write a single, self-contained HTML file containing all necessary CSS and JS inline. Use public CDN links (like Chart.js or D3) if required. 

You must output your response in three exact phases using these tags:
1. {task="Short, grammatically correct task description"}
2. [thinking: your detailed internal reasoning]
3. <code_output>
the raw html/css/js code
</code_output>

CRITICAL: You MUST use the {task="..."} and [thinking: ...] tags AT LEAST 3 times before outputting the final code to show your step-by-step progress. Ensure the task descriptions have correct grammar (e.g., "Drafting the basic layout..."). ALWAYS wrap the final code in <code_output> and </code_output> and DO NOT use markdown code blocks.`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: conversationHistory
        })
    });

    if (!response.ok) {
        const rawText = await response.text();
        let errMsg = `Failed to fetch from API (Status: ${response.status})`;
        try {
            const errorData = JSON.parse(rawText);
            errMsg = errorData.error?.message || errMsg;
        } catch (e) {
            errMsg = `HTTP ${response.status}: Gateway or parsing error.`;
        }
        if (response.status === 429 || errMsg.toLowerCase().includes('too many requests')) {
            setLimitReached();
            throw new Error("Limit reached (Too many requests).");
        }
        throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = '';
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop(); 
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(dataStr);
                    const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    fullText += textChunk;
                    
                    const tasks = [...fullText.matchAll(/\{task="([^"]+)"\}/g)];
                    if (tasks.length > 0) {
                        setLiveSubtaskText(tasks[tasks.length - 1][1]);
                    }
                } catch(e) {}
            }
        }
    }

    if (!fullText) throw new Error('No content returned from Gemini.');
    
    let code = fullText;
    const codeStart = fullText.indexOf('<code_output>');
    if (codeStart !== -1) {
        let codeEnd = fullText.lastIndexOf('</code_output>');
        if (codeEnd === -1) codeEnd = fullText.length;
        code = fullText.substring(codeStart + 13, codeEnd).trim();
    } else {
        code = fullText.replace(/^\s*```html\s*/i, '').replace(/```\s*$/, '').trim();
    }

    return { code, rawText: fullText };
}

// Auto-load project from URL if returning from GitHub
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const loadPid = urlParams.get('load');
    if (loadPid) {
        setTimeout(() => loadProject(loadPid), 100);
        window.history.replaceState({}, document.title, '/');
    }
});