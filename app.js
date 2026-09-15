// Local Database logic
let studiProjects = JSON.parse(localStorage.getItem('studiProjects')) || [];

function saveProjectsToDB() {
    localStorage.setItem('studiProjects', JSON.stringify(studiProjects));
}

// We drop the -tts models to prevent 404s. Standard models will route to v1alpha for audio bypass.
const MODEL_FALLBACK_CHAIN = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash'
];

// Main App Tab Logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

function updateMainTabSlider(btn) {
    const slider = document.getElementById('mainTabSlider');
    if (btn && slider) {
        slider.style.width = `${btn.offsetWidth}px`;
        slider.style.left = `${btn.offsetLeft}px`;
    }
}

function switchTab(targetId) {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    
    const targetBtn = document.querySelector(`[data-target="${targetId}"]`);
    targetBtn.classList.add('active');
    document.getElementById(targetId).classList.add('active');
    
    updateMainTabSlider(targetBtn);

    if (targetId === 'projects-tab') {
        renderProjects();
    }
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-target'));
    });
});

// Config & API Key Logic
const apiKeyInput = document.getElementById('apiKey');
const saveBadge = document.getElementById('saveBadge');
let saveTimeout;

const storedKey = localStorage.getItem('studiApiKey');
if (storedKey) apiKeyInput.value = storedKey;

apiKeyInput.addEventListener('input', (e) => {
    localStorage.setItem('studiApiKey', e.target.value.trim());
    saveBadge.classList.add('show');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveBadge.classList.remove('show'), 2000);
});

// File Upload Logic
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const clearFileBtn = document.getElementById('clearFileBtn');
let attachedFile = null;

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileSelect(e.target.files[0]);
});

function handleFileSelect(file) {
    if (!file) return;
    const validTypes = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
        document.getElementById('errorText').innerText = "Unsupported file type. Please use PDF, TXT, or images.";
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Data = e.target.result.split(',')[1];
        attachedFile = { mimeType: file.type, data: base64Data };
        fileNameDisplay.innerText = file.name;
        fileNameDisplay.style.color = '#3b82f6';
        clearFileBtn.style.display = 'block';
        document.getElementById('errorText').innerText = "";
    };
    reader.readAsDataURL(file);
}

clearFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); 
    attachedFile = null;
    fileInput.value = "";
    fileNameDisplay.innerText = "Click or drag to upload (PDF, TXT, Images)";
    fileNameDisplay.style.color = '#64748b';
    clearFileBtn.style.display = 'none';
});

// Resilient Dynamic Fetch with Model Fallback (Handles API Version Routing)
async function dynamicGeminiFetch(apiKey, bodyPayload, onStatusUpdate, apiVersion = 'v1beta', chain = MODEL_FALLBACK_CHAIN) {
    for (let i = 0; i < chain.length; i++) {
        const model = chain[i];
        let attempt = 1;

        while (attempt <= 2) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(bodyPayload)
                    }
                );

                if (response.ok) return await response.json();

                if (response.status === 429) {
                    if (i < chain.length - 1) {
                        onStatusUpdate(`Rate limit hit on ${model}. Switching to ${chain[i + 1]}...`);
                    }
                    break; 
                } 
                else if (response.status === 503 || response.status >= 500) {
                    onStatusUpdate(`Google busy on ${model}. Retrying...`);
                    await new Promise(r => setTimeout(r, 2000));
                    attempt++;
                } else {
                    throw new Error(`API error (${response.status}). Check key.`);
                }
            } catch (err) {
                if (err.message.includes("API error")) throw err;
                onStatusUpdate(`Network retry on ${model}...`);
                await new Promise(r => setTimeout(r, 2000));
                attempt++;
            }
        }
    }
    throw new Error("All fallback models hit rate limits. Give it a minute and try again.");
}

