// Nav and Views
const navItems = document.querySelectorAll('.nav-item:not(.disabled)');
const views = document.querySelectorAll('.view-section');
const backBtn = document.getElementById('back-btn');

// Wizard Elements
const wizardSteps = document.querySelectorAll('.wizard-step');
const progressBar = document.getElementById('progress-bar');
const btnNext = document.getElementById('wizard-next');
const btnPrev = document.getElementById('wizard-prev');
const wizardTokenInput = document.getElementById('wizard-token');
const saveTokenBtn = document.getElementById('save-token-btn');

// Gist Elements
const gistForm = document.getElementById('gist-form');
const ghTokenInput = document.getElementById('gh-token');
const descInput = document.getElementById('gist-desc');
const publicToggle = document.getElementById('gist-public');
const gistPublishBtn = document.getElementById('gist-publish-btn');
const gistErrorMsg = document.getElementById('gist-error-msg');
const gistEmptyState = document.getElementById('gist-empty-state');
const gistSuccessState = document.getElementById('gist-success-state');
const gistLinkInput = document.getElementById('gist-link');
const viewGistBtn = document.getElementById('view-gist-btn');

// Repo Elements
const repoPromptState = document.getElementById('repo-prompt-state');
const repoCreateState = document.getElementById('repo-create-state');
const repoActiveState = document.getElementById('repo-active-state');

const btnShowCreate = document.getElementById('btn-show-create');
const btnCancelCreate = document.getElementById('btn-cancel-create');
const btnDoCreate = document.getElementById('btn-do-create');
const newRepoNameInput = document.getElementById('new-repo-name');
const repoCreateError = document.getElementById('repo-create-error');
const activeRepoTitle = document.getElementById('active-repo-title');

// Repo Tabs
const ghTabs = document.querySelectorAll('.gh-tab');
const ghTabContents = document.querySelectorAll('.gh-tab-content');

// Repo Publish Form
const repoPublishForm = document.getElementById('repo-publish-form');
const commitMsgInput = document.getElementById('commit-msg');
const repoPublishBtn = document.getElementById('repo-publish-btn');
const repoPublishError = document.getElementById('repo-error-msg');
const repoTimeline = document.getElementById('repo-timeline');

// Repo Settings & Pages
const btnDeleteRepo = document.getElementById('btn-delete-repo');
const pagesToggle = document.getElementById('pages-toggle');
const pagesStatusText = document.getElementById('pages-status-text');
const pagesUrlGroup = document.getElementById('pages-url-group');
const pagesUrlInput = document.getElementById('pages-url-input');
const pagesVisitBtn = document.getElementById('pages-visit-btn');

// Global Loader
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const pagesLoader = document.getElementById('pages-loader');

// State
let currentStep = 1;
const totalSteps = 5;
let htmlPayload = '';
let readmeEditorInstance = null;
let isPagesEnabled = false;
let repoDefaultBranch = 'main';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    htmlPayload = localStorage.getItem('visualiser_pending_gh');
    
    if (!htmlPayload || htmlPayload.trim() === '') {
        gistForm.style.display = 'none';
        gistEmptyState.style.display = 'flex';
    }

    const savedToken = localStorage.getItem('visualiser_github_pat');
    if (savedToken) {
        ghTokenInput.value = savedToken;
        wizardTokenInput.value = savedToken;
    }
    
    updateWizardUI();
    initRepoView();
});

// --- Helper: Fetch GitHub Username ---
async function fetchGithubUsername(token) {
    const cached = localStorage.getItem('visualiser_gh_username');
    if (cached) return cached;

    const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to get GitHub username. Check token.');
    const data = await res.json();
    localStorage.setItem('visualiser_gh_username', data.login);
    return data.login;
}

// --- Navigation ---
backBtn.addEventListener('click', () => {
    window.location.href = '/';
});

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        const targetId = item.getAttribute('data-target');
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

// --- Copy Buttons ---
document.querySelectorAll('.copy-action').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const inputToCopy = document.getElementById(targetId);
        
        inputToCopy.select();
        document.execCommand('copy');
        
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = originalText, 2000);
    });
});

// --- Wizard Logic ---
function updateWizardUI() {
    const progress = ((currentStep) / totalSteps) * 100;
    progressBar.style.width = `${progress}%`;

    wizardSteps.forEach((step, idx) => {
        if (idx + 1 === currentStep) step.classList.add('active');
        else step.classList.remove('active');
    });

    btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    btnNext.style.display = currentStep === totalSteps ? 'none' : 'block';
}

btnNext.addEventListener('click', () => {
    if (currentStep < totalSteps) {
        currentStep++;
        updateWizardUI();
    }
});

