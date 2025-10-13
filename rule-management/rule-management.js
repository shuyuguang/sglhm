// rule-management.js

// 1. 在模块顶部导入需要的函数
import { createPageLayout } from '../common/template.js';
import { dbStorage } from '../common/db.js';
import { RULE_DB_KEYS } from '../config/rule.config.js';

// ... (ruleManagementPageContent 和 ruleModalHtml 变量保持不变) ...
const ruleManagementPageContent = `
    <!-- Tab 导航栏 -->
    <nav class="tabs-nav">
        <div class="tabs-container">
            <button class="tab-button active" data-tab="chat">心语低鸣</button>
            <button class="tab-button" data-tab="reading">万象交响</button>
            <button class="tab-button" data-tab="diary">岁月画卷</button>
        </div>
    </nav>
    <div class="active-tab-indicator"></div>
    <div class="main-container">
        <main class="content-body">
            <div class="tabs-content">
                <div id="chat" class="tab-pane active">
                    <div class="capsule-nav">
                        <button class="capsule-button active" data-sub-tab="sub-chat-short">短聊体</button>
                        <button class="capsule-button" data-sub-tab="sub-chat-dialogue">对话体</button>
                        <button class="capsule-button" data-sub-tab="sub-chat-novel">小说体</button>
                        <button class="capsule-button" data-sub-tab="sub-chat-rpg">文游体</button>
                    </div>
                    <div class="capsule-content">
                        <div id="sub-chat-short" class="capsule-pane active">
                            <div class="rule-cards-container"></div>
                            <p class="no-rules-placeholder">暂无规则，点击右上角羽毛笔添加。</p>
                        </div>
                        <div id="sub-chat-dialogue" class="capsule-pane">
                            <div class="rule-cards-container"></div>
                            <p class="no-rules-placeholder">暂无规则，点击右上角羽毛笔添加。</p>
                        </div>
                        <div id="sub-chat-novel" class="capsule-pane">
                            <div class="rule-cards-container"></div>
                            <p class="no-rules-placeholder">暂无规则，点击右上角羽毛笔添加。</p>
                        </div>
                        <div id="sub-chat-rpg" class="capsule-pane">
                            <div class="rule-cards-container"></div>
                            <p class="no-rules-placeholder">暂无规则，点击右上角羽毛笔添加。</p>
                        </div>
                    </div>
                </div>
                <div id="reading" class="tab-pane">
                    <p>这里是【万象交响】规则的设置区。</p>
                </div>
                <div id="diary" class="tab-pane">
                    <p>这里是【岁月画卷】规则的设置区。</p>
                </div>
            </div>
        </main>
    </div>
`;
const ruleModalHtml = `
<div class="modal-overlay" id="rule-config-overlay">
    <div class="modal-panel" id="rule-config-panel">
        <div class="modal-tabs">
            <button class="modal-tab active" data-tab="chat-panel">心语低鸣</button>
            <button class="modal-tab" data-tab="reading-panel">万象交响</button>
            <button class="modal-tab" data-tab="diary-panel">岁月画卷</button>
        </div>
        <div class="modal-content-container">
            <div class="modal-tab-content active" id="chat-panel-content">
                <div class="pill-options-container">
                    <button class="pill-option active" data-sub-rule="short">短聊</button>
                    <button class="pill-option" data-sub-rule="dialogue">对话</button>
                    <button class="pill-option" data-sub-rule="novel">小说</button>
                    <button class="pill-option" data-sub-rule="rpg">文游</button>
                </div>
                <form class="api-form-container" id="rule-form">
                    <div class="form-group">
                        <label for="rule-title">标题</label>
                        <input type="text" id="rule-title" placeholder="为这条规则起个名字">
                    </div>
                    <div class="form-group">
                        <label for="rule-content">内容</label>
                        <textarea id="rule-content" rows="8" placeholder="在此输入具体的规则描述..."></textarea>
                    </div>
                    <div class="form-group injection-position-group">
                        <label>注入位置</label>
                        <div class="radio-options-container">
                            <div class="radio-option">
                                <input type="radio" id="inject-before" name="injection-position" value="before" checked>
                                <label for="inject-before">前</label>
                            </div>
                            <div class="radio-option">
                                <input type="radio" id="inject-after" name="injection-position" value="after">
                                <label for="inject-after">后</label>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-tab-content" id="reading-panel-content">
                <p class="no-char-message">万象交响规则配置 (待开发)</p>
            </div>
            <div class="modal-tab-content" id="diary-panel-content">
                <p class="no-char-message">岁月画卷规则配置 (待开发)</p>
            </div>
        </div>
        <div class="sheet-footer">
            <button class="sheet-btn sheet-btn-delete" id="delete-rule-panel-btn" style="display: none;">删除规则</button>
            <button class="sheet-btn sheet-btn-cancel" id="cancel-rule-panel-btn">取消</button>
            <button class="sheet-btn sheet-btn-confirm" id="save-rule-btn">保存规则</button>
        </div>
    </div>
</div>
`;

