// api-room.js 

const API_CONFIGS_KEY = 'api_configs_text';
let ui = {}; // 用于缓存 DOM 元素
let currentSelectedModels = []; // 用于暂存用户在面板中选择的模型

// 模型选择面板的 HTML 结构
const modelSelectionPanelHtml = `
<div class="modal-overlay" id="model-selection-overlay">
    <div class="modal-panel">
        <div class="modal-header">选择模型</div>
        <div class="search-bar-container">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="search" id="model-search-input" placeholder="搜索模型名称...">
        </div>
        <div class="modal-content-container">
            <ul class="model-checkbox-list" id="model-checkbox-list">
                <!-- 模型将动态插入这里 -->
            </ul>
            <div id="no-models-found" class="no-models-found-message">
                未找到匹配的模型
            </div>
        </div>
        <div class="sheet-footer">
            <button class="sheet-btn sheet-btn-cancel" id="cancel-model-selection">取消</button>
            <button class="sheet-btn sheet-btn-confirm" id="confirm-model-selection">确认</button>
        </div>
    </div>
</div>
`;

document.addEventListener('DOMContentLoaded', () => {
    // 注入模态框 HTML
    document.getElementById('modals-container').innerHTML = modelSelectionPanelHtml;

    const mainContent = document.getElementById('main-content');
    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');
    if (!apiId) {
        mainContent.innerHTML = '<p class="error-message">错误：未找到配置 ID。</p>';
        return;
    }

    const allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const config = allConfigs.find(c => c.id == apiId);
    if (!config) {
        mainContent.innerHTML = `<p class="error-message">错误：ID 为 ${apiId} 的配置不存在。</p>`;
        return;
    }

    // 初始化暂存的模型数组
    currentSelectedModels = [...(config.model || [])];

    const formHtml = `
        <div class="form-wrapper">
            <form class="api-form-container" id="edit-api-form">
                <div class="form-group"><label for="api-name">名称</label><input type="text" id="api-name" value="${config.name || ''}"></div>
                <div class="form-group"><label for="api-key">API Key</label><input type="text" id="api-key" value="${config.apiKey || ''}"></div>
                <div class="form-group"><label for="api-base-url">API Base URL</label><input type="text" id="api-base-url" value="${config.baseUrl || ''}"></div>
                ${config.provider === 'openai' ? `<div class="form-group" id="api-path-group"><label for="api-path">API 路径</label><input type="text" id="api-path" value="${config.path || ''}"></div>` : ''}
                
                <div class="form-group-action">
                    <button type="button" class="btn-fetch" id="fetch-models-btn">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>拉取模型</span>
                    </button>
                </div>
                <div id="selected-models-container"></div>
            </form>
        </div>
    `;
    mainContent.innerHTML = formHtml;

    // 缓存所有需要操作的 DOM 元素
    ui = {
        saveBtn: document.getElementById('save-btn'),
        deleteBtn: document.getElementById('delete-btn'),
        fetchModelsBtn: document.getElementById('fetch-models-btn'),
        modelOverlay: document.getElementById('model-selection-overlay'),
        modelList: document.getElementById('model-checkbox-list'),
        confirmBtn: document.getElementById('confirm-model-selection'),
        cancelBtn: document.getElementById('cancel-model-selection'),
        selectedContainer: document.getElementById('selected-models-container'),
        modelSearchInput: document.getElementById('model-search-input'),
        noModelsFoundMsg: document.getElementById('no-models-found')
    };

    // 绑定所有事件
    if (ui.saveBtn) ui.saveBtn.addEventListener('click', () => handleSave(apiId));
    if (ui.deleteBtn) ui.deleteBtn.addEventListener('click', () => handleDelete(apiId, config.name));
    if (ui.fetchModelsBtn) ui.fetchModelsBtn.addEventListener('click', fetchAndShowModels);
    if (ui.modelOverlay) ui.modelOverlay.addEventListener('click', (e) => { if (e.target === ui.modelOverlay) closeModelPanel(); });
    if (ui.cancelBtn) ui.cancelBtn.addEventListener('click', closeModelPanel);
    if (ui.confirmBtn) ui.confirmBtn.addEventListener('click', handleConfirmSelection);
    if (ui.modelList) { ui.modelList.addEventListener('click', (event) => { const item = event.target.closest('.model-checkbox-item'); if (item) { const checkbox = item.querySelector('input[type="checkbox"]'); if (checkbox) { checkbox.checked = !checkbox.checked; } } }); }
    if (ui.modelSearchInput) { ui.modelSearchInput.addEventListener('input', handleModelSearch); }

    renderSelectedModels();
});