// AI Guide Generation Logic
const generateBtn = document.getElementById('generateBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const resetBtn = document.getElementById('resetBtn');
const errorText = document.getElementById('errorText');

const inputSection = document.getElementById('input-section');
const statusSection = document.getElementById('status-section');
const statusMessage = document.getElementById('statusMessage');

let generatedHTML = "";
let textCycleTimeout;
let isSwitchingModel = false;

// Fixed word wrapping and strict boundaries to prevent cutoff
const guideSystemPrompt = `You are an educational study guide generator. 
You must output ONLY a raw HTML file (no markdown formatting like \`\`\`html) that perfectly matches the styling and structure of the template provided. Do not add any conversational text.

TEMPLATE TO USE:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guided Study Plan & Revision</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; width: 100%; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #2c3e50; background-color: #f4f7f6; overflow-x: hidden; word-wrap: break-word; overflow-wrap: break-word; }
        h1, h2 { color: #2b6cb0; }
        .module { background: #ffffff; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-left: 5px solid #2b6cb0; width: 100%; overflow: hidden; }
        .step-title { font-weight: bold; color: #4a5568; margin-top: 0; }
        .flashcard-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 1rem; }
        .flashcard { background-color: transparent; width: 100%; height: 180px; perspective: 1000px; cursor: pointer; }
        .flashcard-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s; transform-style: preserve-3d; }
        .flashcard.flipped .flashcard-inner { transform: rotateY(180deg); }
        .flashcard-front, .flashcard-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .flashcard-front { background-color: #ebf8ff; color: #2b6cb0; font-weight: bold; font-size: 1.1em; }
        .flashcard-back { background-color: #2b6cb0; color: white; transform: rotateY(180deg); font-size: 0.9em; overflow-y: auto; }
        .task-list label { display: block; margin-bottom: 0.5rem; cursor: pointer; }
        .guide-text { background: #fff3cd; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; font-size: 0.95em; width: 100%; }
    </style>
</head>
<body>
    <h1>Your Guided Study Plan</h1>
    <div class="guide-text">
        <strong>How to use this guide:</strong> Work through each module sequentially. Tick off the learning goals. Click the flashcards to test your memory before moving to the next step.
    </div>
</body>
</html>`;

function startGuideLoadingSequence() {
    isSwitchingModel = false;
    clearTimeout(textCycleTimeout);
    
    inputSection.style.display = 'none';
    statusSection.style.display = 'flex'; // Uses flex for the radar box centering
    
    document.getElementById('radarIcon').style.display = 'block';
    document.getElementById('successIcon').style.display = 'none';
    saveProjectBtn.style.display = 'none';
    resetBtn.style.display = 'none';
    
    statusMessage.style.color = '#3b82f6';
    statusMessage.innerText = "Connecting to Gemini...";
    statusMessage.style.opacity = 1;

    const sequence = [
        { text: "Processing inputted information...", delay: 4000 },
        { text: "Creating study sheet...", delay: 5000 },
        { text: "Nearly done...", delay: 5000 },
        { text: "Finishing up...", delay: 10000 }
    ];
    
    let index = 0;
    function nextStep() {
        if (isSwitchingModel) return;
        if (index < sequence.length) {
            statusMessage.style.opacity = 0;
            setTimeout(() => {
                if (isSwitchingModel) return;
                statusMessage.innerText = sequence[index].text;
                statusMessage.style.opacity = 1;
                textCycleTimeout = setTimeout(nextStep, sequence[index].delay);
                index++;
            }, 300);
        }
    }
    textCycleTimeout = setTimeout(nextStep, 2000);
}

generateBtn.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('studiApiKey') || "";
    const sourceText = document.getElementById('sourceText').value.trim();

    if (!apiKey) {
        errorText.innerText = "Missing API key! Head over to the Config tab to set it.";
        return;
    }
    if (!sourceText && !attachedFile) {
        errorText.innerText = "Please paste some notes or upload a file!";
        return;
    }

    errorText.innerText = "";
    startGuideLoadingSequence();

    const promptParts = [{ text: guideSystemPrompt }];
    if (sourceText) promptParts.push({ text: `Notes to turn into a study guide:\n\n${sourceText}` });
    else promptParts.push({ text: `Create a study guide based on the attached document.` });
    
    if (attachedFile) {
        promptParts.push({
            inlineData: { mimeType: attachedFile.mimeType, data: attachedFile.data }
        });
    }

    try {
        const data = await dynamicGeminiFetch(
            apiKey,
            {
                contents: [{ parts: promptParts }],
                generationConfig: { temperature: 0.2 }
            },
            (msg) => {
                isSwitchingModel = true;
                clearTimeout(textCycleTimeout);
                statusMessage.style.opacity = 0;
                setTimeout(() => {
                    statusMessage.innerText = msg;
                    statusMessage.style.color = '#f59e0b';
                    statusMessage.style.opacity = 1;
                }, 300);
            },
            'v1beta',
            MODEL_FALLBACK_CHAIN
        );

        generatedHTML = data.candidates[0].content.parts[0].text;
        generatedHTML = generatedHTML.replace(/^```html\n?/, '').replace(/```$/, '').trim();

        clearTimeout(textCycleTimeout);
        document.getElementById('radarIcon').style.display = 'none';
        document.getElementById('successIcon').style.display = 'block';
        statusMessage.innerText = "Ready to go!";
        statusMessage.style.color = '#10b981';
        saveProjectBtn.style.display = 'block';
        resetBtn.style.display = 'block';
    } catch (error) {
        clearTimeout(textCycleTimeout);
        statusSection.style.display = 'none';
        inputSection.style.display = 'block';
        errorText.innerText = `Error: ${error.message}`;
    }
});

