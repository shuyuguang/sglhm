// relia-chat/chat-editor-bridge.js

import { GENDER_OPTIONS, LONG_PRESS_DURATION } from '../config/profile.config.js';
import { createUiManager } from '../profile/profile.ui.js';
import { createEventManager } from '../profile/profile.events.js';

/**
 * 创建一个功能完整的角色档案编辑器实例，复用 Profile 页面的 UI 和 Event 模块。
 * @param {object} initialProfile - 要编辑的初始角色对象。
 * @param {function} onSaveCallback - 保存成功后执行的回调，传入更新后的 profile 对象。
 * @param {string} [prefix=''] - DOM元素ID的前缀，用于区分多个编辑器实例。
 * @returns {object} 包含 open 和 updateProfile 方法的对象。
 */
export function createChatEditor(initialProfile, onSaveCallback, prefix = '') {
    // 1. --- 状态管理 (模拟 profile.manager.js 中的 state) ---
    const state = {
        profileData: [initialProfile],
        currentProfileId: initialProfile.id,
        // ▼▼▼ 修改：根据传入的profile和prefix决定模式 ▼▼▼
        currentMode: prefix === 'user-' ? 'YOU' : 'TA',
        // ▲▲▲ 修改结束 ▲▲▲
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
    // ▼▼▼ 修改：整个函数现在使用prefix动态获取元素 ▼▼▼
    function getEditorDOMElements() {
        const getEl = (id) => document.getElementById(`${prefix}${id}`);
        const queryEl = (selector) => document.querySelector(`#${prefix}${selector}`);

        return {
            modalOverlay: getEl('edit-modal-overlay'),
            closeModalButton: getEl('close-modal-btn'),
            saveButton: getEl('save-btn'),
            helpButton: getEl('help-btn'),
            helpTooltip: getEl('help-tooltip'),
            modalSidebar: queryEl('edit-modal-overlay .modal-sidebar'),
            modalMainContent: queryEl('edit-modal-overlay .modal-main-content'),
            addSectionBtn: getEl('add-section-btn'),
            namePromptOverlay: getEl('name-prompt-overlay'),
            namePromptTitle: queryEl('name-prompt-overlay h4'),
            newSectionNameInput: getEl('new-section-name-input'),
            confirmPromptBtn: getEl('confirm-prompt-btn'),
            cancelPromptBtn: getEl('cancel-prompt-btn'),
            sidebarNavList: queryEl('edit-modal-overlay .sidebar-nav-list'),
            avatarUrlInput: getEl('edit-avatar-url'),
            bannerUrlInput: getEl('edit-banner-url'),
            avatarPreviewImg: getEl('avatar-preview-img'),
            bannerPreviewImg: getEl('banner-preview-img'),
            avatarUploadInput: getEl('avatar-upload-input'),
            bannerUploadInput: getEl('banner-upload-input'),
            cropperOverlay: getEl('cropper-overlay'),
            cropperImage: getEl('cropper-image'),
            confirmCropBtn: getEl('confirm-crop-btn'),
            cancelCropBtn: getEl('cancel-crop-btn'),
            customSectionOptionsOverlay: getEl('custom-section-options-overlay'),
            customSectionOptionsSheet: getEl('custom-section-options-sheet'),
            cancelOptionsSheetBtn: getEl('cancel-options-sheet-btn'),
            addSectionSheetOverlay: getEl('add-section-sheet-overlay'),
            presetTagsContainer: getEl('preset-tags-container'),
            cancelAddSheetBtn: getEl('cancel-add-sheet-btn'),
            subEditorPanel: getEl('sub-editor-panel'),
            sepTitle: getEl('sep-title'),
            sepTextarea: getEl('sep-textarea'),
            sepBackBtn: getEl('sep-back-btn'),
            sepSaveBtn: getEl('sep-save-btn'),
            editAgeTrigger: getEl('edit-age-trigger'),
            editBioTrigger: getEl('edit-bio-trigger'),
            editRaceTrigger: getEl('edit-race-trigger'),
            editOccupationTrigger: getEl('edit-occupation-trigger'),
            itemEditorPanel: getEl('item-editor-panel'),
            itemEditorTitleHeader: getEl('item-editor-title-header'),
            itemEditorTitleInput: getEl('item-editor-title-input'),
            itemEditorValueTextarea: getEl('item-editor-value-textarea'),
            itemEditorBackBtn: getEl('item-editor-back-btn'),
            itemEditorSaveBtn: getEl('item-editor-save-btn'),
            editGenderTrigger: getEl('edit-gender-trigger'),
            relationshipItemsContainer: getEl('relationship-items-container'),
            addRelationshipBtn: getEl('add-relationship-btn'),
        };
    }
    // ▲▲▲ 修改结束 ▲▲▲
    const elements = getEditorDOMElements();

    // 3. --- 创建一个轻量级的 Data Manager ---
    const dataManager = {
        saveCurrentProfile: () => {
            const getDisplayValue = (trigger) => {
                if (!trigger) return '';
                const display = trigger.querySelector('.value-display');
                return (!display || display.classList.contains('placeholder')) ? '' : display.textContent.trim();
            };
            
            const updatedProfile = { ...state.profileData[0] };
            // ▼▼▼ 修改：使用带前缀的ID获取输入框 ▼▼▼
            updatedProfile.name = document.getElementById(`${prefix}edit-username`)?.value || '';
            // ▲▲▲ 修改结束 ▲▲▲
            updatedProfile.avatar = elements.avatarUrlInput.value;
            updatedProfile.banner = elements.bannerUrlInput.value;
            updatedProfile.gender = elements.editGenderTrigger.querySelector('.value-display').textContent;
            updatedProfile.age = getDisplayValue(elements.editAgeTrigger);
            updatedProfile.race = getDisplayValue(elements.editRaceTrigger);
            updatedProfile.occupation = getDisplayValue(elements.editOccupationTrigger);
            updatedProfile.bio = getDisplayValue(elements.editBioTrigger);
            updatedProfile.customSections = Array.from(elements.modalMainContent.querySelectorAll(`.modal-section-pane[id^="${prefix}modal-section-custom-"]`))
                .map(pane => ({
                    title: pane.querySelector('.pane-title-capsule')?.textContent,
                    items: Array.from(pane.querySelectorAll('.custom-item-group')).map(itemEl => ({
                        title: itemEl.querySelector('label')?.textContent,
                        value: itemEl.querySelector('.value-display:not(.placeholder)')?.textContent || ''
                    }))
                }));
            
            state.profileData = [updatedProfile];
            if (typeof onSaveCallback === 'function') {
                onSaveCallback(updatedProfile);
            }
            ui.closeModal();
        },
        dbStorage: {
            setItem: async (key, value) => { console.log(`[ChatEditor] Mock DB set: ${key}`, value); },
            getItem: async (key) => { console.log(`[ChatEditor] Mock DB get: ${key}`); return null; }
        }
    };

    // 4. --- 实例化并绑定 UI 和 Event 模块 ---
    const ui = createUiManager(elements, state, { GENDER_OPTIONS });
    const events = createEventManager(elements, state, ui, dataManager, { LONG_PRESS_DURATION, GENDER_OPTIONS });
    
    events.bindSharedEvents();

    // 5. --- 核心控制函数 ---
    const open = () => {
        const profile = state.profileData[0];
        if (!profile) return;

        // ▼▼▼ 修改：根据前缀动态查找和禁用关系栏 ▼▼▼
        const relSection = document.getElementById(`${prefix}modal-section-relationship`);
        const relNav = document.querySelector(`[data-target="${prefix}modal-section-relationship"]`);
        if(relSection) relSection.style.display = 'none';
        if(relNav) relNav.style.display = 'none';
        // ▲▲▲ 修改结束 ▲▲▲
        
        ui.updateEditModalValues(profile);
        elements.modalMainContent.querySelectorAll(`.modal-section-pane[id^="${prefix}modal-section-custom-"]`).forEach(p => p.remove());
        elements.sidebarNavList.querySelectorAll('.modal-nav-button:not(.fixed-nav-button)').forEach(b => b.remove());
        profile.customSections?.forEach(sectionData => {
            const newPane = ui.createNewSection(sectionData.title, false);
            sectionData.items?.forEach(itemData => ui.createAndAppendCustomItem(newPane, itemData.title, itemData.value));
        });
        
        elements.sidebarNavList.querySelector('.modal-nav-button')?.click();
        
        ui.openModal();
    };

    const updateProfile = (newProfile) => {
        state.profileData = [JSON.parse(JSON.stringify(newProfile))];
        state.currentProfileId = newProfile.id;
    };

    return { open, updateProfile };
}