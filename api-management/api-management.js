// api-management.js

import { createPageLayout } from '../common/template.js';
import { dbStorage } from '../common/db.js';
// ▼▼▼ 修改：导入新增的 API_ORDER 键 ▼▼▼
import { API_DB_KEYS, DEFAULT_EDITABLE_APIS, BUILT_IN_APIS } from '../config/api.config.js';

const API_CONFIGS_KEY = API_DB_KEYS.CONFIGS;
const BUILT_IN_API_STATES_KEY = API_DB_KEYS.BUILT_IN_STATES;
const BUILT_IN_API_DATA_KEY = API_DB_KEYS.BUILT_IN_DATA;
// 新增：获取 API 顺序的键
const API_ORDER_KEY = API_DB_KEYS.API_ORDER;
// ▲▲▲ 修改结束 ▲▲▲


// ... (页面和模态框的 HTML 字符串保持不变) ...
const apiManagementPageContent = `
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
                <div id="text" class="tab-pane active"></div>
                <div id="image" class="tab-pane"><p>图片 API 配置。</p></div>
                <div id="voice" class="tab-pane"><p>语音 API 配置。</p></div>
            </div>
        </main>
    </div>
`;
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
                    <div class="form-group"><label for="api-name">名称</label><input type="text" id="api-name" placeholder="例如：My Key"></div>
                    
                    <!-- ▼▼▼ 修改点 ▼▼▼ -->
                    <div class="form-group"><label for="api-key">API Key</label><input type="password" id="api-key" placeholder="sk-..."></div>
                    <!-- ▲▲▲ 修改结束 ▲▲▲ -->

                    <div class="form-group"><label for="api-base-url">API Base URL</label><input type="text" id="api-base-url" value="https://api.openai.com"></div>
                    <div class="form-group" id="api-path-group"><label for="api-path">API 路径</label><input type="text" id="api-path" value="/v1/chat/completions"></div>
                </form>
            </div>
            <div class="modal-tab-content" id="image-panel-content"><p class="no-char-message">图片 API 配置 (待开发)</p></div>
            <div class="modal-tab-content" id="voice-panel-content"><p class="no-char-message">语音 API 配置 (待开发)</p></div>
        </div>
        <div class="sheet-footer">
            <button class="sheet-btn sheet-btn-cancel" id="cancel-panel-btn">取消</button>
            <button class="sheet-btn sheet-btn-confirm" id="add-api-btn">添加</button>
        </div>
    </div>
</div>
`;
const helpTooltipHtml = `
    <div id="help-tooltip" class="help-tooltip">
        <p>目前仅支持添加文本API，图片和语音待开发</p>
        <ol class="help-list">
            <li>右上羽毛笔添加API，可选OpenAI和Google，禁选Claude（拉取模型待开放）</li>
            <li>已添加的API卡片可切换启动/禁用状态</li>
            <li>点击API卡片跳转编辑页面，可拉取、搜索和多选模型</li>
            <li>长按卡片右侧三点图标可拖动卡片位置</li>
        </ol>
        <p class="help-reminder">拉取模型后记得右上保存嗷~</p>
    </div>