btnPrev.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
    }
});

saveTokenBtn.addEventListener('click', () => {
    const token = wizardTokenInput.value.trim();
    if (token) {
        localStorage.setItem('visualiser_github_pat', token);
        ghTokenInput.value = token;
    }
    document.querySelector('[data-target="view-gist"]').click();
});

// --- Gist Execution ---
gistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    gistErrorMsg.innerText = '';
    
    if (!htmlPayload) return;

    const token = ghTokenInput.value.trim();
    const description = descInput.value.trim();
    const isPublic = publicToggle.checked;

    if (!token) return;
    localStorage.setItem('visualiser_github_pat', token);

    const apiPayload = {
        description: description,
        public: isPublic,
        files: { "index.html": { content: htmlPayload } }
    };

    gistPublishBtn.disabled = true;
    loaderText.innerText = "Pushing to Gist...";
    loader.style.display = 'flex';

    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(apiPayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 404 || response.status === 403) {
                throw new Error('Permission denied. Ensure your PAT has the "gist" scope checked.');
            }
            if (response.status === 401) throw new Error('Invalid token.');
            throw new Error(errorData.message || 'Failed to create Gist.');
        }

        const data = await response.json();
        
        gistForm.style.display = 'none';
        gistSuccessState.style.display = 'flex';
        gistLinkInput.value = data.html_url;
        viewGistBtn.href = data.html_url;

        localStorage.removeItem('visualiser_pending_gh');
    } catch (error) {
        gistErrorMsg.innerText = error.message;
    } finally {
        gistPublishBtn.disabled = false;
        loader.style.display = 'none';
    }
});

// --- Repository Logic ---

function initRepoView() {
    const activeRepo = localStorage.getItem('visualiser_linked_repo');
    
    if (activeRepo) {
        showRepoActiveUI(activeRepo);
    } else {
        repoPromptState.style.display = 'flex';
        repoCreateState.style.display = 'none';
        repoActiveState.style.display = 'none';
    }
}

async function showRepoActiveUI(repoName) {
    activeRepoTitle.innerText = repoName;
    repoPromptState.style.display = 'none';
    repoCreateState.style.display = 'none';
    repoActiveState.style.display = 'block';
    
    document.querySelector('.gh-tab[data-tab="tab-overview"]').click();
    loadRepoTimeline(repoName);
    loadReadme(repoName);
    await checkPagesStatus(repoName);
}

// Format enforcing for repo name
newRepoNameInput.addEventListener('input', () => {
    newRepoNameInput.value = newRepoNameInput.value.replace(/[^a-zA-Z0-9_\.-]/g, '');
});

btnShowCreate.addEventListener('click', () => {
    if (!htmlPayload) {
        alert("You have no payload in memory. Create a visual first.");
        return;
    }
    repoPromptState.style.display = 'none';
    repoCreateState.style.display = 'flex';
});

btnCancelCreate.addEventListener('click', () => {
    initRepoView();
});

btnDoCreate.addEventListener('click', async () => {
    repoCreateError.innerText = '';
    const repoName = newRepoNameInput.value.trim();
    const token = localStorage.getItem('visualiser_github_pat');
    
    if (!repoName) {
        repoCreateError.innerText = "Please enter a valid name.";
        return;
    }
    if (!token) {
        repoCreateError.innerText = "No GitHub token found. Complete the Configuration step first.";
        return;
    }

    loaderText.innerText = "Creating repository...";
    loader.style.display = 'flex';

    try {
        const createRes = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: repoName, auto_init: true })
        });
        
        if (!createRes.ok) {
            const err = await createRes.json();
            throw new Error(err.message || 'Failed to create repository. Check "repo" scope.');
        }

        localStorage.setItem('visualiser_linked_repo', repoName);
        showRepoActiveUI(repoName);

    } catch (err) {
        repoCreateError.innerText = err.message;
    } finally {
        loader.style.display = 'none';
    }
});

