// api-room.js (全新通用版本)

const API_CONFIGS_KEY = 'api_configs_text';

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

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

    // ▼▼▼ 修改：API 路径的显示逻辑保持不变，只对 openai 显示 ▼▼▼
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

    // 绑定按钮事件
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const fetchModelsBtn = document.getElementById('fetch-models-btn');

    if (saveBtn) saveBtn.addEventListener('click', () => handleSave(apiId));
    if (deleteBtn) deleteBtn.addEventListener('click', () => handleDelete(apiId, config.name));
    if (fetchModelsBtn) {
        fetchModelsBtn.addEventListener('click', fetchModels); // 直接调用通用函数
    }
});

// ▼▼▼ 核心修改：fetchModels 函数恢复为单一、通用的实现 ▼▼▼
async function fetchModels() {
    const baseUrlInput = document.getElementById('api-base-url');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('api-model');
    const fetchBtn = document.getElementById('fetch-models-btn');
    const btnSpan = fetchBtn.querySelector('span');

    if (!baseUrlInput || !apiKeyInput || !modelSelect || !fetchBtn) return;

    const baseUrl = baseUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!baseUrl || !apiKey) {
        alert('请先填写 API Base URL 和 API Key！');
        return;
    }

    // 1. 获取当前配置，判断 provider (核心新增)
    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');
    const allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const config = allConfigs.find(c => c.id == apiId);

    if (!config) {
        alert('错误：无法找到当前配置信息。');
        return;
    }
    const provider = config.provider; // 获取到是 'google', 'openai' 还是 'claude'

    fetchBtn.disabled = true;
    btnSpan.textContent = '正在拉取...';

    try {
        let response;
        // 2. 根据 provider 决定请求方式 (核心修改)
        if (provider === 'google') {
            // 使用 Gemini 的方式请求
            response = await fetch(`${baseUrl}/models?key=${apiKey}`);
        } else {
            // 默认使用 OpenAI / Claude 兼容的方式请求
            response = await fetch(`${baseUrl}/v1/models`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP 错误: ${response.status} ${response.statusText}\n响应内容: ${errorText}`);
        }

        const data = await response.json();
        // 3. 兼容不同 API 返回的模型数据结构 (增强兼容性)
        const models = data.data || data.models || data || [];

        if (!Array.isArray(models) || models.length === 0) {
            alert('成功连接，但未返回任何模型。请检查Key的权限。');
            modelSelect.innerHTML = '<option value="">未找到模型</option>';
            return;
        }
        
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            // 4. 兼容不同 API 返回的模型 ID 和名称 (增强兼容性)
            const modelId = model.id || model.name; // OpenAI用id, Gemini用name
            const modelName = model.displayName || model.id || model.name; // Gemini有displayName
            
            option.value = modelId;
            option.textContent = modelName;
            modelSelect.appendChild(option);
        });

        alert(`成功拉取 ${models.length} 个模型！`);

    } catch (error) {
        alert(`模型拉取失败！\n\n错误详情: ${error.message}\n\n请检查 Base URL 是否正确，以及 Key 是否有效且已启用相关API。`);
    } finally {
        fetchBtn.disabled = false;
        btnSpan.textContent = '拉取模型';
    }
}
// ▲▲▲ 替换到这里结束 ▲▲▲



// ▼▼▼ 修改：handleSave 现在也会保存模型和路径 ▼▼▼
function handleSave(apiId) {
    const allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const configIndex = allConfigs.findIndex(c => c.id == apiId);

    if (configIndex > -1) {
        // 更新所有表单数据
        allConfigs[configIndex].name = document.getElementById('api-name').value.trim();
        allConfigs[configIndex].apiKey = document.getElementById('api-key').value.trim();
        allConfigs[configIndex].baseUrl = document.getElementById('api-base-url').value.trim();
        allConfigs[configIndex].path = document.getElementById('api-path').value.trim(); // 保存路径
        allConfigs[configIndex].model = document.getElementById('api-model').value; // 保存模型

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