// Projects Management
saveProjectBtn.addEventListener('click', () => {
    const title = prompt("Give this study guide a name:", "New Study Guide");
    if (!title) return;
    
    const newProject = {
        id: Date.now().toString(),
        title: title.trim() || "Untitled Guide",
        date: new Date().toLocaleDateString(),
        html: generatedHTML,
        masteryHtml: null,
        clawboard: null
    };
    
    studiProjects.unshift(newProject);
    saveProjectsToDB();
    resetCreateForm();
    switchTab('projects-tab');
});

resetBtn.addEventListener('click', resetCreateForm);

function resetCreateForm() {
    document.getElementById('sourceText').value = "";
    if (attachedFile) clearFileBtn.click();
    statusSection.style.display = 'none';
    inputSection.style.display = 'block';
    generatedHTML = "";
}

function renderProjects() {
    const list = document.getElementById('projectsList');
    const emptyText = document.getElementById('projectsEmptyText');
    
    if (studiProjects.length === 0) {
        emptyText.style.display = 'block';
        list.innerHTML = '';
        return;
    }
    
    emptyText.style.display = 'none';
    list.innerHTML = studiProjects.map(p => `
        <div class="project-card" onclick="openProject('${p.id}')">
            <div class="project-info">
                <h3>${p.title}</h3>
                <p>Created on ${p.date}</p>
            </div>
            <button class="delete-btn" onclick="deleteProject(event, '${p.id}')" title="Delete guide">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `).join('');
}
renderProjects();

// Viewer & Slider Logic
const mainApp = document.getElementById('mainApp');
const projectViewer = document.getElementById('projectViewer');
const viewerFrame = document.getElementById('viewerFrame');
const viewerTitle = document.getElementById('viewerTitle');
const closeViewerBtn = document.getElementById('closeViewerBtn');

const vTabBtns = document.querySelectorAll('.v-tab-btn');
const vPanes = document.querySelectorAll('.v-pane');

const masteryEmptyState = document.getElementById('masteryEmptyState');
const masteryLoadingState = document.getElementById('masteryLoadingState');
const masteryStatusMessage = document.getElementById('masteryStatusMessage');
const masteryFrame = document.getElementById('masteryFrame');
const generateMasteryBtn = document.getElementById('generateMasteryBtn');
const masteryErrorText = document.getElementById('masteryErrorText');

let currentProject = null;
let masteryCycleTimeout;

function updateVTabSlider(btn) {
    const slider = document.getElementById('vTabSlider');
    if (btn && slider) {
        slider.style.width = `${btn.offsetWidth}px`;
        slider.style.left = `${btn.offsetLeft}px`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const activeMainTab = document.querySelector('.tab-btn.active');
    if(activeMainTab) updateMainTabSlider(activeMainTab);
});

