// api-management.js

import { createPageLayout } from '../common/template.js';
import { dbStorage } from '../common/db.js';

// 数据库键
const API_CONFIGS_KEY = 'api_configs_text';
const BUILT_IN_API_STATES_KEY = 'built_in_api_states';
const BUILT_IN_API_DATA_KEY = 'built_in_api_data';

let isMultiSelectMode = false;

// ... (页面 HTML 和模态框 HTML 定义保持不变) ...
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
                <div id="image" class="tab-pane"><p>图片 API 配置区。</p></div>
                <div id="voice" class="tab-pane"><p>语音 API 配置区。</p></div>
            </div>
        </main>
    </div>
    <div id="multi-select-footer" class="multi-select-footer">
        <button class="footer-btn" id="cancel-multi-select">取消</button>
        <button class="footer-btn btn-delete" id="delete-selected-btn" disabled>删除</button>
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
                    <div class="form-group"><label for="api-key">API Key</label><input type="text" id="api-key" placeholder="sk-..."></div>
                    <div class="form-group"><label for="api-base-url">API Base URL</label><input type="text" id="api-base-url" value="https://api.openai.com"></div>
                    <div class="form-group" id="api-path-group"><label for="api-path">API 路径</label><input type="text" id="api-path" value="/v1/chat/completions"></div>
                </form>
            </div>
            <div class="modal-tab-content" id="image-panel-content"><p class="no-char-message">图片 API 配置区 (待开发)</p></div>
            <div class="modal-tab-content" id="voice-panel-content"><p class="no-char-message">语音 API 配置区 (待开发)</p></div>
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
            <li>单击三点图标可多选删除，或在编辑页面右上删除</li>
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

// ▼▼▼ 新增：定义两个“默认”的可编辑卡片配置 ▼▼▼
const DEFAULT_EDITABLE_APIS = [
    { 
        id: 'default-openai', // 使用一个固定的、特殊的ID
        provider: 'openai', 
        name: 'OpenAI', 
        apiKey: '', 
        baseUrl: 'https://api.openai.com', 
        path: '/v1/chat/completions',
        enabled: true, 
        model: [] 
    },
    { 
        id: 'default-google', // 使用一个固定的、特殊的ID
        provider: 'google', 
        name: 'Google', 
        apiKey: '', 
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta', 
        path: null,
        enabled: true, 
        model: [] 
    }
];

const BUILT_IN_APIS = [
    { id: 'built-in-deepseek', name: 'DeepSeek', shortName: 'DS', isBuiltIn: true },
    { id: 'built-in-siliconflow', name: '硅基流动', shortName: '硅', isBuiltIn: true },
    { id: 'built-in-openrouter', name: 'OpenRouter', shortName: 'OR', isBuiltIn: true },
];

let ui = {};

// ▼▼▼ 新增：检查并创建默认可编辑卡片的函数 ▼▼▼
/**
 * 确保默认的可编辑 API 配置存在于数据库中。
 * 如果不存在，则创建它们。
 */
async function ensureDefaultConfigs() {
    const userConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    let configsChanged = false;

    // 检查每一个我们定义的默认API
    DEFAULT_EDITABLE_APIS.forEach(defaultApi => {
        // 通过我们设定的特殊ID来查找
        const exists = userConfigs.some(config => config.id === defaultApi.id);
        if (!exists) {
            // 如果数据库里没有，就把它加进去
            userConfigs.push(defaultApi);
            configsChanged = true;
        }
    });

    // 如果我们添加了新的默认配置，就把更新后的整个列表存回数据库
    if (configsChanged) {
        await dbStorage.setItem(API_CONFIGS_KEY, userConfigs);
    }
}

