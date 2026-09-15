const canvasContainer = document.getElementById('canvasContainer');
const canvas = document.getElementById('clawCanvas');
const ctx = canvas.getContext('2d');
let isDrawing = false, currentBrushColor = '#1e293b', isErasing = false;
let clawSaveTimeout;

window.initClawboard = function() {
    const rect = canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Save current canvas state to memory just in case of a window resize
    const tempSave = canvas.toDataURL('image/png');
    
    // Resizing the canvas inherently wipes it, which is why drawings were disappearing
    canvas.width = rect.width * dpr; 
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`; 
    canvas.style.height = `${rect.height}px`;
    
    ctx.scale(dpr, dpr); 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    
    // Pull the saved drawing from the project database, or the temp memory
    const imgSrc = (window.currentProject && window.currentProject.clawboard) 
        ? window.currentProject.clawboard 
        : tempSave;
        
    if (imgSrc) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = imgSrc;
    }
};

window.addEventListener('resize', () => {
    if (document.getElementById('projectViewer').style.display === 'flex' && 
        document.getElementById('v-clawboard').classList.contains('active')) {
        window.initClawboard();
    }
});

canvas.addEventListener('pointerdown', (e) => { isDrawing = true; ctx.beginPath(); draw(e); });
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', () => { isDrawing = false; ctx.beginPath(); });
canvas.addEventListener('pointerout', () => { isDrawing = false; ctx.beginPath(); });

function draw(e) {
    if (!isDrawing) return;
    
    // Dynamically grab pressure data from the stylus, fallback to mouse
    let pressure = (e.pointerType !== 'pen' && e.pressure === 0) ? 0.5 : (e.pressure || 0.5); 
    
    ctx.lineWidth = (isErasing ? 25 : 8) * pressure;
    ctx.strokeStyle = isErasing ? '#fcfcfc' : currentBrushColor;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke(); 
    ctx.beginPath(); 
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

// Tool Switching
document.querySelectorAll('.claw-tool').forEach(btn => {
    btn.addEventListener('click', () => {
        isErasing = false; 
        currentBrushColor = btn.getAttribute('data-color');
        document.querySelectorAll('.claw-tool').forEach(b => b.classList.remove('active'));
        document.getElementById('clawEraserBtn').classList.remove('active');
        btn.classList.add('active');
    });
});

document.getElementById('clawEraserBtn').addEventListener('click', (e) => {
    isErasing = true;
    document.querySelectorAll('.claw-tool').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
});

document.getElementById('clawClearBtn').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Resilient Saving
document.getElementById('clawSaveBtn').addEventListener('click', async () => {
    if (!window.currentProject) return;
    
    const saveBtn = document.getElementById('clawSaveBtn');
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    // Force a tiny pause so the UI renders the "Saving..." text before locking the thread
    await new Promise(resolve => setTimeout(resolve, 300));

    const drawingData = canvas.toDataURL('image/png');
    window.currentProject.clawboard = drawingData;
    
    // Explicitly update the master array in case the reference detached
    const projectIndex = window.studiProjects.findIndex(p => p.id === window.currentProject.id);
    if (projectIndex !== -1) {
        window.studiProjects[projectIndex].clawboard = drawingData;
        window.saveProjectsToDB();
    }

    saveBtn.innerText = "Save Board";
    saveBtn.disabled = false;
    
    const badge = document.getElementById('clawSaveBadge');
    badge.classList.add('show');
    clearTimeout(clawSaveTimeout);
    clawSaveTimeout = setTimeout(() => badge.classList.remove('show'), 2000);
});