window.addEventListener('resize', () => {
    const activeMainTab = document.querySelector('.tab-btn.active');
    if(activeMainTab) updateMainTabSlider(activeMainTab);
    
    const activeVTab = document.querySelector('.v-tab-btn.active');
    if(activeVTab && projectViewer.style.display !== 'none') {
        updateVTabSlider(activeVTab);
    }
    
    if (projectViewer.style.display === 'flex' && document.getElementById('v-clawboard').classList.contains('active')) {
        const tempSave = canvas.toDataURL();
        initClawboard();
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvasContainer.clientWidth, canvasContainer.clientHeight);
        img.src = tempSave;
    }
});

vTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        vTabBtns.forEach(b => b.classList.remove('active'));
        vPanes.forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-vtarget');
        document.getElementById(targetId).classList.add('active');
        
        updateVTabSlider(btn);

        if (targetId === 'v-clawboard') initClawboard();
    });
});

window.openProject = function(id) {
    currentProject = studiProjects.find(p => p.id === id);
    if (!currentProject) return;
    
    viewerTitle.innerText = currentProject.title;
    viewerFrame.srcdoc = currentProject.html;
    
    // Default to Study tab
    vTabBtns.forEach(b => b.classList.remove('active'));
    vPanes.forEach(p => p.classList.remove('active'));
    const firstTab = document.querySelector('[data-vtarget="v-study"]');
    firstTab.classList.add('active');
    document.getElementById('v-study').classList.add('active');

    // Reset Study sidebar to Text view tightly
    document.querySelectorAll('.s-tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.s-view').forEach(v => v.classList.remove('active'));
    document.querySelector('[data-sview="s-text"]').classList.add('active');
    document.getElementById('s-text').classList.add('active');
    document.getElementById('geminiAudioUI').style.display = 'none';
    document.getElementById('speechSynthUI').style.display = 'none';

    if (currentProject.masteryHtml) {
        masteryEmptyState.style.display = 'none';
        masteryLoadingState.style.display = 'none';
        masteryFrame.style.display = 'block';
        masteryFrame.srcdoc = currentProject.masteryHtml;
    } else {
        masteryEmptyState.style.display = 'flex';
        masteryLoadingState.style.display = 'none';
        masteryFrame.style.display = 'none';
        masteryErrorText.innerText = '';
    }
    
    mainApp.style.display = 'none';
    projectViewer.style.display = 'flex';
    
    setTimeout(() => {
        updateVTabSlider(firstTab);
    }, 10);
};

closeViewerBtn.addEventListener('click', () => {
    projectViewer.style.display = 'none';
    mainApp.style.display = 'block';
    viewerFrame.srcdoc = ''; 
    masteryFrame.srcdoc = '';
    currentProject = null;
    window.speechSynthesis.cancel();
    stopAudioPlayback();
});

window.deleteProject = function(event, id) {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this study guide?")) {
        studiProjects = studiProjects.filter(p => p.id !== id);
        saveProjectsToDB();
        renderProjects();
    }
};

// Study Sidebar Toggle Logic
const sToolBtns = document.querySelectorAll('.s-tool-btn');
const sViews = document.querySelectorAll('.s-view');

sToolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        sToolBtns.forEach(b => b.classList.remove('active'));
        sViews.forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-sview')).classList.add('active');
    });
});

// Audio Generation & Playback Logic
const selectGeminiAudioBtn = document.getElementById('selectGeminiAudioBtn');
const selectSpeechSynthBtn = document.getElementById('selectSpeechSynthBtn');
const geminiAudioUI = document.getElementById('geminiAudioUI');
const speechSynthUI = document.getElementById('speechSynthUI');

selectGeminiAudioBtn.addEventListener('click', () => {
    geminiAudioUI.style.display = 'block';
    speechSynthUI.style.display = 'none';
});

selectSpeechSynthBtn.addEventListener('click', () => {
    geminiAudioUI.style.display = 'none';
    speechSynthUI.style.display = 'block';
});

