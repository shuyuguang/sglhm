// api-room-builtin.js 

import { dbStorage } from '../common/db.js';

// 1. 定义一个新的数据库键，专门存储内置API的用户数据（Key和模型）
const BUILT_IN_API_DATA_KEY = 'built_in_api_data';

// 2. 定义内置API的静态信息（名称、URL等），这是我们的“数据源”
const BUILT_IN_API_DEFINITIONS = {
    'built-in-deepseek': { 
        name: 'DeepSeek', 
        baseUrl: 'https://api.deepseek.com/v1', 
        path: '/chat/completions' 
    },
    'built-in-siliconflow': { 
        name: '硅基流动', 
        baseUrl: 'https://api.siliconflow.cn/v1', 
        path: '/chat/completions' 
    },
    'built-in-volcengine': { 
        name: '火山引擎', 
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', 
        path: '/chat/completions' 
    },
    'built-in-openrouter': { 
        name: 'OpenRouter', 
        baseUrl: 'https://openrouter.ai/api/v1', 
        path: '/chat/completions' 
    },
};

let ui = {};
let currentSelectedModels = [];

// 模型选择面板的 HTML 结构 (和原来一样)
const modelSelectionPanelHtml = `
<div class="modal-overlay" id="model-selection-overlay">
    <div class="modal-panel">
        <div class="modal-header">选择模型</div>
        <div class="search-bar-container">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="search" id="model-search-input" placeholder="搜索模型名称...">
        </div>
        <div class="modal-content-container">
            <ul class="model-checkbox-list" id="model-checkbox-list"></ul>
            <div id="no-models-found" class="no-models-found-message">未找到匹配的模型</div>
        </div>
        <div class="sheet-footer">
            <button class="sheet-btn sheet-btn-cancel" id="cancel-model-selection">取消</button>
            <button class="sheet-btn sheet-btn-confirm" id="confirm-model-selection">确认</button>
        </div>
    </div>
</div>
`;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('modals-container').innerHTML = modelSelectionPanelHtml;

    const mainContent = document.getElementById('main-content');
    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');

    // 3. 从我们的静态定义中获取基础信息
    const staticConfig = BUILT_IN_API_DEFINITIONS[apiId];
    if (!apiId || !staticConfig) {
        mainContent.innerHTML = '<p class="error-message">错误：未找到指定的内置配置。</p>';
        return;
    }

    // 4. 从数据库中获取该API的用户专属数据（Key和模型）
    const allUserData = await dbStorage.getItem(BUILT_IN_API_DATA_KEY) || {};
    const userConfig = allUserData[apiId] || {}; // 如果没有，就是个空对象

    // 5. 合并静态数据和用户数据，得到最终的配置
    const config = { ...staticConfig, ...userConfig };

    currentSelectedModels = [...(config.model || [])];

    // 6. ★★★ 核心区别：为不可修改的字段添加 readonly 属性 ★★★
    const formHtml = `
        <div class="form-wrapper">
            <form class="api-form-container" id="edit-api-form">
                <div class="form-group"><label for="api-name">名称</label><input type="text" id="api-name" value="${config.name}" readonly></div>
                <div class="form-group"><label for="api-key">API Key</label><input type="text" id="api-key" placeholder="sk-..." value="${config.apiKey || ''}"></div>
                <div class="form-group"><label for="api-base-url">API Base URL</label><input type="text" id="api-base-url" value="${config.baseUrl}" readonly></div>
                <div class="form-group" id="api-path-group"><label for="api-path">API 路径</label><input type="text" id="api-path" value="${config.path}" readonly></div>
                
                <div class="form-group-action">
                    <button type="button" class="btn-fetch" id="fetch-models-btn">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>拉取模型</span>
                    </button>
                </div>

                <div class="form-group">
                    <label for="selected-models-container">已选模型</label>
                    <div id="selected-models-container"></div>
                </div>
            </form>
        </div>
    `;
    mainContent.innerHTML = formHtml;

    ui = {
        saveBtn: document.getElementById('save-btn'),
        fetchModelsBtn: document.getElementById('fetch-models-btn'),
        modelOverlay: document.getElementById('model-selection-overlay'),
        modelList: document.getElementById('model-checkbox-list'),
        confirmBtn: document.getElementById('confirm-model-selection'),
        cancelBtn: document.getElementById('cancel-model-selection'),
        selectedContainer: document.getElementById('selected-models-container'),
        modelSearchInput: document.getElementById('model-search-input'),
        noModelsFoundMsg: document.getElementById('no-models-found')
    };

    // 绑定事件，注意没有 handleDelete
    if (ui.saveBtn) ui.saveBtn.addEventListener('click', () => handleSave(apiId));
    if (ui.fetchModelsBtn) ui.fetchModelsBtn.addEventListener('click', fetchAndShowModels);
    // ... 其他事件绑定和 api-room.js 保持一致
    if (ui.modelOverlay) ui.modelOverlay.addEventListener('click', (e) => { if (e.target === ui.modelOverlay) closeModelPanel(); });
    if (ui.cancelBtn) ui.cancelBtn.addEventListener('click', closeModelPanel);
    if (ui.confirmBtn) ui.confirmBtn.addEventListener('click', handleConfirmSelection);
    if (ui.modelList) { ui.modelList.addEventListener('click', (event) => { const item = event.target.closest('.model-checkbox-item'); if (item) { const checkbox = item.querySelector('input[type="checkbox"]'); if (checkbox) { checkbox.checked = !checkbox.checked; } } }); }
    if (ui.modelSearchInput) { ui.modelSearchInput.addEventListener('input', handleModelSearch); }

    renderSelectedModels();
});

