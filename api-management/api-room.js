// api-room.js

const API_CONFIGS_KEY = 'api_configs_text';

// 新增：为 Claude 提供一个内置的模型列表
const CLAUDE_MODELS = [
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    { id: "claude-2.1", name: "Claude 2.1" },
    { id: "claude-2.0", name: "Claude 2.0" }
];

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');
    if (!apiId) { /* ... error handling ... */ return; }

    const allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const config = allConfigs.find(c => c.id == apiId);
    if (!config) { /* ... error handling ... */ return; }

    // ▼▼▼ 修改：让所有服务商都显示模型区域 ▼▼▼
    const formHtml = `
        <div class="form-wrapper">
            <form class="api-form-container" id="edit-api-form">
                <div class="form-group">
                    <label for="api-name">名称</label>
                    <input type="text" id="api-name" value="${config.name || ''}">
                </div>
                <div class="form-group">
                    <label for="api-key">API Key</label>
                    <input type="text" id="api-key" value="${config.apiKey || ''}">
                </div>
                <div class="form-group">
                    <label for="api-base-url">API Base URL</label>
                    <input type="text" id="api-base-url" value="${config.baseUrl || ''}">
                </div>
                ${config.provider === 'openai' ? `
                <div class="form-group" id="api-path-group">
                    <label for="api-path">API 路径</label>
                    <input type="text" id="api-path" value="${config.path || ''}">
                </div>
                ` : ''}
                
                <!-- 模型选择区域对所有 provider 都可见 -->
                <div class="form-group">
                    <label for="api-model">模型</label>
                    <select id="api-model">
                        ${config.model ? `<option value="${config.model}" selected>${config.model}</option>` : '<option value="">请先拉取模型</option>'}
                    </select>
                </div>
                <div class="form-group-action">
                    <button type="button" class="btn-fetch" id="fetch-models-btn">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>拉取模型</span>
                    </button>
                </div>
            </form>
        </div>
    `;
    // ▲▲▲ 修改结束 ▲▲▲

    mainContent.innerHTML = formHtml;

    // 绑定所有按钮事件
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const fetchModelsBtn = document.getElementById('fetch-models-btn');

    if (saveBtn) saveBtn.addEventListener('click', () => handleSave(apiId));
    if (deleteBtn) deleteBtn.addEventListener('click', () => handleDelete(apiId, config.name));
    if (fetchModelsBtn) {
        // 将当前配置信息传入，以便知道是为哪个 provider 拉取
        fetchModelsBtn.addEventListener('click', () => fetchModels(config));
    }
});


// ▼▼▼ 核心修改：重构 fetchModels 为调度函数 ▼▼▼
async function fetchModels(config) {
    const fetchBtn = document.getElementById('fetch-models-btn');
    const btnSpan = fetchBtn.querySelector('span');
    const modelSelect = document.getElementById('api-model');

    // 1. UI 反馈
    fetchBtn.disabled = true;
    btnSpan.textContent = '正在拉取...';

    let models = [];
    try {
        // 2. 根据 provider 调用不同的拉取方法
        switch (config.provider) {
            case 'openai':
                models = await _fetchOpenAICompatibleModels();
                break;
            case 'google':
                models = await _fetchGoogleModels();
                break;
            case 'claude':
                models = await _fetchClaudeModels();
                break;
            default:
                throw new Error('不支持的服务商类型');
        }

        // 3. 更新下拉框
        if (models.length === 0) {
            alert('成功连接，但未返回任何模型。');
            modelSelect.innerHTML = '<option value="">未找到模型</option>';
        } else {
            modelSelect.innerHTML = '';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name || model.id; // 优先使用 name
                modelSelect.appendChild(option);
            });
            // 如果不是 Claude，则弹出成功提示
            if (config.provider !== 'claude') {
                alert(`成功拉取 ${models.length} 个模型！`);
            }
        }
    } catch (error) {
        alert(`模型拉取失败！\n\n错误详情: ${error.message}\n\n请检查 Base URL 是否正确，以及 Key 是否有效。`);
    } finally {
        // 4. 恢复按钮状态
        fetchBtn.disabled = false;
        btnSpan.textContent = '拉取模型';
    }
}

// --- 针对不同服务商的私有拉取函数 ---

async function _fetchOpenAICompatibleModels() {
    const baseUrl = document.getElementById('api-base-url').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
    if (!baseUrl || !apiKey) throw new Error('请先填写 API Base URL 和 API Key！');

    const response = await fetch(`${baseUrl}/v1/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);
    const data = await response.json();
    return (data.data || []).map(m => ({ id: m.id, name: m.id }));
}

async function _fetchGoogleModels() {
    const baseUrl = document.getElementById('api-base-url').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
    if (!baseUrl || !apiKey) throw new Error('请先填写 API Base URL 和 API Key！');

    // Google API 的 Key 是通过 URL 参数传递的
    const response = await fetch(`${baseUrl}/models?key=${apiKey}`);
    if (!response.ok) throw new Error(`HTTP 错误: ${response.status}`);
    const data = await response.json();
    // Google 的模型数据在 `models` 字段下
    return (data.models || []).map(m => ({ id: m.name, name: m.displayName }));
}

async function _fetchClaudeModels() {
    // Claude 没有 API 端点，我们直接返回预设列表
    alert("Claude 模型列表是内置的，无需网络请求。");
    // 使用 Promise.resolve 来模拟异步操作，保持函数签名一致
    return Promise.resolve(CLAUDE_MODELS);
}
// ▲▲▲ 修改结束 ▲▲▲




// ▼▼▼ 修改：handleSave 现在也会保存模型选择 ▼▼▼
function handleSave(apiId) {
    const allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const configIndex = allConfigs.findIndex(c => c.id == apiId);

    if (configIndex > -1) {
        // 更新表单数据
        allConfigs[configIndex].name = document.getElementById('api-name').value.trim();
        allConfigs[configIndex].apiKey = document.getElementById('api-key').value.trim();
        allConfigs[configIndex].baseUrl = document.getElementById('api-base-url').value.trim();
        
        const pathInput = document.getElementById('api-path');
        if (pathInput) {
            allConfigs[configIndex].path = pathInput.value.trim();
        }
        
        // 新增：保存模型
        const modelSelect = document.getElementById('api-model');
        if (modelSelect) {
            allConfigs[configIndex].model = modelSelect.value;
        }

        localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(allConfigs));
        window.location.href = './api-management.html';
    } else {
        alert('错误：找不到要保存的配置。');
    }
}
// ▲▲▲ 修改结束 ▲▲▲

// handleDelete 函数保持不变
function handleDelete(apiId, apiName) {
    if (confirm(`确定要删除配置 "${apiName}" 吗？`)) {
        let allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
        const updatedConfigs = allConfigs.filter(c => c.id != apiId);
        localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(updatedConfigs));
        window.location.href = './api-management.html';
    }
}