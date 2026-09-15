// Nav and Views
const navItems = document.querySelectorAll('.nav-item:not(.disabled)');
const views = document.querySelectorAll('.view-section');
const backBtn = document.getElementById('back-btn');

// Account Elements
const splashState = document.getElementById('account-splash-state');
const wizardState = document.getElementById('account-wizard-state');
const dashboardState = document.getElementById('account-dashboard-state');
const btnStartSignin = document.getElementById('btn-start-signin');
const btnCancelSignin = document.getElementById('cancel-signin-btn');
const btnLogout = document.getElementById('btn-logout');

// Wizard Elements
const wizardSteps = document.querySelectorAll('.wizard-step');
const progressBar = document.getElementById('progress-bar');
const btnNext = document.getElementById('wizard-next');
const btnPrev = document.getElementById('wizard-prev');
const wizardTokenInput = document.getElementById('wizard-token');
const saveTokenBtn = document.getElementById('save-token-btn');
const validationError = document.getElementById('validation-error');

// Gist Elements
const gistForm = document.getElementById('gist-form');
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
const repoLinkState = document.getElementById('repo-link-state');
const repoActiveState = document.getElementById('repo-active-state');

const btnShowCreate = document.getElementById('btn-show-create');
const btnCancelCreate = document.getElementById('btn-cancel-create');
const btnDoCreate = document.getElementById('btn-do-create');
const newRepoNameInput = document.getElementById('new-repo-name');
const repoCreateError = document.getElementById('repo-create-error');

const btnShowLink = document.getElementById('btn-show-link');
const btnCancelLink = document.getElementById('btn-cancel-link');
const repoSearchInput = document.getElementById('repo-search-input');
const repoListContainer = document.getElementById('repo-list-container');
const btnUnlinkRepo = document.getElementById('btn-unlink-repo');

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
let cachedRepos = []; // Store fetched repos for quick filtering

// Dynamically link repo to the Studio Project
const currentProjectId = localStorage.getItem('visualiser_current_project_id');
const repoStorageKey = currentProjectId ? `visualiser_linked_repo_${currentProjectId}` : 'visualiser_linked_repo';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    htmlPayload = localStorage.getItem('visualiser_pending_gh');
    
    if (!htmlPayload || htmlPayload.trim() === '') {
        gistForm.style.display = 'none';
        gistEmptyState.style.display = 'flex';
    }

    const savedToken = localStorage.getItem('visualiser_github_pat');
    if (savedToken) {
        wizardTokenInput.value = savedToken;
        await validateAndLoadDashboard(savedToken);
    } else {
        showSplash();
    }
    
    updateWizardUI();
    initRepoView();
});

// --- Navigation ---
backBtn.addEventListener('click', () => {
    if (currentProjectId) {
        window.location.href = '/?load=' + currentProjectId;
    } else {
        window.location.href = '/';
    }
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

// --- Account / PAT Logic ---
function showSplash() {
    splashState.style.display = 'flex';
    wizardState.style.display = 'none';
    dashboardState.style.display = 'none';
}

function showWizard() {
    splashState.style.display = 'none';
    wizardState.style.display = 'block';
    dashboardState.style.display = 'none';
}

async function validateAndLoadDashboard(token) {
    loaderText.innerText = "Connecting to GitHub...";
    loader.style.display = 'flex';
    
    try {
        const res = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            localStorage.removeItem('visualiser_github_pat');
            throw new Error("Token expired or invalid.");
        }

        const scopes = res.headers.get('x-oauth-scopes') || "";
        const required = ['repo', 'gist', 'delete_repo'];
        const missing = required.filter(s => !scopes.includes(s));
        
        if (missing.length > 0 && !scopes.includes('user')) {
            throw new Error(`Your PAT is missing required permissions: ${missing.join(', ')}. Please create a new one with all boxes checked.`);
        }

        const userData = await res.json();
        
        localStorage.setItem('visualiser_gh_username', userData.login);
        
        document.getElementById('gh-avatar').src = userData.avatar_url;
        document.getElementById('gh-name').innerText = userData.name || userData.login;
        document.getElementById('gh-handle').innerText = '@' + userData.login;
        document.getElementById('gh-handle').href = userData.html_url;
        document.getElementById('gh-bio').innerText = userData.bio || "No bio set.";
        document.getElementById('gh-repos').innerText = userData.public_repos;
        document.getElementById('gh-gists').innerText = userData.public_gists;
        document.getElementById('gh-followers').innerText = userData.followers;
        
        splashState.style.display = 'none';
        wizardState.style.display = 'none';
        dashboardState.style.display = 'block';
        
    } catch (err) {
        showSplash();
        validationError.innerText = err.message;
        validationError.style.display = 'block';
        if (wizardState.style.display === 'block') {
            showWizard();
        }
    } finally {
        loader.style.display = 'none';
    }
}

btnStartSignin.addEventListener('click', showWizard);
btnCancelSignin.addEventListener('click', showSplash);

btnLogout.addEventListener('click', () => {
    localStorage.removeItem('visualiser_github_pat');
    localStorage.removeItem('visualiser_gh_username');
    wizardTokenInput.value = '';
    currentStep = 1;
    updateWizardUI();
    showSplash();
});

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
    if (currentStep < totalSteps) { currentStep++; updateWizardUI(); }
});
btnPrev.addEventListener('click', () => {
    if (currentStep > 1) { currentStep--; updateWizardUI(); }
});

