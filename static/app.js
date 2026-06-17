// State management
const state = {
    activeTab: 'chat',
    documents: [],
    chatHistory: [],
    activeCitations: [],
    isStreaming: false,
    settings: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        top_k: 4,
        chunkSize: 1000,
        chunkOverlap: 200,
        apiKey: ''
    }
};

// Available models definition
const providerModels = {
    gemini: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast)' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Powerful)' },
        { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Latest)' }
    ],
    openai: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost-efficient)' },
        { id: 'gpt-4o', name: 'GPT-4o (High Performance)' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Legacy)' }
    ]
};

// DOM Elements
const btnTabChat = document.getElementById('btn-tab-chat');
const btnTabAnalytics = document.getElementById('btn-tab-analytics');
const panelChat = document.getElementById('panel-chat');
const panelAnalytics = document.getElementById('panel-analytics');

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const documentList = document.getElementById('document-list');
const docCountBadge = document.getElementById('doc-count-badge');

const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const settingsContent = document.getElementById('settings-content');
const settingProvider = document.getElementById('setting-provider');
const settingModel = document.getElementById('setting-model');
const settingTemp = document.getElementById('setting-temp');
const tempVal = document.getElementById('temp-val');
const settingTopk = document.getElementById('setting-topk');
const settingChunkSize = document.getElementById('setting-chunk-size');
const settingChunkOverlap = document.getElementById('setting-chunk-overlap');
const settingApikey = document.getElementById('setting-apikey');

const headerTitle = document.getElementById('header-title');
const headerSubtitle = document.getElementById('header-subtitle');
const activeModelBadge = document.getElementById('active-model-badge');
const systemStatusIndicator = document.getElementById('system-status-indicator');

const chatMessages = document.getElementById('chat-messages');
const chatWelcome = document.getElementById('chat-welcome');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnShowActiveCitations = document.getElementById('btn-show-active-citations');
const citationCountIndicator = document.getElementById('citation-count-indicator');
const citationsPanel = document.getElementById('citations-panel');
const btnCloseCitations = document.getElementById('btn-close-citations');
const citationsListContainer = document.getElementById('citations-list-container');

// Analytics elements
const statFiles = document.getElementById('stat-files');
const statChunks = document.getElementById('stat-chunks');
const statLatency = document.getElementById('stat-latency');
const statSize = document.getElementById('stat-size');
const sandboxSearchInput = document.getElementById('sandbox-search-input');
const btnSandboxSearch = document.getElementById('btn-sandbox-search');
const sandboxResults = document.getElementById('sandbox-results');

const notificationContainer = document.getElementById('notification-container');

// Configure marked options
marked.setOptions({
    highlight: function(code, lang) {
        if (Prism.languages[lang]) {
            return Prism.highlight(code, Prism.languages[lang], lang);
        }
        return code;
    },
    breaks: true
});

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateModelsDropdown();
    refreshDocuments();
    refreshStats();
    setupEventListeners();
});

// Setup Settings and Models dropdown
function loadSettings() {
    const saved = localStorage.getItem('nexus_settings');
    if (saved) {
        try {
            state.settings = { ...state.settings, ...JSON.parse(saved) };
            
            // Validate model availability
            const provider = state.settings.provider;
            const models = providerModels[provider] || [];
            const isSupported = models.some(m => m.id === state.settings.model);
            if (!isSupported && models.length > 0) {
                state.settings.model = models[0].id;
            }
            
            // Apply fields
            settingProvider.value = state.settings.provider;
            settingTemp.value = state.settings.temperature;
            tempVal.textContent = state.settings.temperature;
            settingTopk.value = state.settings.top_k;
            settingChunkSize.value = state.settings.chunkSize;
            settingChunkOverlap.value = state.settings.chunkOverlap;
            settingApikey.value = state.settings.apiKey;
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    }
}

function saveSettings() {
    state.settings.provider = settingProvider.value;
    state.settings.model = settingModel.value;
    state.settings.temperature = parseFloat(settingTemp.value);
    state.settings.top_k = parseInt(settingTopk.value);
    state.settings.chunkSize = parseInt(settingChunkSize.value);
    state.settings.chunkOverlap = parseInt(settingChunkOverlap.value);
    state.settings.apiKey = settingApikey.value;
    
    localStorage.setItem('nexus_settings', JSON.stringify(state.settings));
    activeModelBadge.textContent = state.settings.model;
}

function updateModelsDropdown() {
    const provider = settingProvider.value;
    const models = providerModels[provider] || [];
    settingModel.innerHTML = '';
    
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (state.settings.model && state.settings.model.startsWith(provider) && m.id === state.settings.model) {
            opt.selected = true;
        }
        settingModel.appendChild(opt);
    });
    
    saveSettings();
}

