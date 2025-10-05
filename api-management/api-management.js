// api-management.js

import { createPageLayout } from '../common/template.js';
import { dbStorage } from '../common/db.js'; // ▼▼▼ 1. 导入我们的 dbStorage ▼▼▼

// 使用数据库的 Key，用于存储和读取 API 配置
const API_CONFIGS_KEY = 'api_configs_text';
let isMultiSelectMode = false; // 全局状态，跟踪是否处于多选模式

// 1. 定义页面的专属 HTML 内容
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
                <div id="image" class="tab-pane"><p>图片 API 配置区。</p></div>
                <div id="voice" class="tab-pane"><p>语音 API 配置区。</p></div>
            </div>
        </main>
    </div>
    <!-- 多选模式下的操作栏，默认隐藏 -->
    <div id="multi-select-footer" class="multi-select-footer">
        <button class="footer-btn" id="cancel-multi-select">取消</button>
        <button class="footer-btn btn-delete" id="delete-selected-btn" disabled>删除</button>
    </div>
`;

// 2. 定义模态框面板的 HTML 结构
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

// 定义本页专属的帮助框 HTML 内容
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

// 将所有模态框/浮层 HTML 合并成一个字符串
const allModalsHtml = apiConfigPanelHtml + helpTooltipHtml;

// 3. 服务商配置数据
const PROVIDER_CONFIG = {
    openai: { apiKeyPlaceholder: 'sk-...', baseUrlValue: 'https://api.openai.com', apiPathValue: '/v1/chat/completions', showApiPath: true },
    google: { apiKeyPlaceholder: 'AIzaSy...', baseUrlValue: 'https://generativelanguage.googleapis.com/v1beta', showApiPath: false },
    claude: { apiKeyPlaceholder: 'sk-ant-...', baseUrlValue: 'https://api.anthropic.com/v1', showApiPath: false }
};

let ui = {};

// 4. 功能函数区
// ▼▼▼ 2. 所有读写操作都变成 async/await ▼▼▼
async function renderApiCards() {
    const configs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
    const container = document.getElementById('text');
    if (!container) return;

    if (configs.length === 0) {
        container.innerHTML = '<p>这里是【文本】的主配置区，还没有添加任何 API。</p>';
    } else {
        container.innerHTML = configs.map(config => {
            const providerMap = { openai: 'OA', google: 'Ge', claude: 'Cl' };
            const providerInitial = providerMap[config.provider] || '?';
            const providerIcon = `<div class="provider-icon provider-${config.provider}">${providerInitial}</div>`;
            const enabledClass = config.enabled ? '' : 'disabled';
            const statusCapsule = config.enabled 
                ? '<span class="status-capsule status-enabled">启用</span>' 
                : '<span class="status-capsule status-disabled">禁用</span>';
            const modelCount = (config.model && config.model.length) ? config.model.length : 0;
            const modelCapsule = `<span class="status-capsule status-model">${modelCount}个模型</span>`;
            const actionHandle = `<div class="card-action-handle"><i class="fa-solid fa-ellipsis-vertical"></i></div>`;
            const checkboxWrapper = `<div class="card-checkbox-wrapper"><div class="custom-checkbox"></div></div>`;
            return `
                <div class="api-config-card ${enabledClass}" data-id="${config.id}">
                    <div class="card-info">
                        ${providerIcon}
                        <span class="card-name">${config.name}</span>
                    </div>
                    <div class="card-right-content">
                        <div class="card-capsules">
                            ${modelCapsule}
                            ${statusCapsule}
                        </div>
                        ${actionHandle}
                        ${checkboxWrapper}
                    </div>
                </div>
            `;
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

async function handleAddApi() {
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
        enabled: true, model: []
    };
    const existingConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
    existingConfigs.push(newConfig);
    await dbStorage.setItem(API_CONFIGS_KEY, existingConfigs); // 写入 Dexie
    await renderApiCards();
    closeApiConfigPanel();
}

async function handleToggleStatus(apiId) {
    const configs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
    const configIndex = configs.findIndex(c => c.id == apiId);
    if (configIndex > -1) {
        configs[configIndex].enabled = !configs[configIndex].enabled;
        await dbStorage.setItem(API_CONFIGS_KEY, configs); // 写入 Dexie
        await renderApiCards();
    }
}

async function saveCardOrder() {
    const cardElements = document.querySelectorAll('#text .api-config-card');
    const newOrderIds = Array.from(cardElements).map(card => card.dataset.id);
    const allConfigs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
    const configMap = new Map(allConfigs.map(c => [String(c.id), c]));
    const newSortedConfigs = newOrderIds.map(id => configMap.get(id)).filter(Boolean);
    await dbStorage.setItem(API_CONFIGS_KEY, newSortedConfigs); // 写入 Dexie
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
    if (confirm(`确定要删除这 ${selectedCards.length} 个配置吗？`)) {
        const idsToDelete = new Set(Array.from(selectedCards).map(card => card.dataset.id));
        let configs = await dbStorage.getItem(API_CONFIGS_KEY) || []; // 从 Dexie 读取
        const updatedConfigs = configs.filter(config => !idsToDelete.has(String(config.id)));
        await dbStorage.setItem(API_CONFIGS_KEY, updatedConfigs); // 写入 Dexie
        await renderApiCards();
        exitMultiSelectMode();
    }
}

async function initializePage() { // 变为 async
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
    
    // --- UI 元素获取和模态框事件绑定 (不变) ---
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

    // ... (事件处理逻辑保持不变) ...
    const textTabPane = document.getElementById('text');
    if (textTabPane) {
        let longPressTimer;
        let draggedElement = null;
        let isDragging = false;
        let hasMovedSincePress = false;

        // 1. 统一的单击事件处理器
        textTabPane.addEventListener('click', (event) => {
            if (isDragging) {
                return;
            }

            const card = event.target.closest('.api-config-card');
            if (!card) return;

            if (isMultiSelectMode) {
                card.classList.toggle('card-selected');
                updateMultiSelectFooter();
            } else {
                const apiId = card.dataset.id;
                const target = event.target; // 获取实际点击的元素

                if (target.closest('.card-action-handle')) {
                    enterMultiSelectMode(card);
                } 
                // 修改：检查是否点击了带有 .status-enabled 或 .status-disabled 的元素
                else if (target.closest('.status-enabled') || target.closest('.status-disabled')) {
                    handleToggleStatus(apiId);
                } 
                else {
                    // 其他所有情况（包括点击模型胶囊）都视为跳转
                    window.location.href = `./api-room.html?id=${apiId}`;
                }
            }
        });

        // 2. 独立的拖拽事件处理器
        const pressStartHandler = (event) => {
            const handle = event.target.closest('.card-action-handle');
            // 拖拽必须由三点图标发起，且不能在多选模式下
            if (!handle || isMultiSelectMode || (event.button && event.button !== 0)) {
                return;
            }

            hasMovedSincePress = false;
            draggedElement = handle.closest('.api-config-card');

            // 启动长按计时器
            longPressTimer = setTimeout(() => {
                // 如果在计时期间已经移动了（判定为滚动），则不启动拖拽
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
            hasMovedSincePress = true; // 只要移动了就标记

            if (isDragging) {
                event.preventDefault(); // 只有在真正拖拽时才阻止滚动
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
                
                // 延迟重置 isDragging 状态，以确保后续的 click 事件被正确忽略
                setTimeout(() => {
                    isDragging = false;
                }, 0);
            }
            draggedElement = null;
        };

        textTabPane.addEventListener('mousedown', pressStartHandler);
        textTabPane.addEventListener('touchstart', pressStartHandler, { passive: false });

        document.getElementById('cancel-multi-select').addEventListener('click', exitMultiSelectMode);
        document.getElementById('delete-selected-btn').addEventListener('click', handleBulkDelete);
    }
    
    await renderApiCards(); // 等待初次渲染完成
}

// 脚本入口
createPageLayout({
    title: '配置',
    contentHtml: apiManagementPageContent,
    modalsHtml: allModalsHtml,
    onFeatherClick: openApiConfigPanel,
    onPageLoad: initializePage 
});