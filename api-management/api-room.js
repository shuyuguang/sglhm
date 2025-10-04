// api-room.js

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

    // ▼▼▼ 核心修改：在表单中加入了模型选择和拉取按钮 ▼▼▼
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
                
                <!-- 新增：模型选择区域 -->
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
                ` : ''}
            </form>
        </div>
    `;
    // ▲▲▲ 修改结束 ▲▲▲

    mainContent.innerHTML = formHtml;

    // 绑定保存和删除按钮事件
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => handleSave(apiId));
    if (deleteBtn) deleteBtn.addEventListener('click', () => handleDelete(apiId, config.name));

    // ▼▼▼ 新增：为“拉取模型”按钮绑定事件 ▼▼▼
    const fetchModelsBtn = document.getElementById('fetch-models-btn');
    if (fetchModelsBtn) {
        fetchModelsBtn.addEventListener('click', fetchModels);
    }
});

/**
 * 新增：拉取模型列表的函数
 */
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

    // 提供即时反馈
    fetchBtn.disabled = true;
    btnSpan.textContent = '正在拉取...';

    try {
        const response = await fetch(`${baseUrl}/v1/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const models = data.data || [];

        if (models.length === 0) {
            alert('成功连接，但未返回任何模型。');
            return;
        }
        
        // 清空并填充下拉框
        modelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            modelSelect.appendChild(option);
        });

        alert(`成功拉取 ${models.length} 个模型！`);

    } catch (error) {
        alert(`模型拉取失败！\n\n错误详情: ${error.message}\n\n请检查 Base URL 是否正确，以及 Key 是否有效。`);
    } finally {
        // 恢复按钮状态
        fetchBtn.disabled = false;
        btnSpan.textContent = '拉取模型';
    }
}


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