// Tab Switching
ghTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        ghTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetId = tab.getAttribute('data-tab');
        ghTabContents.forEach(c => c.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

// --- GitHub Pages Management ---
async function checkPagesStatus(repoName) {
    const token = localStorage.getItem('visualiser_github_pat');
    if (!token) return;

    try {
        const username = await fetchGithubUsername(token);
        
        // 1. Get repo default branch
        const repoRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (repoRes.ok) {
            const repoData = await repoRes.json();
            repoDefaultBranch = repoData.default_branch || 'main';
            isPagesEnabled = repoData.has_pages;
        }

        // 2. Fetch pages info if enabled
        if (isPagesEnabled) {
            const pagesRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/pages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (pagesRes.ok) {
                const pagesData = await pagesRes.json();
                pagesToggle.checked = true;
                pagesUrlInput.value = pagesData.html_url;
                pagesVisitBtn.href = pagesData.html_url;
                pagesUrlGroup.style.display = 'block';
                pagesStatusText.innerText = "GitHub Pages Enabled";
            }
        } else {
            pagesToggle.checked = false;
            pagesUrlGroup.style.display = 'none';
            pagesStatusText.innerText = "Enable GitHub Pages";
        }
    } catch(e) {
        console.error("Failed to fetch pages status:", e);
    }
}

pagesToggle.addEventListener('change', async () => {
    const token = localStorage.getItem('visualiser_github_pat');
    const repoName = localStorage.getItem('visualiser_linked_repo');
    if (!token || !repoName) return;

    const username = await fetchGithubUsername(token);
    pagesToggle.disabled = true;

    try {
        if (pagesToggle.checked) {
            pagesStatusText.innerText = "Enabling...";
            const res = await fetch(`https://api.github.com/repos/${username}/${repoName}/pages`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github+json'
                },
                body: JSON.stringify({
                    source: {
                        branch: repoDefaultBranch,
                        path: "/"
                    }
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (err.message && err.message.includes('not found')) {
                    throw new Error("GitHub rejected it: You need to publish at least one commit to the repo first before enabling Pages!");
                }
                throw new Error(err.message || "Failed to enable pages (Unknown GitHub API Error).");
            }
            
            setTimeout(() => checkPagesStatus(repoName), 2000);
            
        } else {
            pagesStatusText.innerText = "Disabling...";
            const res = await fetch(`https://api.github.com/repos/${username}/${repoName}/pages`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to disable pages.");
            }
            
            isPagesEnabled = false;
            pagesUrlGroup.style.display = 'none';
            pagesStatusText.innerText = "Enable GitHub Pages";
        }
    } catch(e) {
        alert(e.message);
        pagesToggle.checked = !pagesToggle.checked; 
        pagesStatusText.innerText = pagesToggle.checked ? "GitHub Pages Enabled" : "Enable GitHub Pages";
    } finally {
        pagesToggle.disabled = false;
    }
});

async function pollForPagesDeployment(owner, repo, sha, token) {
    let attempts = 0;
    const maxAttempts = 30; // Max 2 minutes waiting

    while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 4000));
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?head_sha=${sha}`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) continue;
            
            const data = await res.json();
            // Look for any workflow containing 'pages' in the readable name
            const pageRun = data.workflow_runs.find(r => r.name.toLowerCase().includes('pages'));
            
            if (pageRun && pageRun.status === 'completed') {
                return; // Reached end state
            }
        } catch (e) {
            console.error("Polling error", e);
        }
    }
}

// --- Commit Publishing (index.html) ---
repoPublishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    repoPublishError.innerText = '';
    
    if (!htmlPayload) {
        repoPublishError.innerText = "No code to publish. Back to Studio to generate more.";
        return;
    }

    const repoName = localStorage.getItem('visualiser_linked_repo');
    const token = localStorage.getItem('visualiser_github_pat');
    const message = commitMsgInput.value.trim();

    repoPublishBtn.disabled = true;
    loaderText.innerText = "Pushing commit...";
    loader.style.display = 'flex';

    try {
        const username = await fetchGithubUsername(token);

        let fileSha = null;
        const shaRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/index.html`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (shaRes.ok) fileSha = (await shaRes.json()).sha;

        const contentBase64 = btoa(unescape(encodeURIComponent(htmlPayload)));
        const putBody = { message: message, content: contentBase64 };
        if (fileSha) putBody.sha = fileSha;

        const putRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/index.html`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(putBody)
        });

        if (!putRes.ok) throw new Error('Failed to push file.');
        const putData = await putRes.json();
        
        loader.style.display = 'none';

        // Check if Pages is enabled to trigger overlay
        if (isPagesEnabled) {
            pagesLoader.style.display = 'flex';
            await pollForPagesDeployment(username, repoName, putData.commit.sha, token);
            pagesLoader.style.display = 'none';
        }

        // Success
        saveTimeline(repoName, message, putData.commit.html_url);
        loadRepoTimeline(repoName);
        
        localStorage.removeItem('visualiser_pending_gh');
        document.querySelector('.gh-tab[data-tab="tab-timeline"]').click();
        
    } catch (err) {
        loader.style.display = 'none';
        repoPublishError.innerText = err.message;
    } finally {
        repoPublishBtn.disabled = false;
    }
});

// --- README Editor Logic ---
async function loadReadme(repoName) {
    const token = localStorage.getItem('visualiser_github_pat');
    if (!token) return;

    try {
        const username = await fetchGithubUsername(token);
        const res = await fetch(`https://api.github.com/repos/${username}/${repoName}/readme`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let content = `# ${repoName}\n\nCreated with visualiser.lol`;
        if (res.ok) {
            const data = await res.json();
            content = decodeURIComponent(escape(atob(data.content)));
        }
        
        if (!readmeEditorInstance) {
            readmeEditorInstance = new toastui.Editor({
                el: document.querySelector('#readme-editor'),
                height: '350px',
                initialEditType: 'wysiwyg',
                previewStyle: 'vertical',
                theme: 'dark',
                initialValue: content
            });
        } else {
            readmeEditorInstance.setMarkdown(content);
        }
    } catch(e) {
        console.error("Error loading readme:", e);
    }
}

