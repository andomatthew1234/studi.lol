// App Tab Handling
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

window.updateMainTabSlider = function(btn) {
    const slider = document.getElementById('mainTabSlider');
    if (btn && slider) { slider.style.width = `${btn.offsetWidth}px`; slider.style.left = `${btn.offsetLeft}px`; }
};

window.switchTab = function(targetId) {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    const targetBtn = document.querySelector(`[data-target="${targetId}"]`);
    if(targetBtn) {
        targetBtn.classList.add('active');
        updateMainTabSlider(targetBtn);
    }
    document.getElementById(targetId).classList.add('active');
    
    if (targetId === 'projects-tab' && window.renderProjects) window.renderProjects();
};

tabBtns.forEach(btn => btn.addEventListener('click', () => window.switchTab(btn.getAttribute('data-target'))));

// Viewer Tab Handling (This is what was missing!)
const vTabBtns = document.querySelectorAll('.v-tab-btn');
const vPanes = document.querySelectorAll('.v-pane');

window.updateVTabSlider = function(btn) {
    const slider = document.getElementById('vTabSlider');
    if (btn && slider) { slider.style.width = `${btn.offsetWidth}px`; slider.style.left = `${btn.offsetLeft}px`; }
};

vTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        vTabBtns.forEach(b => b.classList.remove('active'));
        vPanes.forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-vtarget');
        document.getElementById(targetId).classList.add('active');
        
        window.updateVTabSlider(btn);

        // Wake up clawboard canvas if that tab is clicked
        if (targetId === 'v-clawboard' && window.initClawboard) {
            window.initClawboard();
        }
    });
});

window.addEventListener('resize', () => {
    const activeMain = document.querySelector('.tab-btn.active');
    if(activeMain) window.updateMainTabSlider(activeMain);
    
    const activeVTab = document.querySelector('.v-tab-btn.active');
    if(activeVTab && document.getElementById('projectViewer').style.display !== 'none') {
        window.updateVTabSlider(activeVTab);
    }
});

// Config Handling
const apiKeyInput = document.getElementById('apiKey');
const saveBadge = document.getElementById('saveBadge');
let saveTimeout;
if (window.getApiKey()) apiKeyInput.value = window.getApiKey();

apiKeyInput.addEventListener('input', (e) => {
    localStorage.setItem('studiApiKey', e.target.value.trim());
    saveBadge.classList.add('show');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveBadge.classList.remove('show'), 2000);
});

// File Upload Handling
window.attachedFile = null;
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const clearFileBtn = document.getElementById('clearFileBtn');

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        window.attachedFile = { mimeType: file.type, data: e.target.result.split(',')[1] };
        fileNameDisplay.innerText = file.name;
        clearFileBtn.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

clearFileBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation(); 
    window.attachedFile = null; fileInput.value = "";
    fileNameDisplay.innerText = "Click or drag to upload";
    clearFileBtn.style.display = 'none';
});