let ui = {};
let currentlyEditingCard = null;

async function saveRulesToDB() {
    const allRules = { short: [], dialogue: [], novel: [], rpg: [] };
    for (const type in allRules) {
        const pane = document.getElementById(`sub-chat-${type}`);
        if (pane) {
            const cards = pane.querySelectorAll('.rule-card');
            cards.forEach(card => {
                allRules[type].push({
                    type: card.dataset.type,
                    title: card.dataset.title,
                    content: card.dataset.content,
                    position: card.dataset.position,
                });
            });
        }
    }
    await dbStorage.setItem(RULE_DB_KEYS.RULES_DATA, allRules);
    console.log('规则已更新并保存至数据库:', allRules);
}

async function loadRulesFromDB() {
    const savedRules = await dbStorage.getItem(RULE_DB_KEYS.RULES_DATA);
    if (!savedRules) return;
    Object.keys(savedRules).forEach(type => {
        const rulesForType = savedRules[type];
        const container = document.querySelector(`#sub-chat-${type} .rule-cards-container`);
        if (container && Array.isArray(rulesForType)) {
            rulesForType.forEach(ruleData => {
                const card = createRuleCard(ruleData);
                container.appendChild(card);
            });
        }
    });
    document.querySelectorAll('.capsule-pane').forEach(updatePlaceholderVisibility);
}

// ▼▼▼ 新增：初始化拖拽功能的函数 ▼▼▼
function initializeDragAndDrop() {
    const containers = document.querySelectorAll('.rule-cards-container');
    containers.forEach(container => {
        Sortable.create(container, {
            handle: '.drag-handle', // 指定哪个元素是拖拽手柄
            animation: 150, // 拖拽动画的毫秒数
            delay: 200, // 长按200毫秒后才能开始拖拽
            delayOnTouchOnly: true, // 仅在触摸设备上启用长按延迟
            onEnd: saveRulesToDB // 拖拽结束后，自动调用保存函数
        });
    });
    console.log('拖拽功能已在所有规则容器上初始化。');
}
// ▲▲▲ 新增结束 ▲▲▲

function openRuleModal() {
    if (!ui.overlay) return;
    ui.saveBtn.textContent = '新建规则';
    ui.deleteBtn.style.display = 'none';
    const activeMainTab = document.querySelector('.tab-button.active');
    if (activeMainTab) {
        const targetPanelId = `${activeMainTab.dataset.tab}-panel`;
        switchModalTab(targetPanelId);
        if (activeMainTab.dataset.tab === 'chat') {
            const activeCapsuleOnPage = document.querySelector('#chat .capsule-button.active');
            if (activeCapsuleOnPage) {
                const subTabId = activeCapsuleOnPage.dataset.subTab;
                const targetSubRule = subTabId.replace('sub-chat-', '');
                const pillsInModal = ui.modalContentContainer.querySelectorAll('.pill-option');
                pillsInModal.forEach(pill => pill.classList.remove('active'));
                const targetPill = ui.modalContentContainer.querySelector(`.pill-option[data-sub-rule="${targetSubRule}"]`);
                if (targetPill) targetPill.classList.add('active');
            }
        }
    }
    ui.overlay.classList.add('active');
}