async function renderApiCards() {
    // 1. 获取所有数据（这个逻辑不变）
    const userConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    const builtInStates = await dbStorage.getItem(BUILT_IN_API_STATES_KEY) || {};
    const builtInUserData = await dbStorage.getItem(BUILT_IN_API_DATA_KEY) || {};

    // 2. 合并只读的内置API数据（这个逻辑不变）
    const processedBuiltInApis = BUILT_IN_APIS.map(api => {
        const userData = builtInUserData[api.id] || {};
        const stateData = builtInStates[api.id] || {};
        return { ...api, ...userData, enabled: stateData.enabled ?? false };
    });

    // 3. 将用户卡片（现在已经包含了我们的默认卡片）和只读卡片合并
    const allConfigs = [...userConfigs, ...processedBuiltInApis];

    const container = document.getElementById('text');
    if (!container) return;

    if (allConfigs.length === 0) {
        container.innerHTML = '<p>这里是【文本】的主配置区，还没有添加任何 API。</p>';
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
            
            const actionHandle = `<div class="card-action-handle"><i class="fa-solid fa-ellipsis-vertical"></i></div>`;
            const checkboxWrapper = `<div class="card-checkbox-wrapper"><div class="custom-checkbox"></div></div>`;
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
                        ${checkboxWrapper}
                    </div>
                </div>
            `;
        }).join('');
    }
}

// ... (handleAddApi, handleToggleStatus 等其他函数保持不变) ...
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
async function saveCardOrder() {
    const cardElements = document.querySelectorAll('#text .api-config-card');
    const newOrderIds = Array.from(cardElements).map(card => card.dataset.id);
    const userApiOrderIds = newOrderIds.filter(id => !id.startsWith('built-in-'));
    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
    const configMap = new Map(allConfigs.map(c => [String(c.id), c]));
    const newSortedConfigs = userApiOrderIds.map(id => configMap.get(id)).filter(Boolean);
    await dbStorage.setItem(API_CONFIGS_KEY, newSortedConfigs);
}
function enterMultiSelectMode(clickedCard) {
    isMultiSelectMode = true;
    document.body.classList.add('multi-select-active');
    if (clickedCard) {
        clickedCard.classList.add('card-selected');
    }
    updateMultiSelectFooter();
}
function exitMultiSelectMode() {
    isMultiSelectMode = false;
    document.body.classList.remove('multi-select-active');
    document.querySelectorAll('.api-config-card.card-selected').forEach(card => {
        card.classList.remove('card-selected');
    });
}
function updateMultiSelectFooter() {
    const selectedCount = document.querySelectorAll('.api-config-card.card-selected').length;
    const deleteBtn = document.getElementById('delete-selected-btn');
    if (deleteBtn) {
        if (selectedCount > 0) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = `删除 (${selectedCount})`;
        } else {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '删除';
        }
    }
}
async function handleBulkDelete() {
    const selectedCards = document.querySelectorAll('.api-config-card.card-selected');
    if (selectedCards.length === 0) return;
    const selectedIds = Array.from(selectedCards).map(card => card.dataset.id);
    const selectedBuiltInApis = selectedIds
        .map(id => BUILT_IN_APIS.find(api => api.id === id))
        .filter(Boolean);
    if (selectedBuiltInApis.length > 0) {
        const names = selectedBuiltInApis.map(api => `“${api.name}”`).join('、');
        alert(`内置API卡片 ${names} 无法删除，请取消勾选，试着勾选自定义添加的API卡片吧`);
        return;
    }
    if (confirm(`确定要删除这 ${selectedIds.length} 个配置吗？`)) {
        const idsToDelete = new Set(selectedIds);
        let configs = await dbStorage.getItem(API_CONFIGS_KEY) || [];
        const updatedConfigs = configs.filter(config => !idsToDelete.has(String(config.id)));
        await dbStorage.setItem(API_CONFIGS_KEY, updatedConfigs);
        await renderApiCards();
        exitMultiSelectMode();
    }
}

async function initializePage() {
    // ▼▼▼ 关键一步：在页面加载时，首先确保我们的默认卡片已存在 ▼▼▼
    await ensureDefaultConfigs();

    // --- Tab 切换逻辑 (不变) ---
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

    const textTabPane = document.getElementById('text');
    if (textTabPane) {
        let longPressTimer;
        let draggedElement = null;
        let isDragging = false;
        let hasMovedSincePress = false;

        textTabPane.addEventListener('click', (event) => {
            if (isDragging) return;
            const card = event.target.closest('.api-config-card');
            if (!card) return;
            if (isMultiSelectMode) {
                card.classList.toggle('card-selected');
                updateMultiSelectFooter();
            } else {
                const apiId = card.dataset.id;
                const target = event.target;
                if (target.closest('.card-action-handle')) {
                    enterMultiSelectMode(card);
                } else if (target.closest('.status-enabled') || target.closest('.status-disabled')) {
                    handleToggleStatus(apiId);
                } else {
                    // ★★★ 这个判断逻辑现在完美兼容所有情况 ★★★
                    if (apiId.startsWith('built-in-')) {
                        window.location.href = `./api-room-builtin.html?id=${apiId}`;
                    } else {
                        // 我们的'default-openai'和'default-google'会走这里
                        window.location.href = `./api-room.html?id=${apiId}`;
                    }
                }
            }
        });

        // ... (拖拽逻辑 pressStartHandler, pressMoveHandler, pressEndHandler 保持不变) ...
        const pressStartHandler = (event) => {
            const handle = event.target.closest('.card-action-handle');
            if (!handle || isMultiSelectMode || (event.button && event.button !== 0)) return;
            hasMovedSincePress = false;
            draggedElement = handle.closest('.api-config-card');
            longPressTimer = setTimeout(() => {
                if (hasMovedSincePress) return;
                isDragging = true;
                draggedElement.classList.add('dragging');
                document.body.classList.add('user-select-none');
            }, 300);
            document.addEventListener('mousemove', pressMoveHandler);
            document.addEventListener('touchmove', pressMoveHandler, { passive: false });
            document.addEventListener('mouseup', pressEndHandler, { once: true });
            document.addEventListener('touchend', pressEndHandler, { once: true });
        };
        const pressMoveHandler = (event) => {
            hasMovedSincePress = true;
            if (isDragging) {
                event.preventDefault();
                const currentY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY;
                const targetCard = document.elementFromPoint(
                    event.type === 'touchmove' ? event.touches[0].clientX : event.clientX,
                    currentY
                )?.closest('.api-config-card');
                if (targetCard && targetCard !== draggedElement) {
                    const rect = targetCard.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    textTabPane.insertBefore(draggedElement, currentY < midpoint ? targetCard : targetCard.nextSibling);
                }
            }
        };
        const pressEndHandler = () => {
            clearTimeout(longPressTimer);
            document.removeEventListener('mousemove', pressMoveHandler);
            document.removeEventListener('touchmove', pressMoveHandler);
            if (isDragging) {
                draggedElement.classList.remove('dragging');
                document.body.classList.remove('user-select-none');
                saveCardOrder();
                setTimeout(() => { isDragging = false; }, 0);
            }
            draggedElement = null;
        };
        textTabPane.addEventListener('mousedown', pressStartHandler);
        textTabPane.addEventListener('touchstart', pressStartHandler, { passive: false });
        document.getElementById('cancel-multi-select').addEventListener('click', exitMultiSelectMode);
        document.getElementById('delete-selected-btn').addEventListener('click', handleBulkDelete);
    }
    
    await renderApiCards();
}

createPageLayout({
    title: '配置',
    contentHtml: apiManagementPageContent,
    modalsHtml: allModalsHtml,
    onFeatherClick: openApiConfigPanel,
    onPageLoad: initializePage 
});