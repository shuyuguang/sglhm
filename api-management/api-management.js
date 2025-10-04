// api-management.js

import { createPageLayout } from '../common/template.js';

// 使用 localStorage 的 Key，用于存储和读取 API 配置
const API_CONFIGS_KEY = 'api_configs_text';

// 1. 定义页面的专属 HTML 内容 (这部分不变)
const apiManagementPageContent = `
    <!-- Tab 导航栏 -->
    <nav class="tabs-nav">
        <div class="tabs-container">
            <button class="tab-button active" data-tab="text">文本</button>
            <button class="tab-button" data-tab="image">图片</button>
            <button class="tab-button" data-tab="voice">语音</button>
        </div>
    </nav>
    <div class="active-tab-indicator"></div>
    <div class="main-container">
        <main class="content-body">
            <div class="tabs-content">
                <div id="text" class="tab-pane active">
                    <!-- 卡片将由 JS 动态渲染到这里 -->
                </div>
                <div id="image" class="tab-pane">
                    <p>图片 API 配置区。</p>
                </div>
                <div id="voice" class="tab-pane">
                    <p>语音 API 配置区。</p>
                </div>
            </div>
        </main>
    </div>
`;

// 2. 定义模态框面板的 HTML 结构 (这部分不变)
const apiConfigPanelHtml = `
<div class="modal-overlay" id="api-config-overlay">
    <div class="modal-panel" id="api-config-panel">
        <div class="modal-tabs">
            <button class="modal-tab active" data-tab="text-panel">文本</button>
            <button class="modal-tab" data-tab="image-panel">图片</button>
            <button class="modal-tab" data-tab="voice-panel">语音</button>
        </div>
        <div class="modal-content-container">
            <div class="modal-tab-content active" id="text-panel-content">
                <div class="pill-options-container">
                    <button class="pill-option active" data-provider="openai">OpenAI</button>
                    <button class="pill-option" data-provider="google">Google</button>
                    <button class="pill-option" data-provider="claude">Claude</button>
                </div>
                <form class="api-form-container" id="api-provider-form">
                    <div class="form-group">
                        <label for="api-name">名称</label>
                        <input type="text" id="api-name" placeholder="例如：My Key">
                    </div>
                    <div class="form-group">
                        <label for="api-key">API Key</label>
                        <input type="text" id="api-key" placeholder="sk-...">
                    </div>
                    <div class="form-group">
                        <label for="api-base-url">API Base URL</label>
                        <input type="text" id="api-base-url" value="https://api.openai.com">
                    </div>
                    <div class="form-group" id="api-path-group">
                        <label for="api-path">API 路径</label>
                        <input type="text" id="api-path" value="/v1/chat/completions">
                    </div>
                </form>
            </div>
            <div class="modal-tab-content" id="image-panel-content">
                <p class="no-char-message">图片 API 配置区 (待开发)</p>
            </div>
            <div class="modal-tab-content" id="voice-panel-content">
                <p class="no-char-message">语音 API 配置区 (待开发)</p>
            </div>
        </div>
        <div class="sheet-footer">
            <button class="sheet-btn sheet-btn-cancel" id="cancel-panel-btn">取消</button>
            <button class="sheet-btn sheet-btn-confirm" id="add-api-btn">添加</button>
        </div>
    </div>
</div>
`;

// ▼▼▼ 新增：定义本页专属的帮助框 HTML 内容 ▼▼▼
const helpTooltipHtml = `
    <div id="help-tooltip" class="help-tooltip">
        <p>点击羽毛笔添加API，添加的API卡片右侧可选启动/禁用，点击卡片跳转编辑页面，记得拉取模型嗷</p>
    </div>
`;
// ▲▲▲ 新增结束 ▲▲▲

// ▼▼▼ 新增：将所有模态框/浮层 HTML 合并成一个字符串 ▼▼▼
const allModalsHtml = apiConfigPanelHtml + helpTooltipHtml;
// ▲▲▲ 新增结束 ▲▲▲

