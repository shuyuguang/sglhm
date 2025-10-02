// profile.ui.js

/**
 * 负责所有UI相关的操作，如显示/隐藏模态框、渲染DOM等
 */
function createUiManager(elements, state, config) {
    const {
        modalOverlay, helpTooltip, subEditorPanel, sepTitle, sepTextarea,
        itemEditorPanel, itemEditorTitleHeader, itemEditorTitleInput, itemEditorValueTextarea,
        cropperOverlay, cropperImage, switcherSettingsModal, settingsUserList,
        addSectionSheetOverlay, namePromptOverlay, namePromptTitle, newSectionNameInput,
        customSectionOptionsOverlay, modalMainContent, sidebarNavList,
        characterBannerImg, profileAvatarImg, userNameEl, genderSymbolEl, homeBioContent,
        usernameLabel, switcherSettingsTitle, editGenderTrigger, editAgeTrigger,
        editRaceTrigger, editOccupationTrigger, editBioTrigger,
        characterSelectorOverlay, relationshipTypeOverlay, charSelectorList,
        relationshipItemsContainer, relationshipTypeOptions,
        confirmRelTypeBtn
    } = elements;

    let cropper = null;

    // --- Modal & Overlay Controls ---
    const openModal = () => modalOverlay?.classList.add('active');
    const closeModal = () => {
        helpTooltip?.classList.remove('active');
        closeSubEditor();
        closeItemEditor();
        modalOverlay?.classList.remove('active');
    };

    const openSubEditor = (editorConfig) => {
        if (!sepTitle || !sepTextarea || !subEditorPanel) return;
        sepTitle.textContent = editorConfig.title;
        sepTextarea.value = editorConfig.initialValue || '';
        sepTextarea.placeholder = editorConfig.placeholder || '在此输入内容...';
        state.currentSaveCallback = editorConfig.onSave;
        subEditorPanel.classList.add('active');
        sepTextarea.focus();
    };
    const closeSubEditor = () => {
        subEditorPanel?.classList.remove('active');
        state.currentSaveCallback = null;
    };

    const openItemEditor = (pane, item = null) => {
        if (!itemEditorPanel || !itemEditorTitleHeader || !itemEditorTitleInput || !itemEditorValueTextarea) return;
        state.currentItemEditingContext = { pane, item };
        if (item) {
            itemEditorTitleHeader.textContent = '编辑条目';
            const label = item.querySelector('label')?.textContent;
            const valueDisplay = item.querySelector('.value-display');
            const value = (valueDisplay && !valueDisplay.classList.contains('placeholder')) ? valueDisplay.textContent : '';
            itemEditorTitleInput.value = label || '';
            itemEditorValueTextarea.value = value;
        } else {
            itemEditorTitleHeader.textContent = '添加条目';
            itemEditorTitleInput.value = '';
            itemEditorValueTextarea.value = '';
            itemEditorTitleInput.focus();
        }
        itemEditorPanel.classList.add('active');
    };
    const closeItemEditor = () => {
        itemEditorPanel?.classList.remove('active');
        state.currentItemEditingContext = { pane: null, item: null };
    };

    const openCropper = (imageDataUrl, context) => {
        state.croppingContext = context;
        if (!cropperImage || !cropperOverlay) return;
        cropperImage.src = imageDataUrl;
        cropperOverlay.classList.add('active');
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImage, { aspectRatio: 1, viewMode: 1, background: false, autoCropArea: 0.9 });
    };
    const closeCropper = () => {
        if (cropper) { cropper.destroy(); cropper = null; }
        cropperOverlay?.classList.remove('active');
        state.croppingContext = {};
    };
    
    const openSwitcherSettingsModal = () => {
        state.selectedProfileIds = [];
        state.isMultiSelectMode = false;
        elements.settingsMultiSelectBtn?.classList.remove('active');
        renderSettingsUserList();
        updateDeleteButtonState();
        switcherSettingsModal?.classList.add('active');
    };
    const closeSwitcherSettingsModal = () => {
        switcherSettingsModal?.classList.remove('active');
        if (state.uiStyle === 'YDN' && typeof state.renderSwitcher === 'function') {
            state.renderSwitcher();
        }
    };

    const openAddSectionSheet = () => addSectionSheetOverlay?.classList.add('active');
    const closeAddSectionSheet = () => addSectionSheetOverlay?.classList.remove('active');

    const openNamePrompt = (promptConfig) => {
        if (!namePromptOverlay || !namePromptTitle || !newSectionNameInput) return;
        namePromptTitle.textContent = promptConfig.title;
        newSectionNameInput.value = promptConfig.defaultValue || '';
        newSectionNameInput.placeholder = promptConfig.placeholder || '请输入 2-4 个字符';
        state.currentPromptAction = promptConfig.onConfirm;
        state.elementBeingEdited = promptConfig.element || null;
        namePromptOverlay.classList.add('active');
        newSectionNameInput.focus();
    };
    const closeNamePrompt = () => {
        namePromptOverlay?.classList.remove('active');
        state.currentPromptAction = null;
        state.elementBeingEdited = null;
    };

    const openOptionsBottomSheet = (paneElement) => {
        state.activeCustomPane = paneElement;
        customSectionOptionsOverlay?.classList.add('active');
    };
    const closeOptionsBottomSheet = () => {
        customSectionOptionsOverlay?.classList.remove('active');
        state.activeCustomPane = null;
    };

    const openCharacterSelector = () => characterSelectorOverlay?.classList.add('active');
    
    // ▼▼▼ 修改开始 ▼▼▼
    const closeCharacterSelector = () => {
        characterSelectorOverlay?.classList.remove('active');
        // 【错误点移除】不再在这里清除 state.selectedCharForRel
        // state.selectedCharForRel = null; 
    };
    
    const openRelationshipTypeSelector = () => {
        relationshipTypeOverlay?.classList.add('active');
        updateRelTypeConfirmButtonState();
    };

    const closeRelationshipTypeSelector = () => {
        relationshipTypeOverlay?.classList.remove('active');
        // 【正确清理位置】在整个流程结束或取消时，在这里统一清理所有相关状态
        state.selectedCharForRel = null; 
        state.selectedRelationshipTypes = []; 
        relationshipTypeOptions?.querySelectorAll('.option-tag.selected').forEach(el => el.classList.remove('selected'));
        updateRelTypeConfirmButtonState();
    };
    // ▲▲▲ 修改结束 ▲▲▲

    // --- DOM Rendering & Updates ---

    const updateRelTypeConfirmButtonState = () => {
        if (!confirmRelTypeBtn) return;
        confirmRelTypeBtn.disabled = state.selectedRelationshipTypes.length === 0;
    };

    const updateUiForMode = () => {
        const isYouMode = state.currentMode === 'YOU';
        const isYdn = state.uiStyle === 'YDN';

        const modeText = {
            docTitle: '设定集',
            settingsTitle: isYouMode ? '用户管理' : '角色管理',
            usernameLabel: isYouMode ? '用户名' : '角色名',
            bannerAlt: isYouMode ? '用户主图' : '角色主图',
            avatarAlt: isYouMode ? '用户头像' : '角色头像',
            bioPlaceholder: isYouMode ? '这里是用户的个人简介...' : '这里是角色的个人简介...'
        };

        if ((isYdn && window.isYdnActive) || (!isYdn && !window.isYdnActive)) {
            document.title = modeText.docTitle;
        }

        if (switcherSettingsTitle) switcherSettingsTitle.textContent = modeText.settingsTitle;
        if (usernameLabel) usernameLabel.textContent = modeText.usernameLabel;
        if (characterBannerImg) characterBannerImg.alt = modeText.bannerAlt;
        if (profileAvatarImg) profileAvatarImg.alt = modeText.avatarAlt;

        const currentProfile = state.profileData.find(p => p.id === state.currentProfileId);
        if (homeBioContent && (!currentProfile || !currentProfile.bio)) {
            homeBioContent.textContent = modeText.bioPlaceholder;
        }

        if (elements.modeToggleBtn) elements.modeToggleBtn.textContent = state.currentMode;
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
    };

    const renderSettingsUserList = () => {
        if (!settingsUserList) return;
        settingsUserList.innerHTML = '';
        state.profileData.forEach(profile => {
            const li = document.createElement('li');
            li.dataset.profileId = profile.id;
            if (profile.id === state.getDefaultProfileId()) li.classList.add('disabled');
            li.innerHTML = `<img src="${profile.avatar}" alt="${profile.name}" class="avatar"><span class="name">${profile.name || '未命名'}</span>`;
            settingsUserList.appendChild(li);
        });
    };

    const updateDeleteButtonState = () => {
        if (elements.settingsDeleteBtn) elements.settingsDeleteBtn.disabled = state.selectedProfileIds.length === 0;
    };

    const updateDisplay = (trigger, value, placeholder) => {
        if (!trigger) return;
        const display = trigger.querySelector('.value-display');
        if (!display) return;
        display.setAttribute('data-placeholder', placeholder);
        display.textContent = value || placeholder;
        display.classList.toggle('placeholder', !value);
    };

    const updateEditModalValues = (profile) => {
        if (elements.avatarUrlInput) elements.avatarUrlInput.value = profile.avatar;
        if (elements.avatarPreviewImg) elements.avatarPreviewImg.src = profile.avatar;
        if (elements.bannerUrlInput) elements.bannerUrlInput.value = profile.banner;
        if (elements.bannerPreviewImg) elements.bannerPreviewImg.src = profile.banner;
        const usernameInput = document.getElementById('edit-username');
        if (usernameInput) usernameInput.value = profile.name;

        if (editGenderTrigger) {
            const genderDisplay = editGenderTrigger.querySelector('.value-display');
            if (genderDisplay) {
                genderDisplay.textContent = state.currentMode === 'YOU' ? '♀（女）' : (config.GENDER_OPTIONS.includes(profile.gender) ? profile.gender : config.GENDER_OPTIONS[1]);
            }
        }
        updateDisplay(editAgeTrigger, profile.age, '请填写年龄、生日或描述');
        updateDisplay(editRaceTrigger, profile.race, '请填写种族');
        updateDisplay(editOccupationTrigger, profile.occupation, '请填写职业');
        updateDisplay(editBioTrigger, profile.bio, '请填写简介');
    };

    const createNewSection = (name, activateOnClick = true) => {
        const newId = `modal-section-custom-${Date.now()}`;
        const newNavButton = document.createElement('button');
        newNavButton.className = 'modal-nav-button';
        newNavButton.setAttribute('data-target', newId);
        newNavButton.innerHTML = `<span>${name}</span>`;
        const newContentPane = document.createElement('div');
        newContentPane.id = newId;
        newContentPane.className = 'modal-section-pane';
        newContentPane.innerHTML = `<div class="pane-header-container"><h4 class="pane-title-capsule">${name}</h4></div><div class="custom-items-container"></div><button class="add-item-btn"><i class="fa-solid fa-plus"></i><span>添加条目</span></button>`;
        sidebarNavList?.appendChild(newNavButton);
        modalMainContent?.appendChild(newContentPane);
        const itemsContainer = newContentPane.querySelector('.custom-items-container');
        if (itemsContainer) { new Sortable(itemsContainer, { handle: 'label', animation: 150, ghostClass: 'item-sortable-ghost' }); }
        if (activateOnClick) newNavButton.click();
        return newContentPane;
    };

    const createAndAppendCustomItem = (pane, label, value) => {
        const container = pane.querySelector('.custom-items-container'); if (!container) return;
        const newItem = document.createElement('div');
        newItem.className = 'form-group custom-item-group';
        const hasValue = value && value.trim() !== '';
        newItem.innerHTML = `<label>${label}</label><button class="item-actions-btn" title="删除条目"><i class="fa-solid fa-ellipsis-vertical"></i></button><div class="form-group-clickable"><span class="value-display ${hasValue ? '' : 'placeholder'}">${hasValue ? value : '点击填写内容'}</span><i class="fa-solid fa-chevron-right"></i></div>`;
        container.appendChild(newItem);
    };

    const renderCharacterSelectorList = (characters, currentProfileId) => {
        if (!charSelectorList) return;
        charSelectorList.innerHTML = '';
        const filteredChars = characters.filter(char => char.id !== currentProfileId);

        if (filteredChars.length === 0) {
            charSelectorList.innerHTML = `<p style="text-align: center; color: #999; padding: 20px;">暂无可选择的角色</p>`;
            return;
        }

        filteredChars.forEach(char => {
            const li = document.createElement('li');
            li.className = 'char-selector-item';
            li.dataset.charId = char.id;
            li.innerHTML = `
                <img src="${char.avatar}" alt="${char.name}" class="avatar">
                <span class="name">${char.name || '未命名'}</span>`;
            charSelectorList.appendChild(li);
        });
    };

    const createAndAppendRelationshipItem = (character, relationshipTypes) => {
        if (!relationshipItemsContainer) return;
        const newItem = document.createElement('div');
        // ▼▼▼ 修改开始 (为关系条目添加一个专属的class) ▼▼▼
        newItem.className = 'form-group custom-item-group relationship-item'; // <-- 增加一个 'relationship-item' 类
        // ▲▲▲ 修改结束 ▲▲▲

        const tagsHtml = relationshipTypes.map(type => `<span class="relationship-tag">${type}</span>`).join('');
        const finalDisplayTextHtml = `是 <strong>${character.name}</strong> 的 ${tagsHtml}`;
        
        newItem.dataset.relCharId = character.id;
        newItem.dataset.relCharName = character.name;
        newItem.dataset.relType = relationshipTypes.join(' / ');

        newItem.innerHTML = `
            <label>${finalDisplayTextHtml}</label>
            <button class="item-actions-btn" title="删除关系"><i class="fa-solid fa-ellipsis-vertical"></i></button>`; // <-- 确认图标是三点
        relationshipItemsContainer.appendChild(newItem);
    };

    const renderProfileTab = () => {
        const profileTabPane = document.getElementById(`profile-${state.uiStyle.toLowerCase()}`);
        if (!profileTabPane) return;

        profileTabPane.innerHTML = '';
        const currentProfile = state.profileData.find(p => p.id === state.currentProfileId);
        if (!currentProfile) return;

        const basicInfoCard = document.createElement('div');
        basicInfoCard.className = 'info-card';
        basicInfoCard.innerHTML = `<h3 class="card-title">基础信息</h3><ul class="info-list"></ul>`;
        const basicInfoList = basicInfoCard.querySelector('.info-list');

        const addInfoItem = (label, value) => {
            if (value && value.trim()) {
                const li = document.createElement('li');
                li.innerHTML = `<span class="info-label">${label}</span><span class="info-value">${value}</span>`;
                basicInfoList.appendChild(li);
            }
        };
        addInfoItem(state.currentMode === 'YOU' ? '用户名' : '角色名', currentProfile.name);
        addInfoItem('性别', currentProfile.gender);
        addInfoItem('年龄', currentProfile.age);
        addInfoItem('种族', currentProfile.race);
        addInfoItem('职业', currentProfile.occupation);
        if (basicInfoList.children.length > 0) profileTabPane.appendChild(basicInfoCard);

        currentProfile.customSections?.forEach(section => {
            const card = document.createElement('div');
            card.className = 'info-card';
            card.innerHTML = `<h3 class="card-title">${section.title}</h3>`;
            const itemsWithContent = section.items.filter(item => item.value?.trim());
            if (itemsWithContent.length === 0) {
                card.innerHTML += `<p style="color: #999;">暂无内容</p>`;
            } else {
                const list = document.createElement('ul');
                list.className = 'info-list';
                itemsWithContent.forEach(item => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="info-label">${item.title}</span><span class="info-value">${item.value}</span>`;
                    list.appendChild(li);
                });
                card.appendChild(list);
            }
            profileTabPane.appendChild(card);
        });
    };

    return {
        openModal, closeModal, openSubEditor, closeSubEditor, openItemEditor, closeItemEditor,
        openCropper, closeCropper, openSwitcherSettingsModal, closeSwitcherSettingsModal,
        openAddSectionSheet, closeAddSectionSheet, openNamePrompt, closeNamePrompt,
        openOptionsBottomSheet, closeOptionsBottomSheet, 
        openCharacterSelector, closeCharacterSelector, openRelationshipTypeSelector, closeRelationshipTypeSelector,
        renderCharacterSelectorList, createAndAppendRelationshipItem,
        updateRelTypeConfirmButtonState,
        updateUiForMode, updateDeleteButtonState,
        updateEditModalValues, createNewSection, createAndAppendCustomItem, renderProfileTab,
        getCropper: () => cropper
    };
}