// Event Listeners Routing
function setupEventListeners() {
    // Tabs
    btnTabChat.addEventListener('click', () => switchTab('chat'));
    btnTabAnalytics.addEventListener('click', () => switchTab('analytics'));

    // Config panel toggle
    btnSettingsToggle.addEventListener('click', () => {
        btnSettingsToggle.classList.toggle('active');
        settingsContent.classList.toggle('hidden');
    });

    // Settings adjustments
    settingProvider.addEventListener('change', () => {
        updateModelsDropdown();
        saveSettings();
    });
    settingModel.addEventListener('change', saveSettings);
    settingTemp.addEventListener('input', (e) => {
        tempVal.textContent = e.target.value;
        saveSettings();
    });
    [settingTopk, settingChunkSize, settingChunkOverlap, settingApikey].forEach(el => {
        el.addEventListener('change', saveSettings);
    });

    // Drag-and-drop document upload
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    ['dragenter', 'dragover'].forEach(name => {
        uploadZone.addEventListener(name, (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        }, false);
    });
    ['dragleave', 'drop'].forEach(name => {
        uploadZone.addEventListener(name, (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        }, false);
    });
    uploadZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        uploadFiles(files);
    });

    // Chat submit
    chatForm.addEventListener('submit', handleChatSubmit);
    
    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight - 4) + 'px';
    });
    
    // Citations Panel
    btnShowActiveCitations.addEventListener('click', toggleCitationsPanel);
    btnCloseCitations.addEventListener('click', () => citationsPanel.classList.add('hidden'));

    // Sandbox vector search
    btnSandboxSearch.addEventListener('click', runSandboxSearch);
    sandboxSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSandboxSearch();
    });
}

function switchTab(tabName) {
    state.activeTab = tabName;
    if (tabName === 'chat') {
        btnTabChat.classList.add('active');
        btnTabAnalytics.classList.remove('active');
        panelChat.classList.add('active');
        panelAnalytics.classList.remove('active');
        headerTitle.textContent = 'Chat Workspace';
        headerSubtitle.textContent = 'Index documents to enable Retrieval-Augmented Generation.';
    } else {
        btnTabChat.classList.remove('active');
        btnTabAnalytics.classList.add('active');
        panelChat.classList.remove('active');
        panelAnalytics.classList.add('active');
        headerTitle.textContent = 'Database Analytics & Sandbox';
        headerSubtitle.textContent = 'Explore document indexing metrics and search parameters.';
        refreshStats();
    }
}

