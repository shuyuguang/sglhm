// profile.js (基本无需改动)

document.addEventListener('DOMContentLoaded', () => {

    // ====================【主控制逻辑】====================
    const uiSwitchBtn = document.getElementById('ui-switch-btn');
    const ydnWrapper = document.getElementById('ydn-ui-wrapper');
    const ydmWrapper = document.getElementById('ydm-ui-wrapper');

    let sharedEventsBound = false;

    const UI_PREFERENCE_KEY = 'profileUiPreference';
    let preferredUi = localStorage.getItem(UI_PREFERENCE_KEY) || 'YDN'; // 默认 YDN

    window.isYdnActive = (preferredUi === 'YDN');
    let ydnAppInitialized = false;
    let ydmAppInitialized = false;

    // 封装一个函数来更新UI，避免代码重复
    function updateUI(isYdn) {
        window.isYdnActive = isYdn;
        if (isYdn) {
            ydmWrapper.style.display = 'none';
            ydnWrapper.style.display = 'block';
            document.title = "羁绊司";
            localStorage.setItem(UI_PREFERENCE_KEY, 'YDN');
            if (!ydnAppInitialized) {
                initYdnApp();
            }
        } else {
            ydnWrapper.style.display = 'none';
            ydmWrapper.style.display = 'flex'; // YDM uses flex display
            document.title = "羁绊司";
            localStorage.setItem(UI_PREFERENCE_KEY, 'YDM');
            if (!ydmAppInitialized) {
                initYdmApp();
            }
        }
    }

    // UI 切换事件
    uiSwitchBtn.addEventListener('click', () => {
        updateUI(!window.isYdnActive); // 切换到相反的状态并更新
    });

    // ====================【获取所有共享的 DOM 元素】====================
    function getSharedDOMElements() {
        return {
            // ▼▼▼ 新增开始 ▼▼▼
            globalHelpBtn: document.getElementById('global-help-btn'),
            globalHelpTooltip: document.getElementById('global-help-tooltip'),
            // ▲▲▲ 新增结束 ▲▲▲

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
            switcherSettingsModal: document.getElementById('switcher-settings-modal-overlay'),
            settingsUserList: document.getElementById('settings-user-list'),
            settingsCloseBtn: document.getElementById('settings-close-btn'),
            settingsImportBtn: document.getElementById('settings-import-btn'),
            settingsExportBtn: document.getElementById('settings-export-btn'),
            settingsMultiSelectBtn: document.getElementById('settings-multi-select-btn'),
            settingsDeleteBtn: document.getElementById('settings-delete-btn'),
            editGenderTrigger: document.getElementById('edit-gender-trigger'),
            usernameLabel: document.getElementById('username-label'),
            switcherSettingsTitle: document.getElementById('switcher-settings-title'),
            
            // ▼▼▼ 新增开始 ▼▼▼
            addRelationshipBtn: document.getElementById('add-relationship-btn'),
            relationshipItemsContainer: document.getElementById('relationship-items-container'),
            characterSelectorOverlay: document.getElementById('character-selector-overlay'),
            cancelCharSelectorBtn: document.getElementById('cancel-char-selector-btn'),
            charSearchInput: document.getElementById('char-search-input'),
            charSelectorList: document.getElementById('char-selector-list'),
            confirmCharSelectionBtn: document.getElementById('confirm-char-selection-btn'),
            relationshipTypeOverlay: document.getElementById('relationship-type-overlay'),
            cancelRelTypeBtn: document.getElementById('cancel-rel-type-btn'),
            relationshipTypeOptions: document.getElementById('relationship-type-options'),
            confirmRelTypeBtn: document.getElementById('confirm-rel-type-btn'),
            // ▲▲▲ 新增结束 ▲▲▲
        };
    }

    // ====================【UI 1: YDN App 初始化】====================
    function initYdnApp() {
        if (ydnAppInitialized) return;
        console.log("Initializing YDN App...");

        const sharedElements = getSharedDOMElements();
        const ydnElements = {
            ...sharedElements,
            switcherPage: document.getElementById('switcher-page'),
            profileViewPage: document.getElementById('profile-view-page'),
            switcherGridList: document.getElementById('switcher-grid-list'),
            switcherAddBtn: document.getElementById('switcher-add-btn'),
            switcherSettingsBtn: document.getElementById('switcher-settings-btn-ydn'),
            backToSwitcherBtn: document.getElementById('back-to-switcher-btn'),
            tabButtons: ydnWrapper.querySelectorAll('.tab-button'),
            tabPanes: ydnWrapper.querySelectorAll('.tab-pane'),
            editFabButton: document.getElementById('edit-profile-btn-ydn'),
            homeBioContent: document.getElementById('home-bio-content-ydn'),
            modeToggleBtn: document.getElementById('mode-toggle-btn-ydn'),
            characterBannerImg: document.getElementById('character-banner-img-ydn'),
            profileAvatarImg: document.getElementById('profile-avatar-img-ydn'),
            userNameEl: document.getElementById('user-name-ydn'),
            genderSymbolEl: document.getElementById('gender-symbol-ydn'),
            showSwitcherPage: () => { ydnElements.profileViewPage?.classList.add('hidden'); ydnElements.switcherPage?.classList.remove('hidden'); renderSwitcherGrid(); },
            showProfilePage: () => { ydnElements.switcherPage?.classList.add('hidden'); ydnElements.profileViewPage?.classList.remove('hidden'); }
        };

        function renderSwitcherGrid() { /* ... */ }

        const manager = createProfileManager({
            elements: ydnElements,
            uiStyle: 'YDN',
            renderSwitcher: renderSwitcherGrid,
            onProfileSave: () => {}
        });
        
        // ... (The rest of the YDN and YDM init functions remain the same)
        // The logic inside them for event binding and initialization is correct.
        // I've omitted the rest for brevity as it's identical to your original file.

        function renderSwitcherGrid() {
            if (!ydnElements.switcherGridList) return;
            ydnElements.switcherGridList.innerHTML = '';
            const profileData = manager.getProfileData();
            profileData.forEach(profile => {
                const item = document.createElement('div');
                item.className = 'switcher-profile-item';
                item.dataset.profileId = profile.id;
                item.innerHTML = `<img src="${profile.avatar}" alt="${profile.name}" class="avatar"><span class="name">${profile.name || '未命名'}</span>`;
                item.addEventListener('click', async () => { await manager.loadProfileData(profile.id); ydnElements.showProfilePage(); });
                ydnElements.switcherGridList.appendChild(item);
            });
        }

        if (!sharedEventsBound) {
            manager.bindSharedEvents();
            sharedEventsBound = true;
        }
        manager.bindUiSpecificEvents();

        ydnElements.backToSwitcherBtn?.addEventListener('click', ydnElements.showSwitcherPage);
        ydnElements.switcherAddBtn?.addEventListener('click', () => manager.addNewProfile());
        ydnElements.switcherSettingsBtn?.addEventListener('click', () => manager.openSwitcherSettingsModal());
        if (ydnElements.switcherGridList) {
            new Sortable(ydnElements.switcherGridList, {
                animation: 150,
                ghostClass: 'avatar-sortable-ghost',
                delay: 200, delayOnTouchOnly: true,
                onEnd: (evt) => {
                    const newOrderedIds = Array.from(ydnElements.switcherGridList.children).map(item => item.dataset.profileId);
                    let profileData = manager.getProfileData();
                    const profileMap = new Map(profileData.map(p => [p.id, p]));
                    const newProfileData = newOrderedIds.map(id => profileMap.get(id)).filter(Boolean);
                    manager.setProfileData(newProfileData);
                }
            });
        }

        manager.initializeApp();
        ydnAppInitialized = true;
    }

    // ====================【UI 2: YDM App 初始化】====================
    function initYdmApp() {
        if (ydmAppInitialized) return;
        console.log("Initializing YDM App...");

        const sharedElements = getSharedDOMElements();
        const ydmElements = {
            ...sharedElements,
            switcherPanel: document.getElementById('profile-switcher-panel'),
            switcherList: document.getElementById('switcher-list'),
            settingsBtn: document.getElementById('settings-btn-ydm'),
            createNewUserBtn: document.getElementById('create-new-user-btn'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
            modeToggleBtn: document.getElementById('mode-toggle-btn-ydm'),
            tabButtons: ydmWrapper.querySelectorAll('.tab-button'),
            tabPanes: ydmWrapper.querySelectorAll('.tab-pane'),
            editFabButton: document.getElementById('edit-profile-btn-ydm'),
            homeBioContent: document.getElementById('home-bio-content-ydm'),
            characterBannerImg: document.getElementById('character-banner-img-ydm'),
            profileAvatarImg: document.getElementById('profile-avatar-img-ydm'),
            userNameEl: document.getElementById('user-name-ydm'),
            genderSymbolEl: document.getElementById('gender-symbol-ydm'),
        };

        function renderSwitcherList() { /* ... */ }
        function updateSwitcherActiveState() { /* ... */ }
        function onProfileSaveCallback(savedProfile) { /* ... */ }

        const manager = createProfileManager({
            elements: ydmElements,
            uiStyle: 'YDM',
            renderSwitcher: renderSwitcherList,
            onProfileSave: onProfileSaveCallback
        });

        function renderSwitcherList() {
            if (!ydmElements.switcherList) return;
            ydmElements.switcherList.innerHTML = '';
            const profileData = manager.getProfileData();
            profileData.forEach(profile => {
                const li = document.createElement('li');
                li.dataset.profileId = profile.id;
                li.innerHTML = `<img src="${profile.avatar}" alt="${profile.name}" class="switcher-avatar" title="${profile.name || '未命名'}">`;
                ydmElements.switcherList.appendChild(li);
            });
            updateSwitcherActiveState();
        }
        
        function updateSwitcherActiveState() {
            const currentProfileId = document.getElementById('user-name-ydm').closest('.main-container').dataset.currentProfileId;
            ydmElements.switcherList?.querySelectorAll('li').forEach(item => {
                item.classList.toggle('active', item.dataset.profileId === currentProfileId);
            });
        }

        function onProfileSaveCallback(savedProfile) {
            const switcherAvatar = ydmElements.switcherList?.querySelector(`li[data-profile-id="${savedProfile.id}"] .switcher-avatar`);
            if (switcherAvatar) switcherAvatar.src = savedProfile.avatar;
        }

        if (!sharedEventsBound) {
            manager.bindSharedEvents();
            sharedEventsBound = true;
        }
        manager.bindUiSpecificEvents();

        ydmElements.settingsBtn?.addEventListener('click', () => manager.openSwitcherSettingsModal());
        ydmElements.createNewUserBtn?.addEventListener('click', () => manager.addNewProfile());
        ydmElements.sidebarToggleBtn?.addEventListener('click', () => {
             ydmElements.switcherPanel?.classList.toggle('collapsed');
        });
        ydmElements.switcherList?.addEventListener('click', (event) => {
             const targetLi = event.target.closest('li[data-profile-id]');
             const currentProfileId = document.getElementById('user-name-ydm').closest('.main-container').dataset.currentProfileId;
             if (targetLi && targetLi.dataset.profileId !== currentProfileId) {
                 manager.loadProfileData(targetLi.dataset.profileId);
             }
        });
        if (ydmElements.switcherList) {
            new Sortable(ydmElements.switcherList, {
                animation: 150,
                ghostClass: 'avatar-sortable-ghost',
                delay: 200, delayOnTouchOnly: true,
                onEnd: () => {
                    const newOrderedIds = Array.from(ydmElements.switcherList.children).map(li => li.dataset.profileId);
                    let profileData = manager.getProfileData();
                    const profileMap = new Map(profileData.map(p => [p.id, p]));
                    const newProfileData = newOrderedIds.map(id => profileMap.get(id)).filter(Boolean);
                    manager.setProfileData(newProfileData);
                }
            });
        }

        manager.initializeApp();
        ydmAppInitialized = true;
    }

    // --- 启动 App ---
    updateUI(window.isYdnActive);
});