// 3. 服务商配置数据 (这部分不变)
const PROVIDER_CONFIG = {
    openai: { apiKeyPlaceholder: 'sk-...', baseUrlValue: 'https://api.openai.com', apiPathValue: '/v1/chat/completions', showApiPath: true },
    google: { apiKeyPlaceholder: 'AIzaSy...', baseUrlValue: 'https://generativelace.googleapis.com/v1beta', showApiPath: false },
    claude: { apiKeyPlaceholder: 'sk-ant-...', baseUrlValue: 'https://api.anthropic.com/v1', showApiPath: false }
};

let ui = {};

// 4. 功能函数区

function renderApiCards() {
    const configs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const container = document.getElementById('text');
    if (!container) return;
    if (configs.length === 0) {
        container.innerHTML = '<p>这里是【文本】的主配置区，还没有添加任何 API。</p>';
    } else {
        container.innerHTML = configs.map(config => {
            const enabledClass = config.enabled ? '' : 'disabled';
            const statusCapsule = config.enabled ? '<span class="status-capsule status-enabled">启用</span>' : '<span class="status-capsule status-disabled">禁用</span>';
            return `<div class="api-config-card ${enabledClass}" data-id="${config.id}"><span class="card-name">${config.name}</span>${statusCapsule}</div>`;
        }).join('');
    }
}

function updateFormForProvider(providerName) {
    const config = PROVIDER_CONFIG[providerName];
    if (!config || !ui.apiKeyInput || !ui.baseUrlInput || !ui.apiPathGroup) return;
    ui.apiKeyInput.placeholder = config.apiKeyPlaceholder;
    ui.baseUrlInput.value = config.baseUrlValue;
    if (config.showApiPath) {
        ui.apiPathInput.value = config.apiPathValue;
        ui.apiPathGroup.style.display = '';
    } else {
        ui.apiPathGroup.style.display = 'none';
    }
}

function openApiConfigPanel() {
    if (!ui.overlay) return;
    const activeMainTab = document.querySelector('.tab-button.active');
    let targetPanelTabId = 'text-panel'; 
    if (activeMainTab) {
        targetPanelTabId = `${activeMainTab.dataset.tab}-panel`;
    }
    switchPanelTab(targetPanelTabId);
    ui.overlay.classList.add('active');
}

function closeApiConfigPanel() {
    if (!ui.overlay) return;
    ui.overlay.classList.remove('active');
    if(ui.apiProviderForm) ui.apiProviderForm.reset();
    ui.panelContentContainer.querySelectorAll('.pill-option').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.provider === 'openai');
    });
    updateFormForProvider('openai');
}

function switchPanelTab(targetTabId) {
    if (!ui.panelTabs) return;
    ui.panelTabs.forEach(tab => tab.classList.remove('active'));
    ui.panelTabContents.forEach(content => content.classList.remove('active'));
    const targetTab = document.querySelector(`.modal-tab[data-tab="${targetTabId}"]`);
    const targetContent = document.getElementById(`${targetTabId}-content`);
    if (targetTab && targetContent) {
        targetTab.classList.add('active');
        targetContent.classList.add('active');
    }
}

function handleAddApi() {
    const provider = document.querySelector('.pill-option.active').dataset.provider;
    const name = document.getElementById('api-name').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
    const baseUrl = document.getElementById('api-base-url').value.trim();
    const path = document.getElementById('api-path').value.trim();
    if (!name || !apiKey) {
        alert('“名称”和“API Key”不能为空！');
        return;
    }
    const newConfig = {
        id: Date.now(), provider, name, apiKey, baseUrl,
        path: PROVIDER_CONFIG[provider].showApiPath ? path : null,
        enabled: true, model: ''
    };
    const existingConfigs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    existingConfigs.push(newConfig);
    localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(existingConfigs));
    renderApiCards();
    closeApiConfigPanel();
}

function handleToggleStatus(apiId) {
    const configs = JSON.parse(localStorage.getItem(API_CONFIGS_KEY)) || [];
    const configIndex = configs.findIndex(c => c.id == apiId);
    if (configIndex > -1) {
        configs[configIndex].enabled = !configs[configIndex].enabled;
        localStorage.setItem(API_CONFIGS_KEY, JSON.stringify(configs));
        renderApiCards();
    }
}

