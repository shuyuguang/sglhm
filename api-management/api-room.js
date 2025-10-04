// api-room.js (全新版本，无 template 依赖)

// 和 api-management.js 使用相同的 Key 来读取数据
const API_CONFIGS_KEY = 'api_configs_text';

// 页面加载后立即执行
document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // 1. 从 URL 获取 ID
    const params = new URLSearchParams(window.location.search);
    const apiId = params.get('id');

    if (!apiId) {
        mainContent.innerHTML = '<p class="error-message">错误：未找到配置 ID。</p>';
        return;
    }

    // 2. 从 localStorage 加载并查找对应的配置
    const allConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const config = allConfigs.find(c => c.id == apiId);

    if (!config) {
        mainContent.innerHTML = `<p class="error-message">错误：ID 为 ${apiId} 的配置不存在。</p>`;
        return;
    }

    // 3. 根据查找到的配置，动态生成表单 HTML
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
            </form>
        </div>
    `;

    // 4. 将生成的表单注入到主内容区
    mainContent.innerHTML = formHtml;

    // 5. 为顶栏的按钮绑定事件
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => handleSave(config));
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDelete(config));
    }
});

// 6. 定义保存和删除的逻辑
function handleSave(config) {
    // 实际开发中，这里会读取表单新数据，更新localStorage
    const newName = document.getElementById('api-name').value;
    alert(`配置 "${newName}" 已保存！(功能待实现)`);
    window.location.href = './api-management.html'; // 返回列表页
}

function handleDelete(config) {
    if (confirm(`确定要删除配置 "${config.name}" 吗？`)) {
        // 实际开发中，这里会从localStorage中移除该项
        alert('已删除！(功能待实现)');
        window.location.href = './api-management.html'; // 返回列表页
    }
}