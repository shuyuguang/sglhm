// api-room.js

import { dbStorage } from '../common/db.js';

const API_CONFIGS_KEY = 'api_configs_text';
let ui = {};
let currentSelectedModels = [];

const HINT_MESSAGES = {
    'default-openai': '兼容OpenAI、反代轮询、New API、One API、Veloera等格式',
    'default-google': 'Google API官网：https://aistudio.google.com/app/apikey'
};

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

const apiTestPanelHtml = `
<div class="modal-overlay" id="api-test-overlay">
    <div class="modal-panel api-test-panel">
        <div class="modal-header">测试 API</div>
        <div class="modal-content-container">
            <div class="test-form-group">
                <label for="test-model-select">选择一个模型进行测试</label>
                <select id="test-model-select"></select>
            </div>
            <button class="btn-send-test" id="send-test-request-btn">
                <i class="fa-solid fa-paper-plane"></i>
                <span>发送请求文本</span>
            </button>
            <div class="test-form-group">
                <label>测试报告</label>
                <div id="api-test-report">
                    <div class="no-report-message">尚未发送请求文本</div>
                </div>
            </div>
        </div>
        <div class="sheet-footer">
            <button class="sheet-btn sheet-btn-cancel" id="close-test-panel-btn">关闭</button>
        </div>
    </div>
</div>
`;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('modals-container').innerHTML = modelSelectionPanelHtml + apiTestPanelHtml;

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

    const formHtml = `
        <div class="form-wrapper">
            <form class="api-form-container" id="edit-api-form">
                ${hintCardHtml}
                <div class="form-group"><label for="api-name">名称</label><input type="text" id="api-name" value="${config.name || ''}"></div>
                
                <div class="form-group"><label for="api-key">API Key</label><input type="password" id="api-key" value="${config.apiKey || ''}"></div>

                <div class="form-group"><label for="api-base-url">API Base URL</label><input type="text" id="api-base-url" value="${config.baseUrl || ''}"></div>
                ${config.provider === 'openai' ? `<div class="form-group" id="api-path-group"><label for="api-path">API 路径</label><input type="text" id="api-path" value="${config.path || ''}"></div>` : ''}
                <div class="form-group-action">
                    <button type="button" class="btn-test" id="test-api-btn" title="测试此配置" disabled><i class="fa-solid fa-bolt"></i><span>测试API</span></button>
                    <button type="button" class="btn-fetch" id="fetch-models-btn"><i class="fa-solid fa-wand-magic-sparkles"></i><span>拉取模型</span></button>
                </div>
                <!-- ▼▼▼ 这里是修改点 ▼▼▼ -->
                <div class="form-group"><label>已选模型</label><div id="selected-models-container"></div></div>
                <!-- ▲▲▲ 修改结束 ▲▲▲ -->
            </form>
        </div>
    `;
    mainContent.innerHTML = formHtml;

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
        noModelsFoundMsg: document.getElementById('no-models-found'),
        testApiBtn: document.getElementById('test-api-btn'),
        testApiOverlay: document.getElementById('api-test-overlay'),
        testApiModelSelect: document.getElementById('test-model-select'),
        closeTestPanelBtn: document.getElementById('close-test-panel-btn'),
        sendTestRequestBtn: document.getElementById('send-test-request-btn'),
        apiTestReport: document.getElementById('api-test-report'),
    };

    if (ui.saveBtn) ui.saveBtn.addEventListener('click', () => handleSave(apiId));
    if (ui.deleteBtn) ui.deleteBtn.addEventListener('click', () => handleDelete(apiId, config.name));
    if (ui.fetchModelsBtn) ui.fetchModelsBtn.addEventListener('click', fetchAndShowModels);
    if (ui.modelOverlay) ui.modelOverlay.addEventListener('click', (e) => { if (e.target === ui.modelOverlay) closeModelPanel(); });
    if (ui.cancelBtn) ui.cancelBtn.addEventListener('click', closeModelPanel);
    if (ui.confirmBtn) ui.confirmBtn.addEventListener('click', handleConfirmSelection);
    if (ui.modelList) { ui.modelList.addEventListener('click', (event) => { const item = event.target.closest('.model-checkbox-item'); if (item) { const checkbox = item.querySelector('input[type="checkbox"]'); if (checkbox) { checkbox.checked = !checkbox.checked; } } }); }
    if (ui.modelSearchInput) { ui.modelSearchInput.addEventListener('input', handleModelSearch); }
    if (ui.testApiBtn) ui.testApiBtn.addEventListener('click', openTestPanel);
    if (ui.testApiOverlay) ui.testApiOverlay.addEventListener('click', (e) => { if (e.target === ui.testApiOverlay) closeTestPanel(); });
    if (ui.closeTestPanelBtn) ui.closeTestPanelBtn.addEventListener('click', closeTestPanel);
    if (ui.sendTestRequestBtn) ui.sendTestRequestBtn.addEventListener('click', () => handleApiTest(apiId));