`;
const allModalsHtml = apiConfigPanelHtml + helpTooltipHtml;
const PROVIDER_CONFIG = {
    openai: { apiKeyPlaceholder: 'sk-...', baseUrlValue: 'https://api.openai.com', apiPathValue: '/v1/chat/completions', showApiPath: true },
    google: { apiKeyPlaceholder: 'AIzaSy...', baseUrlValue: 'https://generativelanguage.googleapis.com/v1beta', showApiPath: false },
    claude: { apiKeyPlaceholder: 'sk-ant-...', baseUrlValue: 'https://api.anthropic.com/v1', showApiPath: false }
};

let ui = {};

// ▼▼▼ 新增：保存 API 顺序的函数 ▼▼▼
async function saveApiOrder() {
    const container = document.getElementById('text');
    if (!container) return;
    const cards = container.querySelectorAll('.api-config-card');
    const orderedIds = Array.from(cards).map(card => card.dataset.id);
    await dbStorage.setItem(API_ORDER_KEY, orderedIds);
    console.log('API 卡片顺序已保存:', orderedIds);
}

// ▼▼▼ 新增：初始化拖拽功能的函数 ▼▼▼
function initializeDragAndDrop() {
    const container = document.getElementById('text');
    if (!container) return;

    Sortable.create(container, {
        handle: '.card-action-handle', // 指定三点图标为拖拽手柄
        animation: 150,
        delay: 200, // 长按 200ms 触发
        delayOnTouchOnly: true, // 仅在触摸设备上启用长按
        onEnd: saveApiOrder // 拖拽结束后调用保存函数
    });
    console.log('API 卡片拖拽功能已初始化。');
}

async function ensureDefaultConfigs() {
    const userConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    let configsChanged = false;

    DEFAULT_EDITABLE_APIS.forEach(defaultApi => {
        const exists = userConfigs.some(config => config.id === defaultApi.id);
        if (!exists) {
            userConfigs.push({
                ...defaultApi,
                apiKey: '',
                enabled: true,
                model: []
            });
            configsChanged = true;
        }
    });

    if (configsChanged) {
        await dbStorage.setItem(API_CONFIGS_KEY, userConfigs);
    }
}

// ▼▼▼ 修改：renderApiCards 函数，使其支持自定义排序 ▼▼▼
async function renderApiCards() {
    // 1. 获取所有数据源，包括我们保存的顺序
    const userConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    const builtInStates = await dbStorage.getItem(BUILT_IN_API_STATES_KEY) || {};
    const builtInUserData = await dbStorage.getItem(BUILT_IN_API_DATA_KEY) || {};
    const savedOrder = await dbStorage.getItem(API_ORDER_KEY) || [];

    // 2. 整合所有 API 配置
    const processedBuiltInApis = BUILT_IN_APIS.map(api => {
        const userData = builtInUserData[api.id] || {};
        const stateData = builtInStates[api.id] || {};
        return { ...api, ...userData, enabled: stateData.enabled ?? false };
    });
    let allConfigs = [...userConfigs, ...processedBuiltInApis];

    // 3. 根据保存的顺序对 allConfigs 进行排序
    if (savedOrder.length > 0) {
        const orderMap = new Map(savedOrder.map((id, index) => [id, index]));
        allConfigs.sort((a, b) => {
            const indexA = orderMap.get(String(a.id));
            const indexB = orderMap.get(String(b.id));
            if (indexA !== undefined && indexB !== undefined) return indexA - indexB; // 都在排序列表中
            if (indexA !== undefined) return -1; // a 在，b 不在，a 靠前
            if (indexB !== undefined) return 1;  // b 在，a 不在，b 靠前
            return 0; // 都不在 (例如新添加的)，保持原相对顺序
        });
    }

    // 4. 渲染卡片 (现在是按照排序后的顺序)
    const container = document.getElementById('text');
    if (!container) return;

    if (allConfigs.length === 0) {
        container.innerHTML = '<p>这里是【文本】的主配置，还没有添加任何 API。</p>';
    } else {
        container.innerHTML = allConfigs.map(config => {
            const providerInitial = config.isBuiltIn 
                ? config.shortName 
                : (({ openai: 'OA', google: 'Ge', claude: 'Cl' })[config.provider] || '?');
            
            const providerClass = config.isBuiltIn ? 'provider-built-in' : `provider-${config.provider}`;
            const providerIcon = `<div class="provider-icon ${providerClass}">${providerInitial}</div>`;

            const enabledClass = config.enabled ? '' : 'disabled';
            const statusCapsule = config.enabled 
                ? '<span class="status-capsule status-enabled">启用</span>' 
                : '<span class="status-capsule status-disabled">禁用</span>';
            
            const modelCapsule = `<span class="status-capsule status-model">${(config.model?.length || 0)}个模型</span>`;
            
            // 修改：给三点图标加上 title 提示
            const actionHandle = `<div class="card-action-handle" title="长按拖拽排序"><i class="fa-solid fa-ellipsis-vertical"></i></div>`;
            const builtInCardClass = config.isBuiltIn ? 'built-in-card' : '';

            return `
                <div class="api-config-card ${enabledClass} ${builtInCardClass}" data-id="${config.id}">
                    <div class="card-info">
                        ${providerIcon}
                        <span class="card-name">${config.name}</span>
                    </div>
                    <div class="card-right-content">
                        <div class="card-capsules">${modelCapsule}${statusCapsule}</div>
                        ${actionHandle}
                    </div>
                </div>
            `;
        }).join('');
    }
}
// ▲▲▲ 修改结束 ▲▲▲

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
async function handleAddApi() {
    const provider = document.querySelector('.pill-option.active').dataset.provider;
    const name = document.getElementById('api-name').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
    const baseUrl = document.getElementById('api-base-url').value.trim();
    const path = document.getElementById('api-path').value.trim();
    if (!name) {
    alert('“名称”不能为空！');
    return;
}
    const newConfig = {
        id: Date.now(), provider, name, apiKey, baseUrl,
        path: PROVIDER_CONFIG[provider].showApiPath ? path : null,
        enabled: true, model: []
    };
    const existingConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    existingConfigs.push(newConfig);
    await dbStorage.setItem(API_CONFIGS_KEY, existingConfigs);
    
    // ▼▼▼ 新增：添加新API后，也更新顺序列表 ▼▼▼
    const savedOrder = await dbStorage.getItem(API_ORDER_KEY) || [];
    savedOrder.push(String(newConfig.id)); // 将新ID添加到顺序末尾
    await dbStorage.setItem(API_ORDER_KEY, savedOrder);
    // ▲▲▲ 新增结束 ▲▲▲

    await renderApiCards();
    closeApiConfigPanel();
}
async function handleToggleStatus(apiId) {
    const isBuiltIn = apiId.startsWith('built-in-');
    if (isBuiltIn) {
        const builtInStates = await dbStorage.getItem(BUILT_IN_API_STATES_KEY) || {};
        const currentState = builtInStates[apiId]?.enabled ?? false;
        builtInStates[apiId] = { enabled: !currentState };
        await dbStorage.setItem(BUILT_IN_API_STATES_KEY, builtInStates);
    } else {
        const configs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
        const configIndex = configs.findIndex(c => c.id == apiId);
        if (configIndex > -1) {
            configs[configIndex].enabled = !configs[configIndex].enabled;
            await dbStorage.setItem(API_CONFIGS_KEY, configs);
        }
    }
    await renderApiCards();
}

async function initializePage() {
    await ensureDefaultConfigs();

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
    if (ui.overlay) { ui.overlay.addEventListener('click', (event) => { if (event.target === ui.overlay) closeApiConfigPanel(); }); }
    if (ui.panelTabsContainer) { ui.panelTabsContainer.addEventListener('click', (event) => { if (event.target.classList.contains('modal-tab')) switchPanelTab(event.target.dataset.tab); }); }
    if (ui.panelContentContainer) { ui.panelContentContainer.addEventListener('click', (event) => { if (event.target.matches('.pill-option')) { const clickedPill = event.target; clickedPill.parentElement.querySelectorAll('.pill-option').forEach(pill => pill.classList.remove('active')); clickedPill.classList.add('active'); updateFormForProvider(clickedPill.dataset.provider); } }); }
    
    // ▼▼▼ 新增点：为API Key输入框添加事件监听 ▼▼▼
    if (ui.apiKeyInput) {
        ui.apiKeyInput.addEventListener('focus', function() {
            this.type = 'text';
        });
        ui.apiKeyInput.addEventListener('blur', function() {
            if (this.value) {
                this.type = 'password';
            }
        });
    }
    // ▲▲▲ 新增结束 ▲▲▲

    const textTabPane = document.getElementById('text');
    if (textTabPane) {
        textTabPane.addEventListener('click', (event) => {
            const card = event.target.closest('.api-config-card');
            if (!card) return;

            // 如果点击的是三点图标，则不执行任何操作，把事件留给 SortableJS 处理
            if (event.target.closest('.card-action-handle')) {
                 return;
            }

            const apiId = card.dataset.id;
            const target = event.target;
            if (target.closest('.status-enabled') || target.closest('.status-disabled')) {
                handleToggleStatus(apiId);
            } else {
                if (apiId.startsWith('built-in-')) {
                    window.location.href = `./api-room-builtin.html?id=${apiId}`;
                } else {
                    window.location.href = `./api-room.html?id=${apiId}`;
                }
            }
        });
    }
    
    await renderApiCards();
    
    // ▼▼▼ 新增：在所有卡片渲染完成后，初始化拖拽功能 ▼▼▼
    initializeDragAndDrop();
}

createPageLayout({
    title: '牵引仪',
    contentHtml: apiManagementPageContent,
    modalsHtml: allModalsHtml,
    onFeatherClick: openApiConfigPanel,
    onPageLoad: initializePage 
});