// 1. Gemini TTS Audio 
const audioSourceText = document.getElementById('audioSourceText');
const audioCharCount = document.getElementById('audioCharCount');
const generateAudioBtn = document.getElementById('generateAudioBtn');
const audioErrorText = document.getElementById('audioErrorText');
const audioLoadingState = document.getElementById('audioLoadingState');
const audioStatusMessage = document.getElementById('audioStatusMessage');
const audioInputControls = document.getElementById('audioInputControls');
const audioPlayerContainer = document.getElementById('audioPlayerContainer');
const playGeminiAudioBtn = document.getElementById('playGeminiAudioBtn');

let lastGeneratedAudioBuffer = null;
let currentAudioContext = null;
let currentAudioSource = null;
let audioCycleTimeout;

audioSourceText.addEventListener('input', () => {
    audioCharCount.innerText = audioSourceText.value.length;
});

function startAudioLoadingSequence() {
    clearTimeout(audioCycleTimeout);
    audioInputControls.style.display = 'none';
    audioLoadingState.style.display = 'flex';
    audioPlayerContainer.style.display = 'none';
    
    audioStatusMessage.style.color = '#3b82f6';
    audioStatusMessage.innerText = "Connecting to Gemini TTS...";
    audioStatusMessage.style.opacity = 1;

    const messages = [
        { text: "Analysing your text...", delay: 2500 },
        { text: "Synthesising human-like audio...", delay: 3500 },
        { text: "Finalising recording...", delay: 5000 }
    ];

    let index = 0;
    function nextStep() {
        if (index < messages.length) {
            audioStatusMessage.style.opacity = 0;
            setTimeout(() => {
                audioStatusMessage.innerText = messages[index].text;
                audioStatusMessage.style.opacity = 1;
                audioCycleTimeout = setTimeout(nextStep, messages[index].delay);
                index++;
            }, 300);
        }
    }
    audioCycleTimeout = setTimeout(nextStep, 1500);
}

generateAudioBtn.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('studiApiKey') || "";
    const text = audioSourceText.value.trim();
    
    if (!apiKey) {
        audioErrorText.innerText = "Missing API Key. Check the Config tab.";
        return;
    }
    if (!text) {
        audioErrorText.innerText = "Please paste some text to generate audio.";
        return;
    }

    startAudioLoadingSequence();

    try {
        const data = await dynamicGeminiFetch(
            apiKey,
            {
                contents: [{ parts: [{ text: text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } }
                }
            },
            (msg) => {
                clearTimeout(audioCycleTimeout);
                audioStatusMessage.style.opacity = 0;
                setTimeout(() => {
                    audioStatusMessage.innerText = msg;
                    audioStatusMessage.style.color = '#f59e0b';
                    audioStatusMessage.style.opacity = 1;
                }, 300);
            },
            'v1alpha', // Must force v1alpha here, otherwise standard flash ignores the audio config
            MODEL_FALLBACK_CHAIN // Uses the main standard models to avoid 404s
        );

        if (!data || !data.candidates || !data.candidates[0].content.parts) {
            throw new Error("Invalid API response format from Google.");
        }
        
        // Find the actual audio data block returned by the model
        const parts = data.candidates[0].content.parts;
        const audioPart = parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));
        
        if (!audioPart) {
            console.error("API Response:", data);
            throw new Error("Gemini returned text instead of audio. Your API key might not have access to the experimental v1alpha TTS endpoints yet.");
        }
        
        lastGeneratedAudioBuffer = audioPart.inlineData.data;
        
        clearTimeout(audioCycleTimeout);
        audioLoadingState.style.display = 'none';
        audioInputControls.style.display = 'block';
        audioPlayerContainer.style.display = 'block';
        audioErrorText.innerText = "";
        
    } catch (err) {
        clearTimeout(audioCycleTimeout);
        audioLoadingState.style.display = 'none';
        audioInputControls.style.display = 'block';
        audioErrorText.innerText = err.message;
    }
});

function stopAudioPlayback() {
    if (currentAudioSource) {
        currentAudioSource.stop();
        currentAudioSource = null;
    }
}