function initializePage() {
    const indicator = document.querySelector('.active-tab-indicator');
    const tabsNav = document.querySelector('.tabs-nav');
    function updateIndicatorPosition() {
        const activeButton = document.querySelector('.tab-button.active');
        if (!indicator || !activeButton || !tabsNav) { if(indicator) indicator.style.opacity = '0'; return; }
        const buttonRect = activeButton.getBoundingClientRect();
        const buttonCenter = buttonRect.left + buttonRect.width / 2;
        const indicatorLeft = buttonCenter - (indicator.offsetWidth / 2);
        indicator.style.left = `${indicatorLeft}px`;
        indicator.style.opacity = '1';
        const tabsNavRect = tabsNav.getBoundingClientRect();
        indicator.style.top = `${tabsNavRect.top + tabsNav.offsetHeight - indicator.offsetHeight / 2 - 4}px`;
        indicator.style.position = 'fixed';
    }
    document.body.addEventListener('click', function(event) {
        if (event.target.matches('.tab-button')) {
            const clickedButton = event.target;
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            clickedButton.classList.add('active');
            const targetPane = document.getElementById(clickedButton.dataset.tab);
            if (targetPane) targetPane.classList.add('active');
            updateIndicatorPosition();
        }
    });
    requestAnimationFrame(updateIndicatorPosition);
    window.addEventListener('scroll', updateIndicatorPosition, { passive: true });
    window.addEventListener('resize', updateIndicatorPosition);

    ui = {
        overlay: document.getElementById('api-config-overlay'), panel: document.getElementById('api-config-panel'),
        cancelBtn: document.getElementById('cancel-panel-btn'), addBtn: document.getElementById('add-api-btn'),
        panelTabsContainer: document.querySelector('#api-config-panel .modal-tabs'),
        panelTabs: document.querySelectorAll('#api-config-panel .modal-tab'),
        panelTabContents: document.querySelectorAll('#api-config-panel .modal-tab-content'),
        panelContentContainer: document.querySelector('#api-config-panel .modal-content-container'),
        apiProviderForm: document.getElementById('api-provider-form'), apiKeyInput: document.getElementById('api-key'),
        baseUrlInput: document.getElementById('api-base-url'), apiPathInput: document.getElementById('api-path'),
        apiPathGroup: document.getElementById('api-path-group')
    };

    if (ui.cancelBtn) ui.cancelBtn.addEventListener('click', closeApiConfigPanel);
    if (ui.addBtn) ui.addBtn.addEventListener('click', handleAddApi);
    if (ui.overlay) {
        ui.overlay.addEventListener('click', (event) => { if (event.target === ui.overlay) closeApiConfigPanel(); });
    }
    if (ui.panelTabsContainer) {
        ui.panelTabsContainer.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('modal-tab')) switchPanelTab(target.dataset.tab);
        });
    }
    if (ui.panelContentContainer) {
        ui.panelContentContainer.addEventListener('click', (event) => {
            if (event.target.matches('.pill-option')) {
                const clickedPill = event.target;
                const allPills = clickedPill.parentElement.querySelectorAll('.pill-option');
                allPills.forEach(pill => pill.classList.remove('active'));
                clickedPill.classList.add('active');
                updateFormForProvider(clickedPill.dataset.provider);
            }
        });
    }

    const textTabPane = document.getElementById('text');
    if (textTabPane) {
        textTabPane.addEventListener('click', (event) => {
            const card = event.target.closest('.api-config-card');
            if (!card) return;
            const apiId = card.dataset.id;
            if (event.target.matches('.status-capsule')) {
                handleToggleStatus(apiId);
            } else {
                window.location.href = `./api-room.html?id=${apiId}`;
            }
        });
    }
    renderApiCards();
}

// 5. 脚本的入口
createPageLayout({
    title: '配置',
    contentHtml: apiManagementPageContent,
    // ▼▼▼ 修改：传入合并后的 HTML ▼▼▼
    modalsHtml: allModalsHtml,
    // ▲▲▲ 修改结束 ▲▲▲
    onFeatherClick: openApiConfigPanel,
    onPageLoad: initializePage 
});