document.getElementById('btn-save-readme').addEventListener('click', async () => {
    const msgEl = document.getElementById('readme-msg');
    msgEl.innerText = "Saving README...";
    msgEl.style.color = "var(--text-muted)";
    
    try {
        const token = localStorage.getItem('visualiser_github_pat');
        const repoName = localStorage.getItem('visualiser_linked_repo');
        
        if (!readmeEditorInstance || !token || !repoName) return;

        const markdown = readmeEditorInstance.getMarkdown();
        const contentBase64 = btoa(unescape(encodeURIComponent(markdown)));
        
        const username = await fetchGithubUsername(token);
        
        let fileSha = null;
        const shaRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/README.md`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (shaRes.ok) fileSha = (await shaRes.json()).sha;
        
        const putBody = { message: "Update README.md", content: contentBase64 };
        if (fileSha) putBody.sha = fileSha;
        
        const putRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/README.md`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(putBody)
        });
        
        if (!putRes.ok) throw new Error('Failed to update README.');
        
        msgEl.innerText = "README successfully set!";
        msgEl.style.color = "var(--accent)";
        setTimeout(() => msgEl.innerText = "", 3000);
        
        const putData = await putRes.json();
        saveTimeline(repoName, "Update README.md", putData.commit.html_url);
        loadRepoTimeline(repoName);
        
    } catch (e) {
        msgEl.innerText = e.message;
        msgEl.style.color = "var(--error)";
    }
});

// --- Timeline handling ---
function loadRepoTimeline(repoName) {
    const repos = JSON.parse(localStorage.getItem('visualiser_gh_repos') || '{}');
    const repoData = repos[repoName];
    
    if (!repoData || !repoData.commits || repoData.commits.length === 0) {
        repoTimeline.innerHTML = '<p class="text-muted">No commits yet.</p>';
        return;
    }

    repoTimeline.innerHTML = '';
    repoData.commits.slice().reverse().forEach(commit => {
        const dateObj = new Date(commit.timestamp);
        const dateString = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        repoTimeline.innerHTML += `
            <div class="timeline-item">
                <div class="timeline-indicator"></div>
                <div class="timeline-msg">${commit.message}</div>
                <div class="timeline-meta">
                    <span>${dateString}</span>
                    <a href="${commit.url}" target="_blank">View Commit</a>
                </div>
            </div>
        `;
    });
}

function saveTimeline(repoName, message, url) {
    const repos = JSON.parse(localStorage.getItem('visualiser_gh_repos') || '{}');
    const now = Date.now();
    
    if (!repos[repoName]) repos[repoName] = { created_at: now, commits: [] };
    
    repos[repoName].last_publish = now;
    repos[repoName].commits.push({ message: message, timestamp: now, url: url });
    
    localStorage.setItem('visualiser_gh_repos', JSON.stringify(repos));
}

// --- Delete Repo ---
btnDeleteRepo.addEventListener('click', async () => {
    const repoName = localStorage.getItem('visualiser_linked_repo');
    const token = localStorage.getItem('visualiser_github_pat');
    
    if (!confirm(`Are you sure you want to permanently delete "${repoName}" from GitHub?`)) return;

    loaderText.innerText = "Deleting repository...";
    loader.style.display = 'flex';

    try {
        const username = await fetchGithubUsername(token);

        const delRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!delRes.ok) {
            const err = await delRes.json();
            throw new Error(err.message || "Failed to delete repository. Check 'delete_repo' scope.");
        }

        localStorage.removeItem('visualiser_linked_repo');
        const repos = JSON.parse(localStorage.getItem('visualiser_gh_repos') || '{}');
        delete repos[repoName];
        localStorage.setItem('visualiser_gh_repos', JSON.stringify(repos));

        initRepoView();

    } catch (err) {
        alert(err.message);
    } finally {
        loader.style.display = 'none';
    }
});