playGeminiAudioBtn.addEventListener('click', async () => {
    if (!lastGeneratedAudioBuffer) return;
    stopAudioPlayback();
    
    try {
        const binaryString = window.atob(lastGeneratedAudioBuffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const buffer = bytes.buffer;
        const view = new DataView(buffer);
        
        const sampleRate = 24000;
        currentAudioContext = currentAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        
        const floatArray = new Float32Array(bytes.length / 2);
        for (let i = 0; i < floatArray.length; i++) {
            const int16 = view.getInt16(i * 2, true); 
            floatArray[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
        }
        
        const audioBuffer = currentAudioContext.createBuffer(1, floatArray.length, sampleRate);
        audioBuffer.getChannelData(0).set(floatArray);
        
        currentAudioSource = currentAudioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(currentAudioContext.destination);
        currentAudioSource.start();
    } catch (e) {
        audioErrorText.innerText = "Error playing audio: " + e.message;
    }
});

// 2. Speech Synthesis Audio
const playBasicAudioBtn = document.getElementById('playBasicAudioBtn');
const stopBasicAudioBtn = document.getElementById('stopBasicAudioBtn');

playBasicAudioBtn.addEventListener('click', () => {
    if (!currentProject) return;
    
    // Safely parse the HTML to rip out hidden code and styles
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentProject.html, 'text/html');
    
    // Nuke styles and scripts so it never reads "margin 96px"
    doc.querySelectorAll('style, script, noscript, svg, link, meta').forEach(el => el.remove());
    
    let cleanText = doc.body.textContent || "";
    cleanText = cleanText.replace(/\s+/g, ' ').trim(); 
    
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
    window.speechSynthesis.cancel(); 
    
    sentences.forEach((sentence, index) => {
        const utterance = new SpeechSynthesisUtterance(sentence.trim());
        utterance.rate = 1.0;
        
        if (index === 0) {
            utterance.onstart = () => {
                playBasicAudioBtn.style.display = 'none';
                stopBasicAudioBtn.style.display = 'block';
            };
        }
        
        if (index === sentences.length - 1) {
            utterance.onend = () => {
                playBasicAudioBtn.style.display = 'block';
                stopBasicAudioBtn.style.display = 'none';
            };
        }
        window.speechSynthesis.speak(utterance);
    });
});

stopBasicAudioBtn.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    playBasicAudioBtn.style.display = 'block';
    stopBasicAudioBtn.style.display = 'none';
});

// Mastery (Quiz) Sequence & Generation
const masterySystemPrompt = `You are an educational quiz generator. 
Based ONLY on the provided study guide HTML, generate a 5-question multiple choice quiz to test the user's knowledge.
You must output ONLY a raw, complete HTML file (no markdown block wrappers). 
Include modern CSS styling (matching a clean, light theme), a form for the questions, and inline Javascript for a 'Check Answers' button at the bottom. 
When clicked, the Javascript must calculate the score, reveal it to the user, highlight correct answers in green, and incorrect answers in red.`;

function startMasteryLoadingSequence() {
    clearTimeout(masteryCycleTimeout);
    masteryEmptyState.style.display = 'none';
    masteryLoadingState.style.display = 'flex';
    masteryFrame.style.display = 'none';
    
    masteryStatusMessage.style.color = '#3b82f6';
    masteryStatusMessage.innerText = "Connecting to Gemini...";
    masteryStatusMessage.style.opacity = 1;

    const quizMessages = [
        { text: "Reading study sheet...", delay: 3500 },
        { text: "Drafting revision questions...", delay: 4500 },
        { text: "Setting up answer checking...", delay: 4500 },
        { text: "Finishing quiz...", delay: 8000 }
    ];

    let index = 0;
    function nextStep() {
        if (index < quizMessages.length) {
            masteryStatusMessage.style.opacity = 0;
            setTimeout(() => {
                masteryStatusMessage.innerText = quizMessages[index].text;
                masteryStatusMessage.style.opacity = 1;
                masteryCycleTimeout = setTimeout(nextStep, quizMessages[index].delay);
                index++;
            }, 300);
        }
    }
    masteryCycleTimeout = setTimeout(nextStep, 2000);
}