// Alerts notifications
function notify(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `
        <span>${message}</span>
        <span style="cursor: pointer; margin-left: 10px;" onclick="this.parentElement.remove()">✕</span>
    `;
    notificationContainer.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = 'all 0.3s ease';
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

// Documents operations
async function refreshDocuments() {
    try {
        const res = await fetch('/api/documents');
        state.documents = await res.json();
        renderDocuments();
    } catch (e) {
        notify('Failed to load documents', 'error');
    }
}

function renderDocuments() {
    docCountBadge.textContent = state.documents.length;
    
    if (state.documents.length === 0) {
        documentList.innerHTML = '<div class="empty-docs-state">No files uploaded yet.</div>';
        return;
    }
    
    documentList.innerHTML = '';
    state.documents.forEach(doc => {
        const li = document.createElement('li');
        li.className = 'doc-item';
        
        const sizeKB = (doc.size_bytes / 1024).toFixed(1);
        
        li.innerHTML = `
            <div class="doc-info">
                <svg class="doc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <div class="doc-details">
                    <div class="doc-name" title="${doc.filename}">${doc.filename}</div>
                    <div class="doc-meta">${doc.chunks} chunks • ${sizeKB} KB</div>
                </div>
            </div>
            <button class="doc-delete-btn" title="Delete index" data-filename="${doc.filename}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;
        
        // Delete binder
        li.querySelector('.doc-delete-btn').addEventListener('click', async (e) => {
            const filename = e.currentTarget.getAttribute('data-filename');
            if (confirm(`Remove index and file for ${filename}?`)) {
                await deleteDocument(filename);
            }
        });
        
        documentList.appendChild(li);
    });
}

async function deleteDocument(filename) {
    try {
        const res = await fetch(`/api/documents/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        const result = await res.json();
        if (result.success) {
            notify(`Deleted ${filename} from database`, 'success');
            refreshDocuments();
            refreshStats();
        } else {
            notify(`Failed to delete: ${result.detail}`, 'error');
        }
    } catch (e) {
        notify('Network error when deleting document', 'error');
    }
}

function handleFileSelect(e) {
    uploadFiles(e.target.files);
}

async function uploadFiles(files) {
    if (files.length === 0) return;
    
    setSystemStatus('busy', 'Processing Upload...');
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        
        notify(`Uploading and parsing ${file.name}...`, 'info');
        
        const params = new URLSearchParams({
            chunk_size: state.settings.chunkSize,
            chunk_overlap: state.settings.chunkOverlap,
            provider: state.settings.provider,
            api_key: state.settings.apiKey
        });
        
        try {
            const res = await fetch(`/api/upload?${params.toString()}`, {
                method: 'POST',
                body: formData
            });
            
            const result = await res.json();
            if (res.ok && result.success) {
                notify(`Successfully indexed ${file.name} (${result.chunks_count} chunks)`, 'success');
            } else {
                notify(`Failed to upload ${file.name}: ${result.detail || 'Internal error'}`, 'error');
            }
        } catch (e) {
            notify(`Network error indexing ${file.name}`, 'error');
        }
    }
    
    setSystemStatus('online', 'Ready');
    fileInput.value = ''; // Reset input
    refreshDocuments();
    refreshStats();
}

function setSystemStatus(status, text) {
    systemStatusIndicator.className = `status-indicator ${status}`;
    systemStatusIndicator.querySelector('.status-text').textContent = text;
}

// Chat functions
async function handleChatSubmit(e) {
    e.preventDefault();
    const query = chatInput.value.trim();
    if (!query || state.isStreaming) return;
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Hide welcome card if present
    if (chatWelcome) {
        chatWelcome.remove();
    }
    
    // Append user message to log
    appendMessage('user', query);
    
    // Initialize assistant response bubble
    const assistantBubble = appendMessage('assistant', '', true);
    
    state.isStreaming = true;
    setSystemStatus('busy', 'Thinking...');
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: query,
                history: state.chatHistory,
                settings: state.settings
            })
        });
        
        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.detail || 'Failed to query RAG backend.');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let answerText = '';
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // Keep incomplete line
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        
                        if (data.type === 'citations') {
                            // Update citations state
                            state.activeCitations = data.citations;
                            updateCitationsUI();
                        } else if (data.type === 'text') {
                            answerText += data.text;
                            updateAssistantBubble(assistantBubble, answerText);
                        } else if (data.type === 'error') {
                            notify(data.error, 'error');
                            updateAssistantBubble(assistantBubble, `*Error during inference: ${data.error}*`);
                        } else if (data.type === 'done') {
                            // Chat finalized
                            state.chatHistory.push({ role: 'user', content: query });
                            state.chatHistory.push({ role: 'model', content: answerText });
                        }
                    } catch (err) {
                        console.error('Error parsing SSE block', err);
                    }
                }
            }
        }
    } catch (error) {
        notify(error.message, 'error');
        updateAssistantBubble(assistantBubble, `*Error: ${error.message}*`);
    } finally {
        state.isStreaming = false;
        setSystemStatus('online', 'Ready');
        refreshStats();
    }
}

function appendMessage(role, text, isPending = false) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'bubble-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'Æ';
    
    const content = document.createElement('div');
    content.className = 'bubble-content';
    
    if (isPending) {
        content.innerHTML = '<span class="loading-dots">Thinking<span>.</span><span>.</span><span>.</span></span>';
    } else {
        content.innerHTML = marked.parse(text);
        // Highlight code
        content.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });
    }
    
    bubble.appendChild(avatar);
    bubble.appendChild(content);
    chatMessages.appendChild(bubble);
    
    // Auto scroll
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return bubble;
}

