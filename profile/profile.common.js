// profile.common.js

function createProfileManager(config) {
    // 从配置中解构出UI元素和回调函数
    const { elements, uiStyle, renderSwitcher, onProfileSave } = config;

    // ====================【共享 DOM 元素】====================
    const {
        modalOverlay, closeModalButton, saveButton, helpButton, helpTooltip,
        modalSidebar, modalMainContent, addSectionBtn, namePromptOverlay, namePromptTitle,
        newSectionNameInput, confirmPromptBtn, cancelPromptBtn, sidebarNavList,
        avatarUrlInput, bannerUrlInput, avatarPreviewImg, bannerPreviewImg,
        avatarUploadInput, bannerUploadInput, cropperOverlay, cropperImage,

        confirmCropBtn, cancelCropBtn, customSectionOptionsOverlay, customSectionOptionsSheet,
        cancelOptionsSheetBtn, addSectionSheetOverlay, presetTagsContainer, cancelAddSheetBtn,
        subEditorPanel, sepTitle, sepTextarea, sepBackBtn, sepSaveBtn,
        editAgeTrigger, editBioTrigger, editRaceTrigger, editOccupationTrigger,
        itemEditorPanel, itemEditorTitleHeader, itemEditorTitleInput, itemEditorValueTextarea,
        itemEditorBackBtn, itemEditorSaveBtn, switcherSettingsModal, settingsUserList,
        settingsCloseBtn, settingsImportBtn, settingsExportBtn, settingsMultiSelectBtn,
        settingsDeleteBtn, editGenderTrigger, characterToggleSwitch, characterBannerImg,
        profileAvatarImg, userNameEl, genderSymbolEl, homeBioContent, usernameLabel,
        switcherSettingsTitle
    } = elements;

    // ====================【共享状态和变量】====================
    const db = new Dexie('userSettingsDB');
    db.version(1).stores({ keyValueStore: 'key' });
    const dbStorage = {
        async setItem(key, value) { try { await db.keyValueStore.put({ key, value: JSON.parse(JSON.stringify(value)) }); } catch (error) { console.error(`[dbStorage] Failed to set item '${key}':`, error); } },
        async getItem(key) { try { const item = await db.keyValueStore.get(key); return item ? item.value : null; } catch (error) { console.error(`[dbStorage] Failed to get item '${key}':`, error); return null; } }
    };

    let activeCustomPane = null, currentPromptAction = null, elementBeingEdited = null,
        longPressTimer, isLongPress = false, currentSaveCallback = null,
        currentItemEditingContext = { pane: null, item: null }, cropper = null,
        croppingContext = {}, selectedProfileIds = [], isMultiSelectMode = false;

    const LONG_PRESS_DURATION = 500, GENDER_OPTIONS = ['⚲（？）', '♀（女）', '♂（男）'];
    let profileData = [], presetContentStore = {}, currentProfileId = null, currentMode = 'YOU';

    // ====================【共享函数】====================
    const getDbKey = (baseKey) => {
        const prefix = currentMode === 'YOU' ? 'user' : 'char';
        const capitalizedBaseKey = baseKey.charAt(0).toUpperCase() + baseKey.slice(1);
        return `${prefix}${capitalizedBaseKey}`;
    };

    const getDefaultProfileId = () => currentMode === 'YOU' ? 'default-user-1' : 'default-char-1';

    function updateUiForMode() {
        const isYouMode = currentMode === 'YOU';
        const isYdn = uiStyle === 'YDN';

        const modeText = {
            docTitle: isYdn
                ? '设定集 - felotus'
                : (isYouMode ? '设定集 - felotus' : '设定集 - felotus'),
            settingsTitle: isYouMode ? '用户管理' : '角色管理',
            usernameLabel: isYouMode ? '用户名' : '角色名',
            bannerAlt: isYouMode ? '用户主图' : '角色主图',
            avatarAlt: isYouMode ? '用户头像' : '角色头像',
            bioPlaceholder: isYouMode ? '这里是用户的个人简介...' : '这里是角色的个人简介...'
        };

        // 根据当前激活的UI更新文档标题
        if ((isYdn && window.isYdnActive) || (!isYdn && !window.isYdnActive)) {
            document.title = modeText.docTitle;
        }

        if (switcherSettingsTitle) switcherSettingsTitle.textContent = modeText.settingsTitle;
        if (usernameLabel) usernameLabel.textContent = modeText.usernameLabel;
        if (characterBannerImg) characterBannerImg.alt = modeText.bannerAlt;
        if (profileAvatarImg) profileAvatarImg.alt = modeText.avatarAlt;

        const currentProfile = profileData.find(p => p.id === currentProfileId);
        if (homeBioContent && (!currentProfile || !currentProfile.bio)) {
            homeBioContent.textContent = modeText.bioPlaceholder;
        }

        if (elements.modeToggleBtn) elements.modeToggleBtn.textContent = currentMode;
        if (elements.characterToggleContainer) elements.characterToggleContainer.style.display = isYouMode ? 'none' : 'block';
        if (elements.createNewUserBtn) elements.createNewUserBtn.title = isYouMode ? '新建用户' : '新建角色';

        if (editGenderTrigger) {
            const icon = editGenderTrigger.querySelector('i');
            if (isYouMode) {
                editGenderTrigger.classList.add('locked');
                if (icon) icon.className = 'fa-solid fa-lock';
            } else {
                editGenderTrigger.classList.remove('locked');
                if (icon) icon.className = 'fa-solid fa-arrows-rotate';
            }
        }
    }

    async function loadProfileData(profileId) {
        if (!profileData || profileData.length === 0 || !profileData.find(p => p.id === profileId)) {
            console.warn("Profile data inconsistent or profileId not found. Re-initializing.");
            await initializeApp();
            return;
        }
        const profile = profileData.find(p => p.id === profileId);
        if (!profile) {
             console.error("Profile not found, returning to switcher.");
             if (typeof elements.showSwitcherPage === 'function') elements.showSwitcherPage();
             return;
        }

        currentProfileId = profileId;
        await dbStorage.setItem(getDbKey('currentProfileId'), currentProfileId);

        if (characterBannerImg) characterBannerImg.src = profile.banner;
        if (profileAvatarImg) profileAvatarImg.src = profile.avatar;
        if (userNameEl) userNameEl.textContent = profile.name || '未命名';
        if (genderSymbolEl) genderSymbolEl.textContent = profile.gender.charAt(0);

        const bioPlaceholder = currentMode === 'YOU' ? '这里是用户的个人简介...' : '这里是角色的个人简介...';
        if (homeBioContent) homeBioContent.textContent = profile.bio || bioPlaceholder;

        // 更新编辑模态框中的值
        if (avatarUrlInput) avatarUrlInput.value = profile.avatar;
        if (avatarPreviewImg) avatarPreviewImg.src = profile.avatar;
        if (bannerUrlInput) bannerUrlInput.value = profile.banner;
        if (bannerPreviewImg) bannerPreviewImg.src = profile.banner;

        const usernameInput = document.getElementById('edit-username');
        if (usernameInput) usernameInput.value = profile.name;

        if (editGenderTrigger) {
            const genderDisplay = editGenderTrigger.querySelector('.value-display');
            if (genderDisplay) {
                if (currentMode === 'YOU') {
                    genderDisplay.textContent = '♀（女）';
                } else {
                    genderDisplay.textContent = GENDER_OPTIONS.includes(profile.gender) ? profile.gender : GENDER_OPTIONS[1];
                }
            }
        }
        const updateDisplay = (trigger, value, placeholder) => {
            if (!trigger) return;
            const display = trigger.querySelector('.value-display');
            if (!display) return;
            display.setAttribute('data-placeholder', placeholder);
            display.textContent = value || placeholder;
            display.classList.toggle('placeholder', !value);
        };
        updateDisplay(editAgeTrigger, profile.age, '请填写年龄、生日或描述');
        updateDisplay(editRaceTrigger, profile.race, '请填写种族');
        updateDisplay(editOccupationTrigger, profile.occupation, '请填写职业');
        updateDisplay(editBioTrigger, profile.bio, '请填写简介');

        if (characterToggleSwitch) {
            characterToggleSwitch.checked = profile.isToggleOn || false;
        }
        
        // 调用UI特定的渲染/更新函数
        if (typeof renderSwitcher === 'function') {
            renderSwitcher();
        }
        renderProfileTab();
    }
    
    function renderSettingsUserList() {
        if (!settingsUserList) return;
        settingsUserList.innerHTML = '';
        profileData.forEach(profile => {
            const li = document.createElement('li');
            li.dataset.profileId = profile.id;
            if (profile.id === getDefaultProfileId()) li.classList.add('disabled');
            li.innerHTML = `<img src="${profile.avatar}" alt="${profile.name}" class="avatar"><span class="name">${profile.name || '未命名'}</span>`;
            settingsUserList.appendChild(li);
        });
    }

    function updateDeleteButtonState() {
        if (settingsDeleteBtn) settingsDeleteBtn.disabled = selectedProfileIds.length === 0;
    }

    function openSwitcherSettingsModal() {
        selectedProfileIds = [];
        isMultiSelectMode = false;
        settingsMultiSelectBtn?.classList.remove('active');
        renderSettingsUserList();
        updateDeleteButtonState();
        switcherSettingsModal?.classList.add('active');
    }

    function closeSwitcherSettingsModal() {
        switcherSettingsModal?.classList.remove('active');
        // YDN需要在关闭后重新渲染网格
        if (uiStyle === 'YDN' && typeof renderSwitcher === 'function') {
            renderSwitcher();
        }
    }

    async function addNewProfile() {
        const isYouMode = currentMode === 'YOU';
        const newProfile = {
            id: `${isYouMode ? 'user' : 'char'}-${Date.now()}`,
            name: '',
            gender: '♀（女）',
            bio: '', age: '', race: '', occupation: '',
            avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg',
            banner: 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg',
            isToggleOn: false
        };
        profileData.push(newProfile);
        await dbStorage.setItem(getDbKey('profileData'), profileData);
        
        if (uiStyle === 'YDN' && typeof elements.showProfilePage === 'function') {
            await loadProfileData(newProfile.id);
            elements.showProfilePage();
        } else {
            renderSwitcher();
            await loadProfileData(newProfile.id);
        }
    }

    function openModal() { modalOverlay?.classList.add('active'); }
    function closeModal() {
        helpTooltip?.classList.remove('active');
        closeSubEditor();
        closeItemEditor();
        modalOverlay?.classList.remove('active');
    }

    function openCropper(imageDataUrl, context) {
        croppingContext = context;
        if (!cropperImage || !cropperOverlay) return;
        cropperImage.src = imageDataUrl;
        cropperOverlay.classList.add('active');
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImage, { aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 0.9 });
    }

    function closeCropper() {
        if (cropper) { cropper.destroy(); cropper = null; }
        cropperOverlay?.classList.remove('active');
        croppingContext = {};
    }

    function setupImageUpload(triggerElement, fileInputElement, urlInputElement, previewImgElement) {
        if (!triggerElement || !fileInputElement || !urlInputElement || !previewImgElement) return;
        triggerElement.addEventListener('click', () => fileInputElement.click());
        fileInputElement.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file || !file.type.startsWith('image/')) { event.target.value = ''; return; }
            const reader = new FileReader();
            reader.onload = (e) => openCropper(e.target.result, { urlInputElement, previewImgElement });
            reader.readAsDataURL(file);
            event.target.value = '';
        });
    }

    function renderProfileTab() {
        const profileTabPane = document.getElementById(`profile-${uiStyle.toLowerCase()}`);
        if (!profileTabPane) return;

        profileTabPane.innerHTML = '';
        const basicInfoCard = document.createElement('div');
        basicInfoCard.className = 'info-card';
        const basicInfoTitle = document.createElement('h3');
        basicInfoTitle.className = 'card-title';
        basicInfoTitle.textContent = '基础信息';
        basicInfoCard.appendChild(basicInfoTitle);

        const basicInfoList = document.createElement('ul');
        basicInfoList.className = 'info-list';

        const addInfoItem = (label, value) => {
            if (value && value.trim()) {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span class="info-label">${label}</span><span class="info-value">${value}</span>`;
                basicInfoList.appendChild(listItem);
            }
        };

        const username = document.getElementById('edit-username')?.value;
        const gender = document.getElementById('edit-gender-trigger')?.querySelector('.value-display')?.textContent || '';
        const getDisplayValue = (trigger) => {
            const display = trigger?.querySelector('.value-display');
            return (display && !display.classList.contains('placeholder')) ? display.textContent : '';
        };
        
        addInfoItem(currentMode === 'YOU' ? '用户名' : '角色名', username);
        addInfoItem('性别', gender);
        addInfoItem('年龄', getDisplayValue(editAgeTrigger));
        addInfoItem('种族', getDisplayValue(editRaceTrigger));
        addInfoItem('职业', getDisplayValue(editOccupationTrigger));
        
        if (basicInfoList.children.length > 0) {
            basicInfoCard.appendChild(basicInfoList);
        }

        const bio = getDisplayValue(editBioTrigger);
        if (bio) {
            const bioListItem = document.createElement('li');
            bioListItem.style.flexDirection = 'column'; bioListItem.style.alignItems = 'flex-start'; bioListItem.style.gap = '4px';
            const bioLabel = document.createElement('span'); bioLabel.className = 'info-label'; bioLabel.textContent = '简介';
            const bioValue = document.createElement('span'); bioValue.className = 'info-value'; bioValue.style.textAlign = 'justify'; bioValue.textContent = bio;
            bioListItem.appendChild(bioLabel); bioListItem.appendChild(bioValue);
            basicInfoList.appendChild(bioListItem);
        }

        profileTabPane.appendChild(basicInfoCard);

        const customSections = modalMainContent?.querySelectorAll('.modal-section-pane[id^="modal-section-custom-"]');
        customSections?.forEach(section => {
            const sectionTitle = section.querySelector('.pane-title-capsule')?.textContent;
            const items = section.querySelectorAll('.custom-item-group');
            const card = document.createElement('div'); card.className = 'info-card';
            const cardTitle = document.createElement('h3'); cardTitle.className = 'card-title'; cardTitle.textContent = sectionTitle;
            card.appendChild(cardTitle);

            if (items.length === 0) {
                const emptyText = document.createElement('p'); emptyText.textContent = '暂无内容'; emptyText.style.color = '#999';
                card.appendChild(emptyText);
            } else {
                const list = document.createElement('ul'); list.className = 'info-list';
                items.forEach(item => {
                    const labelText = item.querySelector('label')?.textContent;
                    const valueDisplay = item.querySelector('.value-display');
                    if (valueDisplay && !valueDisplay.classList.contains('placeholder')) {
                        const valueText = valueDisplay.textContent;
                        const listItem = document.createElement('li');
                        const labelSpan = document.createElement('span'); labelSpan.className = 'info-label'; labelSpan.textContent = labelText;
                        const valueSpan = document.createElement('span'); valueSpan.className = 'info-value'; valueSpan.textContent = valueText;
                        listItem.appendChild(labelSpan); listItem.appendChild(valueSpan);
                        list.appendChild(listItem);
                    }
                });
                if (list.children.length > 0) { card.appendChild(list); } else {
                    const emptyText = document.createElement('p'); emptyText.textContent = '暂无内容'; emptyText.style.color = '#999';
                    card.appendChild(emptyText);
                }
            }
            profileTabPane.appendChild(card);
        });
    }

    function openSubEditor(config) { if (!sepTitle || !sepTextarea || !subEditorPanel) return; sepTitle.textContent = config.title; sepTextarea.value = config.initialValue || ''; sepTextarea.placeholder = config.placeholder || '在此输入内容...'; currentSaveCallback = config.onSave; subEditorPanel.classList.add('active'); sepTextarea.focus(); }
    function closeSubEditor() { subEditorPanel?.classList.remove('active'); currentSaveCallback = null; }
    const setupTrigger = (trigger, title) => { trigger?.addEventListener('click', () => { const valueDisplay = trigger.querySelector('.value-display'); if (!valueDisplay) return; openSubEditor({ title: title, initialValue: valueDisplay.classList.contains('placeholder') ? '' : valueDisplay.textContent, placeholder: valueDisplay.getAttribute('data-placeholder') || '', onSave: (newValue) => { if (newValue) { valueDisplay.textContent = newValue; valueDisplay.classList.remove('placeholder'); } else { valueDisplay.textContent = valueDisplay.getAttribute('data-placeholder') || ''; valueDisplay.classList.add('placeholder'); } } }); }); };
    
    function openItemEditor(pane, item = null) { if (!itemEditorPanel || !itemEditorTitleHeader || !itemEditorTitleInput || !itemEditorValueTextarea) return; currentItemEditingContext = { pane, item }; if (item) { itemEditorTitleHeader.textContent = '编辑条目'; const label = item.querySelector('label')?.textContent; const valueDisplay = item.querySelector('.value-display'); const value = (valueDisplay && !valueDisplay.classList.contains('placeholder')) ? valueDisplay.textContent : ''; itemEditorTitleInput.value = label || ''; itemEditorValueTextarea.value = value; } else { itemEditorTitleHeader.textContent = '添加条目'; itemEditorTitleInput.value = ''; itemEditorValueTextarea.value = ''; itemEditorTitleInput.focus(); } itemEditorPanel.classList.add('active'); }
    function closeItemEditor() { itemEditorPanel?.classList.remove('active'); currentItemEditingContext = { pane: null, item: null }; }
    
    function createNewSection(name) {
        const newId = `modal-section-custom-${Date.now()}`;
        const newNavButton = document.createElement('button'); newNavButton.className = 'modal-nav-button'; newNavButton.setAttribute('data-target', newId); newNavButton.innerHTML = `<span>${name}</span>`;
        const newContentPane = document.createElement('div'); newContentPane.id = newId; newContentPane.className = 'modal-section-pane'; newContentPane.innerHTML = `<div class="pane-header-container"><h4 class="pane-title-capsule">${name}</h4></div><div class="custom-items-container"></div><button class="add-item-btn"><i class="fa-solid fa-plus"></i><span>添加条目</span></button>`;
        sidebarNavList?.appendChild(newNavButton);
        modalMainContent?.appendChild(newContentPane);
        const itemsContainer = newContentPane.querySelector('.custom-items-container');
        if (itemsContainer) { new Sortable(itemsContainer, { handle: 'label', animation: 150, ghostClass: 'item-sortable-ghost' }); }
        newNavButton.click();
        if (presetContentStore[name]) { presetContentStore[name].forEach(item => createAndAppendCustomItem(newContentPane, item.title, item.value)); }
    }
    
    function openAddSectionSheet() { addSectionSheetOverlay?.classList.add('active'); }
    function closeAddSectionSheet() { addSectionSheetOverlay?.classList.remove('active'); }
    
    function openNamePrompt(config) { if (!namePromptOverlay || !namePromptTitle || !newSectionNameInput) return; namePromptTitle.textContent = config.title; newSectionNameInput.value = config.defaultValue || ''; newSectionNameInput.placeholder = config.placeholder || '请输入 2-4 个字符'; currentPromptAction = config.onConfirm; elementBeingEdited = config.element || null; namePromptOverlay.classList.add('active'); newSectionNameInput.focus(); }
    function closeNamePrompt() { namePromptOverlay?.classList.remove('active'); currentPromptAction = null; elementBeingEdited = null; }
    
    function handleConfirmAddSection() { const name = newSectionNameInput?.value.trim(); if (!name || name.length < 2 || name.length > 4) { alert('栏目名称必须为 2-4 个字符！'); return; } const isDuplicate = [...(sidebarNavList?.querySelectorAll('[data-target] span') || [])].some(span => span.textContent === name) || [...(presetTagsContainer?.querySelectorAll('[data-preset-name]') || [])].some(tag => tag.dataset.presetName === name); if (isDuplicate) { alert('该名称已存在，请换一个！'); return; } createNewSection(name); closeNamePrompt(); }
    async function handleConfirmRenameSection() { if (!elementBeingEdited || !newSectionNameInput) return; const newName = newSectionNameInput.value.trim(); const oldName = elementBeingEdited.querySelector('.pane-title-capsule')?.textContent; if (newName === oldName) { closeNamePrompt(); return; } if (newName.length < 2 || newName.length > 4) { alert('栏目名称必须为 2-4 个字符！'); return; } const isDuplicate = [...(sidebarNavList?.querySelectorAll('[data-target] span') || [])].some(span => span.textContent === newName); if (isDuplicate) { alert('该名称已存在，请换一个！'); return; } const titleEl = elementBeingEdited.querySelector('.pane-title-capsule'); if (titleEl) titleEl.textContent = newName; const navButtonSpan = sidebarNavList?.querySelector(`[data-target="${elementBeingEdited.id}"] span`); if (navButtonSpan) navButtonSpan.textContent = newName; const presetTag = presetTagsContainer?.querySelector(`[data-preset-name="${oldName}"]`); if (presetTag) { presetTag.dataset.presetName = newName; presetTag.textContent = newName; } if (presetContentStore.hasOwnProperty(oldName)) { presetContentStore[newName] = presetContentStore[oldName]; delete presetContentStore[oldName]; await dbStorage.setItem(getDbKey('presetContentStore'), presetContentStore); } closeNamePrompt(); }
    
    async function handlePressStart(event) { const targetTag = event.target.closest('.preset-tag:not(.preset-tag-custom)'); if (!targetTag) return; isLongPress = false; longPressTimer = setTimeout(async () => { isLongPress = true; event.preventDefault(); const presetName = targetTag.dataset.presetName; if (confirm(`确定要删除预设栏目“${presetName}”吗？`)) { targetTag.remove(); delete presetContentStore[presetName]; await dbStorage.setItem(getDbKey('presetContentStore'), presetContentStore); } }, LONG_PRESS_DURATION); }
    function handlePressEnd() { clearTimeout(longPressTimer); }
    
    function openOptionsBottomSheet(paneElement) { activeCustomPane = paneElement; customSectionOptionsOverlay?.classList.add('active'); }
    function closeOptionsBottomSheet() { customSectionOptionsOverlay?.classList.remove('active'); activeCustomPane = null; }
    
    function createAndAppendCustomItem(pane, label, value) {
        const container = pane.querySelector('.custom-items-container'); if (!container) return;
        const newItem = document.createElement('div'); newItem.className = 'form-group custom-item-group';
        const hasValue = value && value.trim() !== '';
        newItem.innerHTML = `<label>${label}</label><button class="item-actions-btn" title="删除条目"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="form-group-clickable"><span class="value-display ${hasValue ? '' : 'placeholder'}">${hasValue ? value : '点击填写内容'}</span><i class="fa-solid fa-chevron-right"></i></div>`;
        container.appendChild(newItem);
    }
    
    // ====================【初始化和事件绑定】====================
    async function initializeApp() {
        currentMode = await dbStorage.getItem(`profile${uiStyle}Mode`) || 'YOU';
        const loadedProfiles = await dbStorage.getItem(getDbKey('profileData'));
        if (loadedProfiles && loadedProfiles.length > 0) {
            profileData = loadedProfiles;
        } else {
            if (currentMode === 'YOU') {
                profileData = [{ id: getDefaultProfileId(), name: 'User', gender: '♀（女）', bio: '', age: '', race: '', occupation: '', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg', banner: 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg' }];
            } else {
                profileData = [{ id: getDefaultProfileId(), name: 'Felotus', gender: '♀（女）', bio: '', age: '', race: '', occupation: '', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg', banner: 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg', isToggleOn: false }];
            }
            await dbStorage.setItem(getDbKey('profileData'), profileData);
        }

        const loadedPresets = await dbStorage.getItem(getDbKey('presetContentStore'));
        presetContentStore = loadedPresets || {};

        const loadedProfileId = await dbStorage.getItem(getDbKey('currentProfileId'));
        if (loadedProfileId && profileData.some(p => p.id === loadedProfileId)) {
            currentProfileId = loadedProfileId;
        } else {
            currentProfileId = getDefaultProfileId();
            await dbStorage.setItem(getDbKey('currentProfileId'), currentProfileId);
        }

        updateUiForMode();

        if (uiStyle === 'YDN' && typeof elements.showSwitcherPage === 'function') {
            renderSwitcher();
            elements.showSwitcherPage();
        } else {
            await loadProfileData(currentProfileId);
        }
    }

    // 绑定一次性事件
    (function bindSharedEvents() {
        editGenderTrigger?.addEventListener('click', () => { if (currentMode === 'YOU') return; const valueDisplay = editGenderTrigger.querySelector('.value-display'); if (!valueDisplay) return; const currentValue = valueDisplay.textContent; const currentIndex = GENDER_OPTIONS.indexOf(currentValue); const nextIndex = (currentIndex + 1) % GENDER_OPTIONS.length; valueDisplay.textContent = GENDER_OPTIONS[nextIndex]; });
        characterToggleSwitch?.addEventListener('change', async function () { if (currentMode !== 'TA') return; const currentProfile = profileData.find(p => p.id === currentProfileId); if (currentProfile) { currentProfile.isToggleOn = this.checked; await dbStorage.setItem(getDbKey('profileData'), profileData); } });
        elements.tabButtons.forEach(button => { button.addEventListener('click', () => { elements.tabButtons.forEach(btn => btn.classList.remove('active')); elements.tabPanes.forEach(pane => pane.classList.remove('active')); button.classList.add('active'); const tabId = button.dataset.tab; const targetPane = document.getElementById(tabId); if (targetPane) targetPane.classList.add('active'); }); });
        elements.editFabButton?.addEventListener('click', openModal);
        closeModalButton?.addEventListener('click', closeModal);
        modalOverlay?.addEventListener('click', (event) => { if (event.target === modalOverlay) closeModal(); });
        modalSidebar?.addEventListener('click', (event) => { const button = event.target.closest('.modal-nav-button'); if (!button) return; modalSidebar.querySelectorAll('.modal-nav-button').forEach(btn => btn.classList.remove('active')); button.classList.add('active'); modalMainContent.querySelectorAll('.modal-section-pane').forEach(pane => pane.classList.remove('active')); const targetPaneId = button.dataset.target; const targetPane = document.getElementById(targetPaneId); if (targetPane) targetPane.classList.add('active'); });
        if (avatarUrlInput && avatarPreviewImg) { avatarUrlInput.addEventListener('input', () => { avatarPreviewImg.src = avatarUrlInput.value || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }); }
        if (bannerUrlInput && bannerPreviewImg) { bannerUrlInput.addEventListener('input', () => { bannerPreviewImg.src = bannerUrlInput.value || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; }); }
        setupImageUpload(avatarPreviewImg, avatarUploadInput, avatarUrlInput, avatarPreviewImg);
        setupImageUpload(bannerPreviewImg, bannerUploadInput, bannerUrlInput, bannerPreviewImg);
        confirmCropBtn?.addEventListener('click', () => { if (cropper && croppingContext.urlInputElement && croppingContext.previewImgElement) { const canvas = cropper.getCroppedCanvas({ width: 512, height: 512, imageSmoothingQuality: 'high' }); const croppedImageDataUrl = canvas.toDataURL('image/png'); croppingContext.urlInputElement.value = croppedImageDataUrl; croppingContext.previewImgElement.src = croppedImageDataUrl; closeCropper(); } });
        cancelCropBtn?.addEventListener('click', closeCropper);
        saveButton?.addEventListener('click', async () => {
            const currentProfile = profileData.find(p => p.id === currentProfileId);
            if (currentProfile) {
                currentProfile.name = document.getElementById('edit-username')?.value || '';
                if (currentMode === 'YOU') { currentProfile.gender = '♀（女）'; } else { const genderTrigger = document.getElementById('edit-gender-trigger'); currentProfile.gender = genderTrigger?.querySelector('.value-display')?.textContent || GENDER_OPTIONS[1]; }
                currentProfile.avatar = document.getElementById('edit-avatar-url')?.value || '';
                currentProfile.banner = document.getElementById('edit-banner-url')?.value || '';
                const getDisplayValue = (trigger) => { const display = trigger?.querySelector('.value-display'); return (display && !display.classList.contains('placeholder')) ? display.textContent : ''; };
                currentProfile.age = getDisplayValue(editAgeTrigger);
                currentProfile.race = getDisplayValue(editRaceTrigger);
                currentProfile.occupation = getDisplayValue(editOccupationTrigger);
                currentProfile.bio = getDisplayValue(editBioTrigger);
                if (userNameEl) userNameEl.textContent = currentProfile.name;
                if (genderSymbolEl) genderSymbolEl.textContent = currentProfile.gender.charAt(0);
                if (profileAvatarImg) profileAvatarImg.src = currentProfile.avatar;
                if (characterBannerImg) characterBannerImg.src = currentProfile.banner;
                const bioPlaceholder = currentMode === 'YOU' ? '这里是用户的个人简介...' : '这里是角色的个人简介...';
                if (homeBioContent) homeBioContent.textContent = currentProfile.bio || bioPlaceholder;
                if (typeof onProfileSave === 'function') { onProfileSave(currentProfile); }
                await dbStorage.setItem(getDbKey('profileData'), profileData);
            }
            renderProfileTab();
            closeModal();
        });
        helpButton?.addEventListener('click', (event) => { event.stopPropagation(); helpTooltip?.classList.toggle('active'); });
        document.addEventListener('click', (event) => { if (helpTooltip?.classList.contains('active') && !helpTooltip.contains(event.target)) { helpTooltip.classList.remove('active'); } });
        setupTrigger(editAgeTrigger, '编辑年龄'); setupTrigger(editRaceTrigger, '编辑种族'); setupTrigger(editOccupationTrigger, '编辑职业'); setupTrigger(editBioTrigger, '编辑简介');
        sepBackBtn?.addEventListener('click', closeSubEditor);
        sepSaveBtn?.addEventListener('click', () => { if (typeof currentSaveCallback === 'function') { const newValue = sepTextarea?.value.trim() || ''; currentSaveCallback(newValue); } closeSubEditor(); });
        itemEditorBackBtn?.addEventListener('click', closeItemEditor);
        itemEditorSaveBtn?.addEventListener('click', () => { const { pane, item } = currentItemEditingContext; if (!pane || !itemEditorTitleInput || !itemEditorValueTextarea) return; const title = itemEditorTitleInput.value.trim(); const value = itemEditorValueTextarea.value.trim(); if (!title) { alert('标题不能为空！'); return; } if (title.length > 10) { alert('标题不能超过10个字符！'); return; } if (item) { const labelEl = item.querySelector('label'); const valueDisplay = item.querySelector('.value-display'); if (labelEl) labelEl.textContent = title; if (valueDisplay) { if (value) { valueDisplay.textContent = value; valueDisplay.classList.remove('placeholder'); } else { valueDisplay.textContent = '点击填写内容'; valueDisplay.classList.add('placeholder'); } } } else { createAndAppendCustomItem(pane, title, value); } closeItemEditor(); });
        addSectionBtn?.addEventListener('click', openAddSectionSheet);
        cancelAddSheetBtn?.addEventListener('click', closeAddSectionSheet);
        addSectionSheetOverlay?.addEventListener('click', (event) => { if (event.target === addSectionSheetOverlay) closeAddSectionSheet(); });
        cancelPromptBtn?.addEventListener('click', closeNamePrompt);
        namePromptOverlay?.addEventListener('click', (event) => { if (event.target === namePromptOverlay) closeNamePrompt(); });
        confirmPromptBtn?.addEventListener('click', () => { if (typeof currentPromptAction === 'function') currentPromptAction(); });
        presetTagsContainer?.addEventListener('click', (event) => { if (isLongPress) { isLongPress = false; return; } const button = event.target.closest('.preset-tag'); if (!button) return; if (button.dataset.action === 'custom') { openNamePrompt({ title: '为新栏目命名', onConfirm: handleConfirmAddSection }); } else if (button.dataset.presetName) { createNewSection(button.dataset.presetName); } closeAddSectionSheet(); });
        presetTagsContainer?.addEventListener('mousedown', handlePressStart);
        presetTagsContainer?.addEventListener('touchstart', handlePressStart, { passive: true });
        ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach(evt => presetTagsContainer?.addEventListener(evt, handlePressEnd));
        if (sidebarNavList) { new Sortable(sidebarNavList, { animation: 150, ghostClass: 'sortable-ghost', filter: '.fixed-nav-button', delay: 200, delayOnTouchOnly: true, onEnd: () => { sidebarNavList.querySelectorAll('.modal-nav-button').forEach(button => { const pane = document.getElementById(button.dataset.target); if (pane) modalMainContent?.appendChild(pane); }); } }); }
        modalMainContent?.addEventListener('click', (event) => { const pane = event.target.closest('.modal-section-pane'); if (!pane) return; if (event.target.closest('.item-actions-btn')) { if (confirm('确定要删除这个条目吗？')) event.target.closest('.custom-item-group')?.remove(); } else if (event.target.closest('.pane-title-capsule') && pane.id.startsWith('modal-section-custom-')) { openOptionsBottomSheet(pane); } else if (event.target.closest('.add-item-btn')) { openItemEditor(pane, null); } else if (event.target.closest('.custom-item-group')) { openItemEditor(pane, event.target.closest('.custom-item-group')); } });
        cancelOptionsSheetBtn?.addEventListener('click', closeOptionsBottomSheet);
        customSectionOptionsOverlay?.addEventListener('click', (event) => { if (event.target === customSectionOptionsOverlay) closeOptionsBottomSheet(); });
        customSectionOptionsSheet?.addEventListener('click', async (event) => { const button = event.target.closest('.action-button'); if (!button || !activeCustomPane) return; const action = button.dataset.action; const sectionName = activeCustomPane.querySelector('.pane-title-capsule')?.textContent; if (!sectionName) return; switch (action) { case 'rename': openNamePrompt({ title: '重命名栏目', defaultValue: sectionName, onConfirm: handleConfirmRenameSection, element: activeCustomPane }); break; case 'save-preset': if (presetTagsContainer?.querySelector(`[data-preset-name="${sectionName}"]`)) { alert(`预设“${sectionName}”已存在！`); } else { const newPresetTag = document.createElement('button'); newPresetTag.className = 'preset-tag'; newPresetTag.dataset.presetName = sectionName; newPresetTag.textContent = sectionName; presetTagsContainer?.appendChild(newPresetTag); alert(`已将“${sectionName}”保存为预设栏目！`); } break; case 'load-content': if (!presetTagsContainer?.querySelector(`[data-preset-name="${sectionName}"]`)) { alert(`请先将“${sectionName}”存为预设栏目后再加载内容！`); break; } const itemsToLoad = [...activeCustomPane.querySelectorAll('.custom-item-group')].map(itemEl => ({ title: itemEl.querySelector('label')?.textContent || '', value: '' })); presetContentStore[sectionName] = itemsToLoad; await dbStorage.setItem(getDbKey('presetContentStore'), presetContentStore); alert(`已将 ${itemsToLoad.length} 个条目标题加载到预设“${sectionName}”中！`); break; case 'delete': if (confirm('确定要删除这个栏目吗？此操作不可撤销。')) { const paneId = activeCustomPane.id; const navButton = sidebarNavList?.querySelector(`[data-target="${paneId}"]`); activeCustomPane.remove(); navButton?.remove(); sidebarNavList?.querySelector('.fixed-nav-button')?.click(); } break; } closeOptionsBottomSheet(); });
        settingsUserList?.addEventListener('click', (event) => { const targetLi = event.target.closest('li[data-profile-id]'); if (!targetLi || targetLi.classList.contains('disabled')) return; const profileId = targetLi.dataset.profileId; const isSelected = selectedProfileIds.includes(profileId); if (isMultiSelectMode) { if (isSelected) { selectedProfileIds = selectedProfileIds.filter(id => id !== profileId); targetLi.classList.remove('selected'); } else { selectedProfileIds.push(profileId); targetLi.classList.add('selected'); } } else { settingsUserList.querySelectorAll('li').forEach(li => li.classList.remove('selected')); if (isSelected) { selectedProfileIds = []; } else { selectedProfileIds = [profileId]; targetLi.classList.add('selected'); } } updateDeleteButtonState(); });
        settingsDeleteBtn?.addEventListener('click', async () => { if (selectedProfileIds.length === 0) return; const noun = currentMode === 'YOU' ? '用户' : '角色'; const confirmMessage = `确定要删除 ${selectedProfileIds.length} 个选定的${noun}吗？\n此操作不可撤销。`; if (confirm(confirmMessage)) { profileData = profileData.filter(p => !selectedProfileIds.includes(p.id)); await dbStorage.setItem(getDbKey('profileData'), profileData); if (selectedProfileIds.includes(currentProfileId)) { if (uiStyle === 'YDN') { currentProfileId = null; } else { await loadProfileData(getDefaultProfileId()); } } if (uiStyle === 'YDM') { renderSwitcher(); } closeSwitcherSettingsModal(); } });
        settingsCloseBtn?.addEventListener('click', closeSwitcherSettingsModal);
        switcherSettingsModal?.addEventListener('click', (event) => { if (event.target === switcherSettingsModal) closeSwitcherSettingsModal(); });
        settingsImportBtn?.addEventListener('click', () => alert('导入功能暂未开放'));
        settingsExportBtn?.addEventListener('click', () => alert('导出功能暂未开放'));
        settingsMultiSelectBtn?.addEventListener('click', (event) => { isMultiSelectMode = !isMultiSelectMode; event.currentTarget.classList.toggle('active', isMultiSelectMode); if (!isMultiSelectMode) { settingsUserList?.querySelectorAll('li').forEach(li => li.classList.remove('selected')); selectedProfileIds = []; updateDeleteButtonState(); } });
        elements.modeToggleBtn?.addEventListener('click', async () => { const newMode = currentMode === 'YOU' ? 'TA' : 'YOU'; currentMode = newMode; await dbStorage.setItem(`profile${uiStyle}Mode`, currentMode); await initializeApp(); });
    })();

    // ====================【暴露公共接口】====================
    return {
        initializeApp,
        loadProfileData,
        addNewProfile,
        openSwitcherSettingsModal,
        getDbKey,
        getProfileData: () => profileData,
        setProfileData: (newData) => { profileData = newData; },
    };
}