function handleModelSearch() {
    const searchTerm = ui.modelSearchInput.value.toLowerCase();
    const items = ui.modelList.querySelectorAll('.model-checkbox-item');
    let visibleCount = 0;

    items.forEach(item => {
        const label = item.querySelector('.checkbox-label');
        if (label) {
            const modelName = label.textContent.toLowerCase();
            const isVisible = modelName.includes(searchTerm);
            item.style.display = isVisible ? 'flex' : 'none';
            if (isVisible) {
                visibleCount++;
            }
        }
    });
    ui.noModelsFoundMsg.style.display = visibleCount === 0 ? 'block' : 'none';
}

function renderSelectedModels() {
    if (!ui.selectedContainer) return;
    ui.selectedContainer.innerHTML = '';
    if (currentSelectedModels.length === 0) {
        ui.selectedContainer.innerHTML = '<p class="no-models-selected">尚未选择任何模型</p>';
    } else {
        currentSelectedModels.forEach(modelId => {
            const tag = document.createElement('div');
            tag.className = 'model-tag';
            tag.textContent = modelId;
            ui.selectedContainer.appendChild(tag);
        });
    }
}

function openModelPanel() {
    if (ui.modelSearchInput) {
        ui.modelSearchInput.value = '';
    }
    handleModelSearch();
    ui.modelOverlay?.classList.add('active');
}

// ▼▼▼ 核心 Bug 修复：补上这个丢失的函数 ▼▼▼
function closeModelPanel() {
    ui.modelOverlay?.classList.remove('active');
}
// ▲▲▲ 修复结束 ▲▲▲

function handleConfirmSelection() {
    const selectedInputs = ui.modelList.querySelectorAll('input[type="checkbox"]:checked');
    currentSelectedModels = Array.from(selectedInputs).map(input => input.value);
    renderSelectedModels();
    closeModelPanel();
}

async function fetchAndShowModels() {
    const baseUrl = document.getElementById('api-base-url').value.trim().replace(/\/$/, '');
    const apiKey = document.getElementById('api-key').value.trim();
    if (!baseUrl || !apiKey) {
        alert('请先填写 API Base URL 和 API Key！');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');
    const config = (JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || []).find(c => c.id == apiId);
    if (!config) {
        alert('错误：无法找到当前配置信息。');
        return;
    }

    const provider = config.provider;
    const btnSpan = ui.fetchModelsBtn.querySelector('span');
    ui.fetchModelsBtn.disabled = true;
    btnSpan.textContent = '正在拉取...';

    try {
        let response;
        let modelsEndpoint = '';

        if (provider === 'google') {
            modelsEndpoint = `${baseUrl}/models?key=${apiKey}`;
            response = await fetch(modelsEndpoint);
        } else {
            const userPath = (document.getElementById('api-path') || {}).value || '/v1/chat/completions';
            const modelsPath = userPath.replace(/chat\/completions$/, 'models').replace(/completions$/, 'models');
            modelsEndpoint = baseUrl + (modelsPath || '/v1/models');
            response = await fetch(modelsEndpoint, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const models = data.data || data.models || data || [];

        if (!Array.isArray(models) || models.length === 0) {
            alert('成功连接，但未返回任何模型。');
            return;
        }
        
        ui.modelList.innerHTML = '';
        models.forEach(model => {
            const modelId = model.id || model.name;
            const modelName = model.displayName || model.id || model.name;
            const isChecked = currentSelectedModels.includes(modelId);

            const item = document.createElement('li');
            item.className = 'model-checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="model-${modelId}" value="${modelId}" ${isChecked ? 'checked' : ''}>
                <label for="model-${modelId}" class="checkbox-label">${modelName}</label>
                <div class="custom-checkbox"><i class="fa-solid fa-check"></i></div>
            `;
            ui.modelList.appendChild(item);
        });
        
        openModelPanel();

    } catch (error) {
        alert(`模型拉取失败！\n\n${error.message}`);
    } finally {
        ui.fetchModelsBtn.disabled = false;
        btnSpan.textContent = '拉取模型';
    }
}

function handleSave(apiId) {
    const allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const configIndex = allConfigs.findIndex(c => c.id == apiId);

    if (configIndex > -1) {
        allConfigs[configIndex].name = document.getElementById('api-name').value.trim();
        allConfigs[configIndex].apiKey = document.getElementById('api-key').value.trim();
        allConfigs[configIndex].baseUrl = document.getElementById('api-base-url').value.trim();
        allConfigs[configIndex].model = currentSelectedModels;

        const apiPathInput = document.getElementById('api-path');
        if (apiPathInput) {
            allConfigs[configIndex].path = apiPathInput.value.trim();
        }

        localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(allConfigs));
        alert('配置已保存！');
        window.location.href = './api-management.html';
    } else {
        alert('错误：找不到要保存的配置。');
    }
}

function handleDelete(apiId, apiName) {
    if (confirm(`确定要删除配置 "${apiName}" 吗？`)) {
        let updatedConfigs = (JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || []).filter(c => c.id != apiId);
        localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(updatedConfigs));
        window.location.href = './api-management.html';
    }
}