// 7. ★★★ 全新的 handleSave 函数 ★★★
async function handleSave(apiId) {
    // 读取整个内置API的用户数据对象
    const allUserData = await dbStorage.getItem(BUILT_IN_API_DATA_KEY) || {};

    // 更新当前这个API的数据
    allUserData[apiId] = {
        apiKey: document.getElementById('api-key').value.trim(),
        model: currentSelectedModels
    };

    // 将整个对象存回数据库
    await dbStorage.setItem(BUILT_IN_API_DATA_KEY, allUserData);
    alert('配置已保存！');
    window.location.href = './api-management.html';
}


// --- 以下函数和 api-room.js 基本一致，可以直接复用 ---

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

async function fetchAndShowModels() {
    // 这个函数从表单读取 readonly 的值，完全没问题
    const baseUrl = document.getElementById('api-base-url').value.trim().replace(/\/$/, '');
    const apiKey = document.getElementById('api-key').value.trim();
    if (!baseUrl || !apiKey) {
        alert('请先填写 API Key！');
        return;
    }
    const btnSpan = ui.fetchModelsBtn.querySelector('span');
    ui.fetchModelsBtn.disabled = true;
    btnSpan.textContent = '正在拉取...';

    try {
        const modelsPath = document.getElementById('api-path').value.replace(/chat\/completions$/, 'models').replace(/completions$/, 'models');
        const modelsEndpoint = baseUrl + (modelsPath || '/v1/models');
        const response = await fetch(modelsEndpoint, { headers: { 'Authorization': `Bearer ${apiKey}` } });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        const data = await response.json();
        const models = data.data || data.models || data || [];
        if (!Array.isArray(models) || models.length === 0) {
            alert('成功连接，但未返回任何模型。');
            return;
        }
        
        ui.modelList.innerHTML = '';
        models.forEach(model => {
            const modelId = model.id || model.name;
            const isChecked = currentSelectedModels.includes(modelId);
            const item = document.createElement('li');
            item.className = 'model-checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="model-${modelId}" value="${modelId}" ${isChecked ? 'checked' : ''}>
                <label for="model-${modelId}" class="checkbox-label">${modelId}</label>
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

function handleModelSearch() {
    const searchTerm = ui.modelSearchInput.value.toLowerCase();
    const items = ui.modelList.querySelectorAll('.model-checkbox-item');
    let visibleCount = 0;
    items.forEach(item => {
        const modelName = item.querySelector('.checkbox-label').textContent.toLowerCase();
        const isVisible = modelName.includes(searchTerm);
        item.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) visibleCount++;
    });
    ui.noModelsFoundMsg.style.display = visibleCount === 0 ? 'block' : 'none';
}

function openModelPanel() {
    if (ui.modelSearchInput) ui.modelSearchInput.value = '';
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