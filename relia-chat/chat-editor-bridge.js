// relia-chat/chat-editor-bridge.js

import { GENDER_OPTIONS, LONG_PRESS_DURATION } from '../config/profile.config.js';
import { createUiManager } from '../profile/profile.ui.js';
import { createEventManager } from '../profile/profile.events.js';

/**
 * 创建一个功能完整的角色档案编辑器实例，复用 Profile 页面的 UI 和 Event 模块。
 * @param {object} initialProfile - 要编辑的初始角色对象。
 * @param {function} onSaveCallback - 保存成功后执行的回调，传入更新后的 profile 对象。
 * @returns {object} 包含 open 和 updateProfile 方法的对象。
 */
export function createChatEditor(initialProfile, onSaveCallback) {
    // 1. --- 状态管理 (模拟 profile.manager.js 中的 state) ---
    const state = {
        profileData: [initialProfile],
        currentProfileId: initialProfile.id,
        currentMode: 'TA', // 在聊天室里编辑的永远是'TA'
        uiStyle: 'MODAL',  // 自定义一个模式名，避免触发YDN/YDM特定逻辑
        presetContentStore: {}, // 预设功能也需要这个
        // 以下是事件模块需要的状态，提供默认值
        activeCustomPane: null,
        currentPromptAction: null,
        elementBeingEdited: null,
        longPressTimer: null,
        isLongPress: false,
        currentSaveCallback: null,
        currentItemEditingContext: {},
        croppingContext: {},
    };

    // 2. --- 获取所有需要的 DOM 元素 ---
    // 这个函数从 profile.js 复制而来，确保获取到所有面板元素
    function getEditorDOMElements() {
        return {
            modalOverlay: document.getElementById('edit-modal-overlay'),
            closeModalButton: document.getElementById('close-modal-btn'),
            saveButton: document.getElementById('save-btn'),
            helpButton: document.getElementById('help-btn'),
            helpTooltip: document.getElementById('help-tooltip'),
            modalSidebar: document.querySelector('.modal-sidebar'),
            modalMainContent: document.querySelector('.modal-main-content'),
            addSectionBtn: document.getElementById('add-section-btn'),
            namePromptOverlay: document.getElementById('name-prompt-overlay'),
            namePromptTitle: document.querySelector('#name-prompt-overlay h4'),
            newSectionNameInput: document.getElementById('new-section-name-input'),
            confirmPromptBtn: document.getElementById('confirm-prompt-btn'),
            cancelPromptBtn: document.getElementById('cancel-prompt-btn'),
            sidebarNavList: document.querySelector('.sidebar-nav-list'),
            avatarUrlInput: document.getElementById('edit-avatar-url'),
            bannerUrlInput: document.getElementById('edit-banner-url'),
            avatarPreviewImg: document.getElementById('avatar-preview-img'),
            bannerPreviewImg: document.getElementById('banner-preview-img'),
            avatarUploadInput: document.getElementById('avatar-upload-input'),
            bannerUploadInput: document.getElementById('banner-upload-input'),
            cropperOverlay: document.getElementById('cropper-overlay'),
            cropperImage: document.getElementById('cropper-image'),
            confirmCropBtn: document.getElementById('confirm-crop-btn'),
            cancelCropBtn: document.getElementById('cancel-crop-btn'),
            customSectionOptionsOverlay: document.getElementById('custom-section-options-overlay'),
            customSectionOptionsSheet: document.getElementById('custom-section-options-sheet'),
            cancelOptionsSheetBtn: document.getElementById('cancel-options-sheet-btn'),
            addSectionSheetOverlay: document.getElementById('add-section-sheet-overlay'),
            presetTagsContainer: document.getElementById('preset-tags-container'),
            cancelAddSheetBtn: document.getElementById('cancel-add-sheet-btn'),
            subEditorPanel: document.getElementById('sub-editor-panel'),
            sepTitle: document.getElementById('sep-title'),
            sepTextarea: document.getElementById('sep-textarea'),
            sepBackBtn: document.getElementById('sep-back-btn'),
            sepSaveBtn: document.getElementById('sep-save-btn'),
            editAgeTrigger: document.getElementById('edit-age-trigger'),
            editBioTrigger: document.getElementById('edit-bio-trigger'),
            editRaceTrigger: document.getElementById('edit-race-trigger'),
            editOccupationTrigger: document.getElementById('edit-occupation-trigger'),
            itemEditorPanel: document.getElementById('item-editor-panel'),
            itemEditorTitleHeader: document.getElementById('item-editor-title-header'),
            itemEditorTitleInput: document.getElementById('item-editor-title-input'),
            itemEditorValueTextarea: document.getElementById('item-editor-value-textarea'),
            itemEditorBackBtn: document.getElementById('item-editor-back-btn'),
            itemEditorSaveBtn: document.getElementById('item-editor-save-btn'),
            editGenderTrigger: document.getElementById('edit-gender-trigger'),
            // 关系部分在聊天室中不使用，但为了防止报错，可以传入 null
            relationshipItemsContainer: document.getElementById('relationship-items-container'),
            addRelationshipBtn: document.getElementById('add-relationship-btn'),
        };
    }
    const elements = getEditorDOMElements();

    // 3. --- 创建一个轻量级的 Data Manager ---
    // 我们只需要它的 saveCurrentProfile 方法的逻辑
    const dataManager = {
        saveCurrentProfile: () => {
            const getDisplayValue = (trigger) => {
                if (!trigger) return '';
                const display = trigger.querySelector('.value-display');
                return (!display || display.classList.contains('placeholder')) ? '' : display.textContent.trim();
            };
            
            const updatedProfile = { ...state.profileData[0] }; // 基于当前profile更新
            updatedProfile.name = document.getElementById('edit-username')?.value || '';
            updatedProfile.avatar = elements.avatarUrlInput.value;
            updatedProfile.banner = elements.bannerUrlInput.value;
            updatedProfile.gender = elements.editGenderTrigger.querySelector('.value-display').textContent;
            updatedProfile.age = getDisplayValue(elements.editAgeTrigger);
            updatedProfile.race = getDisplayValue(elements.editRaceTrigger);
            updatedProfile.occupation = getDisplayValue(elements.editOccupationTrigger);
            updatedProfile.bio = getDisplayValue(elements.editBioTrigger);
            updatedProfile.customSections = Array.from(elements.modalMainContent.querySelectorAll('.modal-section-pane[id^="modal-section-custom-"]'))
                .map(pane => ({
                    title: pane.querySelector('.pane-title-capsule')?.textContent,
                    items: Array.from(pane.querySelectorAll('.custom-item-group')).map(itemEl => ({
                        title: itemEl.querySelector('label')?.textContent,
                        value: itemEl.querySelector('.value-display:not(.placeholder)')?.textContent || ''
                    }))
                }));
            
            // 更新内部状态并调用外部回调
            state.profileData = [updatedProfile];
            if (typeof onSaveCallback === 'function') {
                onSaveCallback(updatedProfile);
            }
            ui.closeModal();
        },
        // 提供一个空的 dbStorage 对象，以防事件模块中某些功能（如预设）尝试调用它
        dbStorage: {
            setItem: async (key, value) => { console.log(`[ChatEditor] Mock DB set: ${key}`, value); },
            getItem: async (key) => { console.log(`[ChatEditor] Mock DB get: ${key}`); return null; }
        }
    };

    // 4. --- 实例化并绑定 UI 和 Event 模块 ---
    const ui = createUiManager(elements, state, { GENDER_OPTIONS });
    const events = createEventManager(elements, state, ui, dataManager, { LONG_PRESS_DURATION, GENDER_OPTIONS });
    
    // 手动绑定一次共享事件
    events.bindSharedEvents();

    // 5. --- 核心控制函数 ---
    const open = () => {
        const profile = state.profileData[0];
        if (!profile) return;

        // 禁用关系栏
        const relSection = document.getElementById('modal-section-relationship');
        const relNav = document.querySelector('[data-target="modal-section-relationship"]');
        if(relSection) relSection.style.display = 'none';
        if(relNav) relNav.style.display = 'none';
        
        // 加载数据到UI
        ui.updateEditModalValues(profile);
        elements.modalMainContent.querySelectorAll('.modal-section-pane[id^="modal-section-custom-"]').forEach(p => p.remove());
        elements.sidebarNavList.querySelectorAll('.modal-nav-button:not(.fixed-nav-button)').forEach(b => b.remove());
        profile.customSections?.forEach(sectionData => {
            const newPane = ui.createNewSection(sectionData.title, false);
            sectionData.items?.forEach(itemData => ui.createAndAppendCustomItem(newPane, itemData.title, itemData.value));
        });
        
        // 默认选中第一个tab
        elements.sidebarNavList.querySelector('.modal-nav-button')?.click();
        
        ui.openModal();
    };

    const updateProfile = (newProfile) => {
        state.profileData = [JSON.parse(JSON.stringify(newProfile))];
        state.currentProfileId = newProfile.id;
    };

    // 6. --- 暴露公共接口 ---
    return { open, updateProfile };
}