function closeRuleModal() {
    if (!ui.overlay) return;
    ui.overlay.classList.remove('active');
    if (ui.ruleForm) ui.ruleForm.reset();
    if (ui.modalContentContainer) {
        const pills = ui.modalContentContainer.querySelectorAll('.pill-option');
        pills.forEach((pill, index) => {
            pill.classList.toggle('active', index === 0);
            pill.disabled = false;
        });
    }
    currentlyEditingCard = null;
    ui.saveBtn.textContent = '保存规则';
}

function switchModalTab(targetTabId) {
    if (!ui.modalTabs) return;
    ui.modalTabs.forEach(tab => tab.classList.remove('active'));
    ui.modalTabContents.forEach(content => content.classList.remove('active'));
    const targetTab = document.querySelector(`.modal-tab[data-tab="${targetTabId}"]`);
    const targetContent = document.getElementById(`${targetTabId}-content`);
    if (targetTab && targetContent) {
        targetTab.classList.add('active');
        targetContent.classList.add('active');
    }
}

// ▼▼▼ 修改：createRuleCard 函数，添加拖拽手柄 ▼▼▼
function createRuleCard(ruleData) {
    const card = document.createElement('div');
    card.className = 'rule-card';
    card.dataset.type = ruleData.type;
    card.dataset.title = ruleData.title;
    card.dataset.content = ruleData.content;
    card.dataset.position = ruleData.position;
    const iconClass = ruleData.position === 'before' ? 'fa-circle-arrow-up' : 'fa-circle-arrow-down';
    const arrowColorClass = `arrow-${ruleData.position}`;
    card.innerHTML = `
        <div class="rule-card-header">
            <div class="rule-card-title-group">
                <i class="fas ${iconClass} rule-card-arrow ${arrowColorClass}"></i>
                <span class="rule-card-title-text">${ruleData.title}</span>
            </div>
            <div class="rule-card-header-actions">
                <!-- 新增：拖拽手柄 -->
                <button class="card-action-btn drag-handle" title="长按拖拽排序">
                    <i class="fas fa-ellipsis-vertical"></i>
                </button>
                <button class="card-action-btn" title="编辑"><i class="fas fa-pencil-alt"></i></button>
                <button class="rule-card-toggle" aria-label="展开/折叠规则">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        </div>
        <div class="rule-card-body-wrapper">
            <div class="rule-card-body">
                <div class="rule-card-content">
                    <p>${ruleData.content}</p>
                </div>
            </div>
        </div>
    `;
    return card;
}
// ▲▲▲ 修改结束 ▲▲▲

function updateRuleCard(card, newData) {
    card.dataset.title = newData.title;
    card.dataset.content = newData.content;
    card.dataset.position = newData.position;
    card.querySelector('.rule-card-title-text').textContent = newData.title;
    card.querySelector('.rule-card-content p').textContent = newData.content;
    const arrowIcon = card.querySelector('.rule-card-arrow');
    const oldIcon = newData.position === 'before' ? 'fa-circle-arrow-down' : 'fa-circle-arrow-up';
    const newIcon = newData.position === 'before' ? 'fa-circle-arrow-up' : 'fa-circle-arrow-down';
    const oldColor = `arrow-${newData.position === 'before' ? 'after' : 'before'}`;
    const newColor = `arrow-${newData.position}`;
    arrowIcon.classList.remove(oldIcon, oldColor);
    arrowIcon.classList.add(newIcon, newColor);
}

function updatePlaceholderVisibility(paneElement) {
    if (!paneElement) return;
    const container = paneElement.querySelector('.rule-cards-container');
    const placeholder = paneElement.querySelector('.no-rules-placeholder');
    if (container && placeholder) {
        const hasCards = container.children.length > 0;
        placeholder.style.display = hasCards ? 'none' : 'block';
    }
}