function updateAssistantBubble(bubbleElement, text) {
    const content = bubbleElement.querySelector('.bubble-content');
    content.innerHTML = marked.parse(text);
    
    // Highlight code blocks
    content.querySelectorAll('pre code').forEach((block) => {
        Prism.highlightElement(block);
    });
    
    // Append citations list at the bottom of assistant message if we have citations
    if (state.activeCitations && state.activeCitations.length > 0) {
        const citationsContainer = document.createElement('div');
        citationsContainer.className = 'citation-reference-container';
        
        // Group citations by filename to avoid redundancy
        const uniqueDocs = [...new Set(state.activeCitations.map(c => c.filename))];
        uniqueDocs.forEach((doc, idx) => {
            const pill = document.createElement('span');
            pill.className = 'citation-pill';
            pill.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                [${idx + 1}] ${doc}
            `;
            pill.addEventListener('click', () => {
                showCitationsPanel();
            });
            citationsContainer.appendChild(pill);
        });
        
        content.appendChild(citationsContainer);
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Citations drawer operations
function updateCitationsUI() {
    const count = state.activeCitations.length;
    if (count > 0) {
        citationCountIndicator.textContent = count;
        citationCountIndicator.classList.remove('hidden');
    } else {
        citationCountIndicator.classList.add('hidden');
    }
    
    citationsListContainer.innerHTML = '';
    if (count === 0) {
        citationsListContainer.innerHTML = '<div class="empty-docs-state">No sources retrieved for this message.</div>';
        return;
    }
    
    state.activeCitations.forEach(c => {
        const card = document.createElement('div');
        card.className = 'citation-card';
        
        const scorePct = (c.score * 100).toFixed(0);
        
        card.innerHTML = `
            <div class="citation-card-header">
                <span class="citation-file-name" title="${c.filename}">${c.filename}</span>
                <span class="citation-score">${scorePct}% Match</span>
            </div>
            <div class="citation-text">${escapeHTML(c.text)}</div>
        `;
        
        citationsListContainer.appendChild(card);
    });
}

function showCitationsPanel() {
    citationsPanel.classList.remove('hidden');
}

function toggleCitationsPanel() {
    citationsPanel.classList.toggle('hidden');
}

// Analytics and DB Stats
async function refreshStats() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        
        // Populate stats in UI
        statFiles.textContent = stats.files_count;
        statChunks.textContent = stats.chunks_count;
        statLatency.textContent = `${stats.avg_search_latency_ms} ms`;
        
        // Format size
        const sizeKB = stats.db_size_bytes / 1024;
        if (sizeKB > 1024) {
            statSize.textContent = `${(sizeKB / 1024).toFixed(1)} MB`;
        } else {
            statSize.textContent = `${sizeKB.toFixed(1)} KB`;
        }
    } catch (e) {
        console.error('Failed to retrieve server stats', e);
    }
}

// Sandbox Similarity Search Tester
async function runSandboxSearch() {
    const query = sandboxSearchInput.value.trim();
    if (!query) {
        notify('Please enter search query', 'info');
        return;
    }
    
    btnSandboxSearch.disabled = true;
    btnSandboxSearch.textContent = 'Searching...';
    sandboxResults.innerHTML = '';
    
    try {
        const res = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                settings: state.settings
            })
        });
        
        if (!res.ok) {
            const errJson = await res.json();
            throw new Error(errJson.detail || 'Similarity search failed.');
        }
        
        const matches = await res.json();
        
        if (matches.length === 0) {
            sandboxResults.innerHTML = '<div class="empty-sandbox-state">No matching vectors found. Check if you have uploaded documents.</div>';
            return;
        }
        
        matches.forEach((match, idx) => {
            const el = document.createElement('div');
            el.className = 'citation-card';
            el.style.borderLeft = '3px solid var(--accent-purple)';
            
            const scorePct = (match.score * 100).toFixed(0);
            const sizeBytes = match.metadata.size_bytes;
            const sizeKB = (sizeBytes / 1024).toFixed(1);
            
            el.innerHTML = `
                <div class="citation-card-header">
                    <div>
                        <strong style="color: #a78bfa; font-size: 13px;">Chunk #${match.metadata.chunk_idx + 1}</strong>
                        <span class="citation-file-name" style="margin-left: 8px;">${match.metadata.filename}</span>
                    </div>
                    <span class="citation-score" style="background: rgba(139, 92, 246, 0.1); color: #c084fc;">${scorePct}% Cosine</span>
                </div>
                <div class="citation-text" style="border-left-color: var(--accent-purple);">${escapeHTML(match.text)}</div>
            `;
            sandboxResults.appendChild(el);
        });
    } catch (e) {
        notify(e.message, 'error');
        sandboxResults.innerHTML = `<div class="empty-sandbox-state" style="color: var(--danger-hover);">Error: ${e.message}</div>`;
    } finally {
        btnSandboxSearch.disabled = false;
        btnSandboxSearch.textContent = 'Search DB';
    }
}

// Helpers
function escapeHTML(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