saveTokenBtn.addEventListener('click', async () => {
    const token = wizardTokenInput.value.trim();
    validationError.style.display = 'none';
    
    if (!token) {
        validationError.innerText = "Please paste a token first.";
        validationError.style.display = 'block';
        return;
    }
    
    saveTokenBtn.disabled = true;
    try {
        await validateAndLoadDashboard(token);
        if (dashboardState.style.display === 'block') {
            localStorage.setItem('visualiser_github_pat', token);
        }
    } finally {
        saveTokenBtn.disabled = false;
    }
});


// --- Gist Execution ---
gistForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    gistErrorMsg.innerText = '';
    
    if (!htmlPayload) return;

    const token = localStorage.getItem('visualiser_github_pat');
    if (!token) {
        gistErrorMsg.innerText = 'Please sign in from the Account tab first.';
        return;
    }

    const description = descInput.value.trim();
    const isPublic = publicToggle.checked;

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

        if (!response.ok) throw new Error('Failed to create Gist.');

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
    if (!currentProjectId) {
        repoPromptState.style.display = 'flex';
        repoPromptState.innerHTML = `<h3>Action Required</h3><p>Please open or save a project in Studio before managing repositories.</p>`;
        return;
    }

    const activeRepo = localStorage.getItem(repoStorageKey);
    
    if (activeRepo) {
        showRepoActiveUI(activeRepo);
    } else {
        repoPromptState.style.display = 'flex';
        repoCreateState.style.display = 'none';
        repoLinkState.style.display = 'none';
        repoActiveState.style.display = 'none';
    }
}

async function showRepoActiveUI(repoName) {
    activeRepoTitle.innerText = repoName;
    repoPromptState.style.display = 'none';
    repoCreateState.style.display = 'none';
    repoLinkState.style.display = 'none';
    repoActiveState.style.display = 'block';
    
    document.querySelector('.gh-tab[data-tab="tab-overview"]').click();
    loadRepoTimeline(repoName);
    loadReadme(repoName);
    await checkPagesStatus(repoName);
}

// --- CREATE REPO ---
newRepoNameInput.addEventListener('input', () => {
    newRepoNameInput.value = newRepoNameInput.value.replace(/[^a-zA-Z0-9_\.-]/g, '');
});

btnShowCreate.addEventListener('click', () => {
    if (!htmlPayload) { alert("You have no payload in memory. Create a visual first."); return; }
    repoPromptState.style.display = 'none';
    repoCreateState.style.display = 'flex';
});

btnCancelCreate.addEventListener('click', initRepoView);

btnDoCreate.addEventListener('click', async () => {
    repoCreateError.innerText = '';
    const repoName = newRepoNameInput.value.trim();
    const token = localStorage.getItem('visualiser_github_pat');
    
    if (!repoName) { repoCreateError.innerText = "Please enter a valid name."; return; }
    if (!token) { repoCreateError.innerText = "Sign in via Account tab first."; return; }

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
            throw new Error(err.message || 'Failed to create repository.');
        }

        localStorage.setItem(repoStorageKey, repoName);
        showRepoActiveUI(repoName);

    } catch (err) {
        repoCreateError.innerText = err.message;
    } finally {
        loader.style.display = 'none';
    }
});

// --- LINK EXISTING REPO ---
btnShowLink.addEventListener('click', async () => {
    const token = localStorage.getItem('visualiser_github_pat');
    if (!token) { alert("Sign in via Account tab first."); return; }
    
    repoPromptState.style.display = 'none';
    repoLinkState.style.display = 'flex';
    repoSearchInput.value = '';
    repoListContainer.innerHTML = '';
    
    loaderText.innerText = "Fetching your repositories...";
    loader.style.display = 'flex';

    try {
        const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=owner', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Failed to load repositories.");
        cachedRepos = await res.json();
        renderRepoList(cachedRepos);

    } catch(err) {
        repoListContainer.innerHTML = `<p class="error-text">${err.message}</p>`;
    } finally {
        loader.style.display = 'none';
    }
});

btnCancelLink.addEventListener('click', initRepoView);

repoSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = cachedRepos.filter(r => r.name.toLowerCase().includes(term));
    renderRepoList(filtered);
});

function renderRepoList(repos) {
    repoListContainer.innerHTML = '';
    if (repos.length === 0) {
        repoListContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 1rem;">No repositories found.</p>';
        return;
    }
    
    repos.forEach(repo => {
        const el = document.createElement('div');
        el.className = 'repo-list-item';
        
        const badge = repo.private ? `<span class="repo-badge">Private</span>` : `<span class="repo-badge">Public</span>`;
        const updatedDate = new Date(repo.updated_at).toLocaleDateString();

        el.innerHTML = `
            <span class="repo-list-name">${repo.name}</span>
            <div class="repo-list-meta">
                ${badge}
                <span>Updated ${updatedDate}</span>
            </div>
        `;
        
        el.addEventListener('click', () => {
            if (!repo.permissions.push) {
                alert("You don't have write access to this repository.");
                return;
            }
            localStorage.setItem(repoStorageKey, repo.name);
            showRepoActiveUI(repo.name);
        });
        
        repoListContainer.appendChild(el);
    });
}