async function handleDeleteCard(cardElement) {
    if (!cardElement) return false;
    if (confirm('确定要删除这条规则吗？')) {
        const pane = cardElement.closest('.capsule-pane');
        cardElement.remove();
        updatePlaceholderVisibility(pane);
        await saveRulesToDB();
        return true;
    }
    return false;
}

async function handleSaveRule() {
    const title = document.getElementById('rule-title').value.trim();
    const content = document.getElementById('rule-content').value.trim();
    const injectionPosition = document.querySelector('input[name="injection-position"]:checked').value;
    if (!title || !content) {
        alert('标题和内容均不能为空！');
        return;
    }
    if (currentlyEditingCard) {
        const updatedRuleData = {
            type: currentlyEditingCard.dataset.type,
            title,
            position: injectionPosition,
            content
        };
        updateRuleCard(currentlyEditingCard, updatedRuleData);
    } else {
        const activePill = ui.modalContentContainer.querySelector('.pill-option.active');
        const subRuleType = activePill ? activePill.dataset.subRule : null;
        if (!subRuleType) {
            alert('规则类型不能为空！');
            return;
        }
        const newRuleData = { type: subRuleType, title, position: injectionPosition, content };
        const newCard = createRuleCard(newRuleData);
        const targetPane = document.getElementById(`sub-chat-${subRuleType}`);
        if (targetPane) {
            const cardsContainer = targetPane.querySelector('.rule-cards-container');
            cardsContainer.appendChild(newCard);
            updatePlaceholderVisibility(targetPane);
        }
    }
    await saveRulesToDB();
    closeRuleModal();
}

