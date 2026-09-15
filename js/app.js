// Generation Prompts
const guidePrompt = `You are an educational study guide generator. Output ONLY a raw HTML file perfectly matching the template.
TEMPLATE TO USE:
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #2c3e50; background-color: #f4f7f6; overflow-x: hidden; }
        .module { background: #ffffff; padding: 1.5rem; margin-bottom: 2rem; border-radius: 8px; border-left: 5px solid #2b6cb0; width: 100%; }
        .flashcard-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .flashcard { width: 100%; height: 180px; perspective: 1000px; cursor: pointer; }
        .flashcard-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s; transform-style: preserve-3d; }
        .flashcard.flipped .flashcard-inner { transform: rotateY(180deg); }
        .flashcard-front, .flashcard-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; align-items: center; justify-content: center; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .flashcard-front { background-color: #ebf8ff; color: #2b6cb0; font-weight: bold; }
        .flashcard-back { background-color: #2b6cb0; color: white; transform: rotateY(180deg); overflow-y: auto; }
    </style>
</head>
<body><h1>Your Guided Study Plan</h1></body></html>`;

// Study Guide Generation
document.getElementById('generateBtn').addEventListener('click', async () => {
    const text = document.getElementById('sourceText').value.trim();
    if (!window.getApiKey()) return document.getElementById('errorText').innerText = "Missing API key!";
    
    document.getElementById('input-section').style.display = 'none';
    document.getElementById('status-section').style.display = 'block';

    const parts = [{ text: guidePrompt }, { text: text || "Create a study guide from attached doc." }];
    if (window.attachedFile) parts.push({ inlineData: window.attachedFile });

    try {
        const data = await window.dynamicGeminiFetch(window.getApiKey(), { contents: [{ parts }] }, (m) => document.getElementById('statusMessage').innerText = m);
        window.generatedHTML = data.candidates[0].content.parts[0].text.replace(/^```html\n?/, '').replace(/```$/, '').trim();
        document.getElementById('radarIcon').style.display = 'none';
        document.getElementById('successIcon').style.display = 'block';
        document.getElementById('saveProjectBtn').style.display = 'block';
    } catch (e) {
        document.getElementById('status-section').style.display = 'none';
        document.getElementById('input-section').style.display = 'block';
        document.getElementById('errorText').innerText = e.message;
    }
});

// Viewer Rendering
window.renderProjects = function() {
    const list = document.getElementById('projectsList');
    if (window.studiProjects.length === 0) {
        document.getElementById('projectsEmptyText').style.display = 'block';
        return list.innerHTML = '';
    }
    
    document.getElementById('projectsEmptyText').style.display = 'none';
    
    list.innerHTML = window.studiProjects.map(p => `
        <div class="project-card" onclick="openProject('${p.id}')">
            <div class="project-info"><h3>${p.title}</h3><p>Created on ${p.date}</p></div>
            <button class="delete-btn" onclick="deleteProject(event, '${p.id}')" title="Delete guide">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>`).join('');
};

window.openProject = function(id) {
    window.currentProject = window.studiProjects.find(p => p.id === id);
    document.getElementById('viewerTitle').innerText = window.currentProject.title;
    document.getElementById('viewerFrame').srcdoc = window.currentProject.html;
    
    // Ensure Study tab is open and Text is active in sidebar by default
    document.querySelectorAll('.v-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.v-pane').forEach(p => p.classList.remove('active'));
    const studyTab = document.querySelector('[data-vtarget="v-study"]');
    studyTab.classList.add('active');
    document.getElementById('v-study').classList.add('active');
    
    document.querySelectorAll('.s-tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.s-view').forEach(v => v.classList.remove('active'));
    document.querySelector('[data-sview="s-text"]').classList.add('active');
    document.getElementById('s-text').classList.add('active');
    
    // Fix slider width rendering
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('projectViewer').style.display = 'flex';
    setTimeout(() => { window.updateVTabSlider(studyTab); }, 10);
};

document.getElementById('closeViewerBtn').addEventListener('click', () => {
    document.getElementById('projectViewer').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    if(window.stopAudioPlayback) window.stopAudioPlayback();
});

document.getElementById('saveProjectBtn').addEventListener('click', () => {
    window.studiProjects.unshift({ id: Date.now().toString(), title: prompt("Name:") || "Untitled", date: new Date().toLocaleDateString(), html: window.generatedHTML });
    window.saveProjectsToDB(); window.switchTab('projects-tab');
});

window.deleteProject = function(e, id) {
    e.stopPropagation();
    if(confirm("Delete this study guide?")) {
        window.studiProjects = window.studiProjects.filter(p => p.id !== id);
        window.saveProjectsToDB(); window.renderProjects();
    }
};

window.renderProjects();