// Side Bar Toggles
document.querySelectorAll('.s-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.s-tool-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.s-view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-sview')).classList.add('active');
    });
});

document.getElementById('selectGeminiAudioBtn').addEventListener('click', () => {
    document.getElementById('geminiAudioUI').style.display = 'block';
    document.getElementById('speechSynthUI').style.display = 'none';
});
document.getElementById('selectSpeechSynthBtn').addEventListener('click', () => {
    document.getElementById('geminiAudioUI').style.display = 'none';
    document.getElementById('speechSynthUI').style.display = 'block';
});

// Gemini TTS
let lastGeneratedAudioBuffer = null;
let currentAudioContext = null;
let currentAudioSource = null;

window.stopAudioPlayback = function() {
    if (currentAudioSource) { currentAudioSource.stop(); currentAudioSource = null; }
};

document.getElementById('generateAudioBtn').addEventListener('click', async () => {
    const text = document.getElementById('audioSourceText').value.trim();
    if (!window.getApiKey() || !text) return;

    document.getElementById('audioInputControls').style.display = 'none';
    document.getElementById('audioLoadingState').style.display = 'flex';
    
    try {
        const data = await window.dynamicGeminiFetch(
            window.getApiKey(),
            { contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ["AUDIO"] } },
            (msg) => document.getElementById('audioStatusMessage').innerText = msg,
            'v1alpha', window.AUDIO_MODEL_CHAIN
        );
        const audioPart = data.candidates[0].content.parts.find(p => p.inlineData);
        lastGeneratedAudioBuffer = audioPart.inlineData.data;
        document.getElementById('audioPlayerContainer').style.display = 'block';
    } catch (err) {
        document.getElementById('audioErrorText').innerText = err.message;
    } finally {
        document.getElementById('audioLoadingState').style.display = 'none';
        document.getElementById('audioInputControls').style.display = 'block';
    }
});

document.getElementById('playGeminiAudioBtn').addEventListener('click', () => {
    if (!lastGeneratedAudioBuffer) return;
    window.stopAudioPlayback();
    const binaryString = window.atob(lastGeneratedAudioBuffer);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    
    currentAudioContext = currentAudioContext || new (window.AudioContext || window.webkitAudioContext)();
    const floatArray = new Float32Array(bytes.length / 2);
    for (let i = 0; i < floatArray.length; i++) {
        const int16 = new DataView(bytes.buffer).getInt16(i * 2, true); 
        floatArray[i] = int16 < 0 ? int16 / 32768 : int16 / 32767;
    }
    const audioBuffer = currentAudioContext.createBuffer(1, floatArray.length, 24000);
    audioBuffer.getChannelData(0).set(floatArray);
    
    currentAudioSource = currentAudioContext.createBufferSource();
    currentAudioSource.buffer = audioBuffer;
    currentAudioSource.connect(currentAudioContext.destination);
    currentAudioSource.start();
});

// Basic Browser Speech
document.getElementById('playBasicAudioBtn').addEventListener('click', () => {
    if (!window.currentProject) return;
    const tempDiv = document.createElement('div');
    const bodyMatch = window.currentProject.html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    tempDiv.innerHTML = bodyMatch ? bodyMatch[1] : window.currentProject.html;
    tempDiv.querySelectorAll('script, style').forEach(el => el.remove()); // Strip CSS code so it isn't read aloud
    
    const sentences = tempDiv.textContent.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+/g) || [];
    window.speechSynthesis.cancel(); 
    sentences.forEach((sentence, i) => {
        const utterance = new SpeechSynthesisUtterance(sentence.trim());
        if (i === 0) utterance.onstart = () => { document.getElementById('playBasicAudioBtn').style.display = 'none'; document.getElementById('stopBasicAudioBtn').style.display = 'block'; };
        if (i === sentences.length - 1) utterance.onend = () => { document.getElementById('playBasicAudioBtn').style.display = 'block'; document.getElementById('stopBasicAudioBtn').style.display = 'none'; };
        window.speechSynthesis.speak(utterance);
    });
});
document.getElementById('stopBasicAudioBtn').addEventListener('click', () => {
    window.speechSynthesis.cancel();
    document.getElementById('playBasicAudioBtn').style.display = 'block';
    document.getElementById('stopBasicAudioBtn').style.display = 'none';
});