async function initializePage() {
    console.log("底律谷页面JS加载，拖拽排序功能已启动。");

    const indicator = document.querySelector('.active-tab-indicator');
    const tabsNav = document.querySelector('.tabs-nav');
    function updateIndicatorPosition() {
        const activeButton = document.querySelector('.tab-button.active');
        if (!indicator || !activeButton || !tabsNav) {
            if (indicator) indicator.style.opacity = '0';
            return;
        }
        const buttonRect = activeButton.getBoundingClientRect();
        const buttonCenter = buttonRect.left + buttonRect.width / 2;
        const indicatorLeft = buttonCenter - (indicator.offsetWidth / 2);
        indicator.style.left = `${indicatorLeft}px`;
        indicator.style.opacity = '1';
        const tabsNavRect = tabsNav.getBoundingClientRect();
        indicator.style.top = `${tabsNavRect.top + tabsNav.offsetHeight - indicator.offsetHeight / 2 - 4}px`;
        indicator.style.position = 'fixed';
    }

    document.body.addEventListener('click', function (event) {
        // ▼▼▼ 修改：确保点击拖拽手柄时不会触发卡片展开/折叠 ▼▼▼
        const toggleButton = event.target.closest('.rule-card-toggle, .rule-card-header');
        if (toggleButton && !event.target.closest('.card-action-btn')) {
            const card = toggleButton.closest('.rule-card');
            if (card) card.classList.toggle('expanded');
            return;
        }
        // ▲▲▲ 修改结束 ▲▲▲

        if (event.target.matches('.tab-button')) {
            const clickedButton = event.target;
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            clickedButton.classList.add('active');
            const targetPane = document.getElementById(clickedButton.dataset.tab);
            if (targetPane) targetPane.classList.add('active');
            updateIndicatorPosition();
            return;
        }
        if (event.target.matches('.capsule-button')) {
            const clickedCapsule = event.target;
            const targetId = clickedCapsule.dataset.subTab;
            clickedCapsule.parentElement.querySelectorAll('.capsule-button').forEach(btn => btn.classList.remove('active'));
            clickedCapsule.classList.add('active');
            const contentContainer = clickedCapsule.closest('.tab-pane').querySelector('.capsule-content');
            if (contentContainer) {
                contentContainer.querySelectorAll('.capsule-pane').forEach(pane => pane.classList.remove('active'));
                const targetPane = document.getElementById(targetId);
                if (targetPane) {
                    targetPane.classList.add('active');
                    updatePlaceholderVisibility(targetPane);
                }
            }
            return;
        }

        const actionButton = event.target.closest('.card-action-btn');
        if (!actionButton || actionButton.classList.contains('drag-handle')) return; // 如果是拖拽手柄，则不执行后续操作
        
        const card = actionButton.closest('.rule-card');
        if (actionButton.querySelector('.fa-pencil-alt')) {
            currentlyEditingCard = card;
            ui.saveBtn.textContent = '更新规则';
            ui.deleteBtn.style.display = 'block';
            document.getElementById('rule-title').value = card.dataset.title;
            document.getElementById('rule-content').value = card.dataset.content;
            document.querySelector(`input[name="injection-position"][value="${card.dataset.position}"]`).checked = true;
            const pills = ui.modalContentContainer.querySelectorAll('.pill-option');
            pills.forEach(pill => {
                pill.classList.remove('active');
                if (pill.dataset.subRule === card.dataset.type) pill.classList.add('active');
                pill.disabled = true;
            });
            ui.overlay.classList.add('active');
        }
    });

    ui = {
        overlay: document.getElementById('rule-config-overlay'),
        panel: document.getElementById('rule-config-panel'),
        cancelBtn: document.getElementById('cancel-rule-panel-btn'),
        saveBtn: document.getElementById('save-rule-btn'),
        deleteBtn: document.getElementById('delete-rule-panel-btn'),
        modalTabsContainer: document.querySelector('#rule-config-panel .modal-tabs'),
        modalTabs: document.querySelectorAll('#rule-config-panel .modal-tab'),
        modalTabContents: document.querySelectorAll('#rule-config-panel .modal-tab-content'),
        modalContentContainer: document.querySelector('#rule-config-panel .modal-content-container'),
        ruleForm: document.getElementById('rule-form')
    };

    if (ui.cancelBtn) ui.cancelBtn.addEventListener('click', closeRuleModal);
    if (ui.saveBtn) ui.saveBtn.addEventListener('click', handleSaveRule);
    if (ui.deleteBtn) {
        ui.deleteBtn.addEventListener('click', async () => {
            if (currentlyEditingCard) {
                if (await handleDeleteCard(currentlyEditingCard)) {
                    closeRuleModal();
                }
            }
        });
    }
    if (ui.overlay) { ui.overlay.addEventListener('click', (event) => { if (event.target === ui.overlay) closeRuleModal(); }); }
    if (ui.modalTabsContainer) { ui.modalTabsContainer.addEventListener('click', (event) => { if (event.target.classList.contains('modal-tab')) switchModalTab(event.target.dataset.tab); }); }
    if (ui.modalContentContainer) {
        ui.modalContentContainer.addEventListener('click', (event) => {
            if (event.target.matches('.pill-option')) {
                const clickedPill = event.target;
                clickedPill.parentElement.querySelectorAll('.pill-option').forEach(pill => pill.classList.remove('active'));
                clickedPill.classList.add('active');
            }
        });
    }

    document.querySelectorAll('.capsule-pane').forEach(updatePlaceholderVisibility);
    requestAnimationFrame(updateIndicatorPosition);
    window.addEventListener('scroll', updateIndicatorPosition, { passive: true });
    window.addEventListener('resize', updateIndicatorPosition);

    await loadRulesFromDB();

    // ▼▼▼ 修改：在页面加载和渲染完所有卡片后，初始化拖拽功能 ▼▼▼
    initializeDragAndDrop();
}

const handleRuleManagementFeatherClick = () => {
    openRuleModal();
};

createPageLayout({
    title: '底律谷',
    contentHtml: ruleManagementPageContent,
    modalsHtml: ruleModalHtml,
    onFeatherClick: handleRuleManagementFeatherClick,
    onPageLoad: initializePage
});