generateMasteryBtn.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('studiApiKey') || "";
    if (!apiKey) {
        masteryErrorText.innerText = "Error: Missing API key in Config tab.";
        return;
    }

    startMasteryLoadingSequence();

    try {
        const data = await dynamicGeminiFetch(
            apiKey,
            {
                contents: [{ 
                    parts: [
                        { text: masterySystemPrompt }, 
                        { text: `Here is the study guide HTML to base the quiz on:\n\n${currentProject.html}` }
                    ] 
                }],
                generationConfig: { temperature: 0.3 }
            },
            (msg) => {
                clearTimeout(masteryCycleTimeout);
                masteryStatusMessage.style.opacity = 0;
                setTimeout(() => {
                    masteryStatusMessage.innerText = msg;
                    masteryStatusMessage.style.color = '#f59e0b';
                    masteryStatusMessage.style.opacity = 1;
                }, 300);
            },
            'v1beta',
            MODEL_FALLBACK_CHAIN
        );

        clearTimeout(masteryCycleTimeout);
        let qHtml = data.candidates[0].content.parts[0].text;
        qHtml = qHtml.replace(/^```html\n?/, '').replace(/```$/, '').trim();

        currentProject.masteryHtml = qHtml;
        saveProjectsToDB();

        masteryLoadingState.style.display = 'none';
        masteryFrame.style.display = 'block';
        masteryFrame.srcdoc = currentProject.masteryHtml;
    } catch (error) {
        clearTimeout(masteryCycleTimeout);
        masteryLoadingState.style.display = 'none';
        masteryEmptyState.style.display = 'flex';
        masteryErrorText.innerText = error.message;
    }
});

// Clawboard Logic (Stylus & Pressure Support)
const canvasContainer = document.getElementById('canvasContainer');
const canvas = document.getElementById('clawCanvas');
const ctx = canvas.getContext('2d');
const clawTools = document.querySelectorAll('.claw-tool');
const clawEraserBtn = document.getElementById('clawEraserBtn');
const clawClearBtn = document.getElementById('clawClearBtn');
const clawSaveBtn = document.getElementById('clawSaveBtn');
const clawSaveBadge = document.getElementById('clawSaveBadge');

let isDrawing = false;
let currentBrushColor = '#1e293b';
let isErasing = false;
let clawSaveTimeout;

function initClawboard() {
    const rect = canvasContainer.getBoundingClientRect();
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentProject && currentProject.clawboard) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = currentProject.clawboard;
    }
}

function startDrawing(e) {
    isDrawing = true;
    ctx.beginPath();
    draw(e);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function draw(e) {
    if (!isDrawing) return;

    let pressure = e.pressure !== undefined ? e.pressure : 0.5;
    if (e.pointerType !== 'pen' && e.pressure === 0) pressure = 0.5; 

    const baseWidth = isErasing ? 25 : 8;
    ctx.lineWidth = baseWidth * pressure;
    ctx.strokeStyle = isErasing ? '#fcfcfc' : currentBrushColor;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

canvas.addEventListener('pointerdown', startDrawing);
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointerout', stopDrawing);

clawTools.forEach(btn => {
    btn.addEventListener('click', () => {
        isErasing = false;
        clawEraserBtn.classList.remove('active');
        clawTools.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBrushColor = btn.getAttribute('data-color');
    });
});

clawEraserBtn.addEventListener('click', () => {
    isErasing = true;
    clawTools.forEach(b => b.classList.remove('active'));
    clawEraserBtn.classList.add('active');
});

clawClearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

clawSaveBtn.addEventListener('click', () => {
    if (currentProject) {
        currentProject.clawboard = canvas.toDataURL();
        saveProjectsToDB();
        
        clawSaveBadge.classList.add('show');
        clearTimeout(clawSaveTimeout);
        clawSaveTimeout = setTimeout(() => clawSaveBadge.classList.remove('show'), 2000);
    }
});