// ▼▼▼ 新增点：为API Key输入框添加事件监听 ▼▼▼
    const apiKeyInput = document.getElementById('api-key');
    if (apiKeyInput) {
        // 如果初始有值，立即设置为 password 类型
        if (apiKeyInput.value) {
            apiKeyInput.type = 'password';
        }
        apiKeyInput.addEventListener('focus', function() {
            this.type = 'text';
        });
        apiKeyInput.addEventListener('blur', function() {
            if (this.value) {
                this.type = 'password';
            }
        });
    }
    // ▲▲▲ 新增结束 ▲▲▲

    renderSelectedModels();
});

function openTestPanel() {
    if (currentSelectedModels.length === 0) {
        alert('请先拉取并选择至少一个模型后再进行测试。');
        return;
    }
    if (ui.testApiModelSelect) {
        ui.testApiModelSelect.innerHTML = currentSelectedModels
            .map(modelId => `<option value="${modelId}">${modelId}</option>`)
            .join('');
    }
    ui.apiTestReport.innerHTML = '<div class="no-report-message">尚未发送请求文本</div>';
    ui.testApiOverlay?.classList.add('active');
}

function closeTestPanel() {
    ui.testApiOverlay?.classList.remove('active');
}

// ▼▼▼ 修改/新增：更新整个API测试逻辑以支持Google API ▼▼▼
async function handleApiTest(apiId) {
    const btn = ui.sendTestRequestBtn;
    const btnSpan = btn.querySelector('span');
    btn.disabled = true;
    btnSpan.textContent = '正在测试...';
    ui.apiTestReport.innerHTML = '<div class="no-report-message">测试中，请稍候...</div>';

    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    const config = allConfigs.find(c => c.id == apiId);
    if (!config) {
        ui.apiTestReport.innerHTML = `<div class="report-error-details">错误：找不到当前配置</div>`;
        btn.disabled = false;
        btnSpan.textContent = '发送请求文本';
        return;
    }

    const baseUrl = document.getElementById('api-base-url').value.trim().replace(/\/$/, '');
    const apiKey = document.getElementById('api-key').value.trim();
    const selectedModel = ui.testApiModelSelect.value;
    const userMessage = '你好，很高兴见到你，我是User。';
    const sentChars = userMessage.length;

    let endpoint;
    let fetchOptions;
    let nonStreamPayload;
    let streamPayload;

    if (config.provider === 'google') {
        // ▼▼▼ 修正点：直接使用 selectedModel，因为它已包含 "models/..." 前缀 ▼▼▼
        endpoint = `${baseUrl}/${selectedModel}:generateContent?key=${apiKey}`;
        const googlePayload = {
            contents: [{ parts: [{ text: userMessage }] }]
        };
        nonStreamPayload = googlePayload;
        streamPayload = googlePayload; // Google API uses the same payload for both

        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Body will be added in test functions
        };
    } else { // OpenAI and compatible APIs
        const userPath = (document.getElementById('api-path') || {}).value || '/v1/chat/completions';
        endpoint = baseUrl + userPath;
        const openAiPayload = {
            model: selectedModel,
            messages: [{ role: 'user', content: userMessage }],
        };
        nonStreamPayload = { ...openAiPayload, stream: false };
        streamPayload = { ...openAiPayload, stream: true };

        fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            // Body will be added in test functions
        };
    }

    try {
        const nonStreamResult = await testNonStreaming(endpoint, { ...fetchOptions, body: JSON.stringify(nonStreamPayload) });
        
        // ▼▼▼ 修正点：流式URL也直接使用 selectedModel ▼▼▼
        const streamEndpoint = config.provider === 'google' 
            ? `${baseUrl}/${selectedModel}:streamGenerateContent?key=${apiKey}&alt=sse`
            : endpoint;
        const streamResult = await testStreaming(streamEndpoint, { ...fetchOptions, body: JSON.stringify(streamPayload) });
        
        renderTestReport({ 
            endpoint, 
            model: selectedModel, 
            sentChars,
            nonStreamResult, 
            streamResult 
        });

    } catch (error) {
        ui.apiTestReport.innerHTML = `<div class="report-error-details">发生意外错误: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btnSpan.textContent = '发送请求文本';
    }
}

async function testNonStreaming(endpoint, options) {
    const startTime = performance.now();
    try {
        const response = await fetch(endpoint, options);
        const duration = performance.now() - startTime;
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        return { status: 'success', duration: duration.toFixed(0) };
    } catch (error) {
        return { status: 'failure', error: error.message, type: error instanceof TypeError ? '网络错误' : 'API错误' };
    }
}

async function testStreaming(endpoint, options) {
    const startTime = performance.now();
    try {
        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const reader = response.body.getReader();
        await reader.read();
        const firstCharLatency = performance.now() - startTime;

        while (!(await reader.read()).done) {}
        
        const duration = performance.now() - startTime;

        return { 
            status: 'success', 
            firstCharLatency: firstCharLatency.toFixed(0),
            duration: duration.toFixed(0)
        };

    } catch (error) {
        return { status: 'failure', error: error.message, type: error instanceof TypeError ? '网络错误' : 'API错误' };
    }
}
// ▲▲▲ 修改/新增结束 ▲▲▲

function renderTestReport(data) {
    const { endpoint, model, sentChars, nonStreamResult, streamResult } = data;

    const renderSection = (title, result, isStream = false) => {
        const statusIcon = result.status === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
        const statusClass = result.status === 'success' ? 'success' : 'error';
        
        let detailsHtml = '';
        if (result.status === 'success') {
            let latencyHtml = '';
            if (isStream) {
                latencyHtml = `
                    <div class="report-item"><span class="report-item-label">首字</span><span class="report-item-value">${result.firstCharLatency} ms</span></div>
                    <div class="report-item"><span class="report-item-label">用时</span><span class="report-item-value">${result.duration} ms</span></div>
                `;
            } else {
                latencyHtml = `<div class="report-item"><span class="report-item-label">用时</span><span class="report-item-value">${result.duration} ms</span></div>`;
            }

            detailsHtml = `
                <div class="report-item"><span class="report-item-label">URL</span><span class="report-item-value">${endpoint}</span></div>
                <div class="report-item"><span class="report-item-label">Model</span><span class="report-item-value">${model}</span></div>
                <div class="report-item"><span class="report-item-label">发送字符</span><span class="report-item-value">${sentChars}</span></div>
                ${latencyHtml}
            `;
        } else {
            detailsHtml = `
                <div class="report-item"><span class="report-item-label">错误类型</span><span class="report-item-value">${result.type}</span></div>
                <div class="report-error-details">${result.error}</div>
            `;
        }

        return `
            <div class="report-section">
                <h4 class="report-title"><i class="fa-solid ${statusIcon} report-status ${statusClass}"></i>${title}</h4>
                ${detailsHtml}
            </div>
        `;
    };

    ui.apiTestReport.innerHTML = `
        ${renderSection('非流式请求测试', nonStreamResult, false)}
        ${renderSection('流式请求测试', streamResult, true)}
    `;
}

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
            if (isVisible) visibleCount++;
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
    if (ui.testApiBtn) {
        ui.testApiBtn.disabled = currentSelectedModels.length === 0;
    }
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
async function fetchAndShowModels() {
    const baseUrl = document.getElementById('api-base-url').value.trim().replace(/\/$/, '');
    const apiKey = document.getElementById('api-key').value.trim();
    if (!baseUrl || !apiKey) {
        alert('请先填写 API Base URL 和 API Key！');
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');
    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
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
    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
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
        await dbStorage.setItem(API_CONFIGS_KEY, allConfigs);
        window.location.href = './api-management.html';
    } else {
        alert('错误：找不到要保存的配置。');
    }
}

async function handleDelete(apiId, apiName) {
    if (confirm(`确定要删除配置 "${apiName}" 吗？`)) {
        let allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
        let updatedConfigs = allConfigs.filter(c => c.id != apiId);
        await dbStorage.setItem(API_CONFIGS_KEY, updatedConfigs);
        window.location.href = './api-management.html';
    }
}