btnUnlinkRepo.addEventListener('click', () => {
    if(confirm("Disconnect this repository from your project? It will not be deleted from GitHub.")) {
        localStorage.removeItem(repoStorageKey);
        initRepoView();
    }
});


// --- TABS & PAGES ---
ghTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        ghTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetId = tab.getAttribute('data-tab');
        ghTabContents.forEach(c => c.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

async function checkPagesStatus(repoName, isPolling = false) {
    const token = localStorage.getItem('visualiser_github_pat');
    if (!token) return false;

    try {
        const username = localStorage.getItem('visualiser_gh_username');
        
        const repoRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (repoRes.ok) {
            const repoData = await repoRes.json();
            repoDefaultBranch = repoData.default_branch || 'main';
            isPagesEnabled = repoData.has_pages;
        }

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
                return true;
            }
        } else {
            if (!isPolling) {
                pagesToggle.checked = false;
                pagesUrlGroup.style.display = 'none';
                pagesStatusText.innerText = "Enable GitHub Pages";
            }
            return false;
        }
    } catch(e) { console.error("Failed to fetch pages status:", e); }
    return false;
}

pagesToggle.addEventListener('change', async () => {
    const token = localStorage.getItem('visualiser_github_pat');
    const repoName = localStorage.getItem(repoStorageKey);
    if (!token || !repoName) return;

    const username = localStorage.getItem('visualiser_gh_username');
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
                body: JSON.stringify({ source: { branch: repoDefaultBranch, path: "/" } })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (err.message && err.message.includes('not found')) {
                    throw new Error("GitHub rejected it: You need to publish at least one commit to the repo first before enabling Pages!");
                }
                throw new Error(err.message || "Failed to enable pages.");
            }
            
            pagesStatusText.innerText = "Syncing with GitHub...";
            let attempts = 0;
            const poll = setInterval(async () => {
                attempts++;
                const ready = await checkPagesStatus(repoName, true);
                if (ready || attempts > 10) {
                    clearInterval(poll);
                    if (!ready) pagesStatusText.innerText = "Enabled, but taking a while to sync. Reload later.";
                }
            }, 3000);
            
        } else {
            pagesStatusText.innerText = "Disabling...";
            const res = await fetch(`https://api.github.com/repos/${username}/${repoName}/pages`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });
            if (!res.ok) throw new Error("Failed to disable pages.");
            
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
    while (attempts < 30) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 4000));
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?head_sha=${sha}`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) continue;
            const data = await res.json();
            const pageRun = data.workflow_runs.find(r => r.name.toLowerCase().includes('pages'));
            if (pageRun && pageRun.status === 'completed') return; 
        } catch (e) {}
    }
}

// --- Commit Publishing ---
repoPublishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    repoPublishError.innerText = '';
    
    if (!htmlPayload) {
        repoPublishError.innerText = "No code to publish. Back to Studio to generate more.";
        return;
    }

    const repoName = localStorage.getItem(repoStorageKey);
    const token = localStorage.getItem('visualiser_github_pat');
    const message = commitMsgInput.value.trim();

    repoPublishBtn.disabled = true;
    loaderText.innerText = "Pushing commit...";
    loader.style.display = 'flex';

    try {
        const username = localStorage.getItem('visualiser_gh_username');

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

        if (isPagesEnabled) {
            pagesLoader.style.display = 'flex';
            await pollForPagesDeployment(username, repoName, putData.commit.sha, token);
            pagesLoader.style.display = 'none';
        }

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
        const username = localStorage.getItem('visualiser_gh_username');
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
    } catch(e) {}
}

document.getElementById('btn-save-readme').addEventListener('click', async () => {
    const msgEl = document.getElementById('readme-msg');
    msgEl.innerText = "Saving README...";
    msgEl.style.color = "var(--text-muted)";
    
    try {
        const token = localStorage.getItem('visualiser_github_pat');
        const repoName = localStorage.getItem(repoStorageKey);
        
        if (!readmeEditorInstance || !token || !repoName) return;

        const markdown = readmeEditorInstance.getMarkdown();
        const contentBase64 = btoa(unescape(encodeURIComponent(markdown)));
        
        const username = localStorage.getItem('visualiser_gh_username');
        
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
    const repoName = localStorage.getItem(repoStorageKey);
    const token = localStorage.getItem('visualiser_github_pat');
    
    if (!confirm(`Are you sure you want to permanently delete "${repoName}" from GitHub?`)) return;

    loaderText.innerText = "Deleting repository...";
    loader.style.display = 'flex';

    try {
        const username = localStorage.getItem('visualiser_gh_username');

        const delRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!delRes.ok) {
            const err = await delRes.json();
            throw new Error(err.message || "Failed to delete repository.");
        }

        localStorage.removeItem(repoStorageKey);
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