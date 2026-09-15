// Global State Management
window.studiProjects = JSON.parse(localStorage.getItem('studiProjects')) || [];
window.currentProject = null;

window.saveProjectsToDB = function() {
    localStorage.setItem('studiProjects', JSON.stringify(window.studiProjects));
};

window.getApiKey = function() {
    return localStorage.getItem('studiApiKey') || "";
};