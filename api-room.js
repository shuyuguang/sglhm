// api-room.js 

import { dbStorage } from '../common/db.js'; // ▼▼▼ 1. 导入我们的 dbStorage ▼▼▼

const API_CONFIGS_KEY = 'api_configs_text';
let ui = {};
let currentSelectedModels = [];

// ▼▼▼ 1. 新增一个“提示字典”，专门存放这两个卡片的提示信息 ▼▼▼
const HINT_MESSAGES = {
    'default-openai': '兼容OpenAI、反代轮询、New API、One API、Veloera等格式', // 你以后可以在这里修改内容
    'default-google': 'Google API官网：https://aistudio.google.com/app/apikey'  // 你以后可以在这里修改内容
};

// ... (modelSelectionPanelHtml 定义保持不变) ...
const modelSelectionPanelHtml = `
<div class="modal-overlay" id="model-selection-overlay">
    <div class="modal-panel">
        <div class="modal-header">选择模型</div>
        <div class="search-bar-container"><i class="fa-solid fa-magnifying-glass search-icon"></i><input type="search" id="model-search-input" placeholder="搜索模型名称..."></div>
        <div class="modal-content-container">
            <ul class="model-checkbox-list" id="model-checkbox-list"></ul>
            <div id="no-models-found" class="no-models-found-message">未找到匹配的模型</div>
        </div>
        <div class="sheet-footer"><button class="sheet-btn sheet-btn-cancel" id="cancel-model-selection">取消</button><button class="sheet-btn sheet-btn-confirm" id="confirm-model-selection">确认</button></div>
    </div>
</div>
`;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('modals-container').innerHTML = modelSelectionPanelHtml;

    const mainContent = document.getElementById('main-content');
    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');
    if (!apiId) {
        mainContent.innerHTML = '<p class="error-message">错误：未找到配置 ID。</p>';
        return;
    }

    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    const config = allConfigs.find(c => c.id == apiId);
    if (!config) {
        mainContent.innerHTML = `<p class="error-message">错误：ID 为 ${apiId} 的配置不存在。</p>`;
        return;
    }
    currentSelectedModels = [...(config.model || [])];

    // ▼▼▼ 2. 从我们的“提示字典”里查找对应的提示文本 ▼▼▼
    const hintText = HINT_MESSAGES[apiId];
    const hintCardHtml = hintText ? `
        <div class="hint-card">
            <i class="fa-solid fa-circle-info icon"></i>
            <div class="hint-text-content">
                <h4 class="hint-title">提示</h4>
                <p class="hint-content">${hintText}</p>
            </div>
        </div>
    ` : '';

    // ▼▼▼ 3. 将提示卡片 HTML 插入到表单的最上方 ▼▼▼
    const formHtml = `
        <div class="form-wrapper">
            <form class="api-form-container" id="edit-api-form">
                ${hintCardHtml}
                <div class="form-group"><label for="api-name">名称</label><input type="text" id="api-name" value="${config.name || ''}"></div>
                <div class="form-group"><label for="api-key">API Key</label><input type="text" id="api-key" value="${config.apiKey || ''}"></div>
                <div class="form-group"><label for="api-base-url">API Base URL</label><input type="text" id="api-base-url" value="${config.baseUrl || ''}"></div>
                ${config.provider === 'openai' ? `<div class="form-group" id="api-path-group"><label for="api-path">API 路径</label><input type="text" id="api-path" value="${config.path || ''}"></div>` : ''}
                <div class="form-group-action"><button type="button" class="btn-fetch" id="fetch-models-btn"><i class="fa-solid fa-wand-magic-sparkles"></i><span>拉取模型</span></button></div>
                <div class="form-group"><label for="selected-models-container">已选模型</label><div id="selected-models-container"></div></div>
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
            const item = document.createElement('div');
            item.className = 'model-list-item'; 
            item.textContent = modelId;
            ui.selectedContainer.appendChild(item);
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

function closeModelPanel() {
    ui.modelOverlay?.classList.remove('active');
}

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
    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
    const config = allConfigs.find(c => c.id == apiId);
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

async function handleSave(apiId) {
    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
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

        await dbStorage.setItem(API_CONFIGS_KEY, allConfigs); // 写入 Dexie
        alert('配置已保存！');
        window.location.href = './api-management.html';
    } else {
        alert('错误：找不到要保存的配置。');
    }
}

async function handleDelete(apiId, apiName) {
    if (confirm(`确定要删除配置 "${apiName}" 吗？`)) {
        let allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
        let updatedConfigs = allConfigs.filter(c => c.id != apiId);
        await dbStorage.setItem(API_CONFIGS_KEY, updatedConfigs); // 写入 Dexie
        window.location.href = './api-management.html';
    }
}