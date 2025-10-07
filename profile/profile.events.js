// profile.events.js

/**
 * 负责所有事件监听器的绑定
 */
function createEventManager(elements, state, ui, data, config) {

    const handleConfirmAddSection = () => {
        const name = elements.newSectionNameInput?.value.trim();
        if (!name || name.length < 2 || name.length > 4) return alert('栏目名称必须为 2-4 个字符！');
        const isDuplicate = [...(elements.sidebarNavList?.querySelectorAll('[data-target] span') || [])].some(span => span.textContent === name);
        if (isDuplicate) return alert('该名称已存在，请换一个！');
        ui.createNewSection(name);
        ui.closeNamePrompt();
    };

    const handleConfirmRenameSection = async () => {
        if (!state.elementBeingEdited || !elements.newSectionNameInput) return;
        const newName = elements.newSectionNameInput.value.trim();
        const oldName = state.elementBeingEdited.querySelector('.pane-title-capsule')?.textContent;
        if (newName === oldName) return ui.closeNamePrompt();
        if (newName.length < 2 || newName.length > 4) return alert('栏目名称必须为 2-4 个字符！');
        const isDuplicate = [...(elements.sidebarNavList?.querySelectorAll('[data-target] span') || [])].some(span => span.textContent === newName);
        if (isDuplicate) return alert('该名称已存在，请换一个！');

        state.elementBeingEdited.querySelector('.pane-title-capsule').textContent = newName;
        elements.sidebarNavList.querySelector(`[data-target="${state.elementBeingEdited.id}"] span`).textContent = newName;
        
        if (state.presetContentStore.hasOwnProperty(oldName)) {
            state.presetContentStore[newName] = state.presetContentStore[oldName];
            delete state.presetContentStore[oldName];
            await data.dbStorage.setItem('globalPresetContentStore', state.presetContentStore);
        }
        ui.closeNamePrompt();
    };

    const handlePressStart = (event) => {
        const targetTag = event.target.closest('.preset-tag:not(.preset-tag-custom)');
        if (!targetTag) return;
        state.isLongPress = false;
        state.longPressTimer = setTimeout(async () => {
            state.isLongPress = true;
            event.preventDefault();
            const presetName = targetTag.dataset.presetName;
            if (confirm(`确定要删除预设栏目“${presetName}”吗？`)) {
                targetTag.remove();
                await data.deletePreset(presetName);
            }
        }, config.LONG_PRESS_DURATION);
    };
    const handlePressEnd = () => clearTimeout(state.longPressTimer);

    // --- UI-Specific Event Binders ---
    function bindUiSpecificEvents() {
        elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                elements.tabButtons.forEach(btn => btn.classList.remove('active'));
                elements.tabPanes.forEach(pane => pane.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(button.dataset.tab)?.classList.add('active');
            });
        });
        elements.editFabButton?.addEventListener('click', ui.openModal);
        elements.modeToggleBtn?.addEventListener('click', async () => {
            state.currentMode = state.currentMode === 'YOU' ? 'TA' : 'YOU';
            await data.dbStorage.setItem(`profile${state.uiStyle}Mode`, state.currentMode);
            await data.initializeApp();
        });
    }

    // --- Shared Event Binders ---
    function bindSharedEvents() {
        // Edit Modal General
        elements.closeModalButton?.addEventListener('click', ui.closeModal);
        elements.modalOverlay?.addEventListener('click', (e) => e.target === elements.modalOverlay && ui.closeModal());
        elements.saveButton?.addEventListener('click', data.saveCurrentProfile);

        // ▼▼▼【重要】用下面这种更简洁可靠的方式重写帮助框逻辑 ▼▼▼
        
        // Modal内的帮助按钮
        elements.helpButton?.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到document
            elements.helpTooltip?.classList.toggle('active');
        });

        // 全局帮助按钮
        elements.globalHelpBtn?.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到document
            elements.globalHelpTooltip?.classList.toggle('active');
        });
        
        // 全局点击监听，用于关闭打开的提示框
        document.addEventListener('click', () => {
            elements.helpTooltip?.classList.remove('active');
            elements.globalHelpTooltip?.classList.remove('active');
        });
        
        // 阻止提示框自身的点击事件关闭自己
        elements.helpTooltip?.addEventListener('click', e => e.stopPropagation());
        elements.globalHelpTooltip?.addEventListener('click', e => e.stopPropagation());

        // ▲▲▲ 修改结束 ▲▲▲


        // Edit Modal Sidebar
        elements.modalSidebar?.addEventListener('click', (e) => {
            const button = e.target.closest('.modal-nav-button');
            if (!button) return;
            elements.modalSidebar.querySelectorAll('.modal-nav-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            elements.modalMainContent.querySelectorAll('.modal-section-pane').forEach(pane => pane.classList.remove('active'));
            document.getElementById(button.dataset.target)?.classList.add('active');
        });
        new Sortable(elements.sidebarNavList, { animation: 150, ghostClass: 'sortable-ghost', filter: '.fixed-nav-button', delay: 200, delayOnTouchOnly: true });



        // Basic Info Triggers
        const setupTrigger = (trigger, title) => {
            trigger?.addEventListener('click', () => {
                const valueDisplay = trigger.querySelector('.value-display');
                if (!valueDisplay) return;

                ui.openItemEditor({
                    header: title,
                    title: title.replace('编辑', ''),
                    initialValue: valueDisplay.classList.contains('placeholder') ? '' : valueDisplay.textContent,
                    isTitleEditable: false,
                    onSave: (newValue) => {
                        valueDisplay.textContent = newValue || valueDisplay.getAttribute('data-placeholder') || '';
                        valueDisplay.classList.toggle('placeholder', !newValue);
                    }
                });
            });
        };
        setupTrigger(elements.editAgeTrigger, '编辑年龄');
        setupTrigger(elements.editRaceTrigger, '编辑种族');
        setupTrigger(elements.editOccupationTrigger, '编辑职业');
        setupTrigger(elements.editBioTrigger, '编辑简介');
        
        elements.editGenderTrigger?.addEventListener('click', () => {
            if (state.currentMode === 'YOU') return;
            const display = elements.editGenderTrigger.querySelector('.value-display');
            const currentIndex = config.GENDER_OPTIONS.indexOf(display.textContent);
            display.textContent = config.GENDER_OPTIONS[(currentIndex + 1) % config.GENDER_OPTIONS.length];
        });

        // Image Upload & Cropper
const setupImageUpload = (trigger, input, urlInput, preview) => {
    trigger?.addEventListener('click', () => input.click());
    input?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        // ▼▼▼ 旧代码 ▼▼▼
        // reader.onload = (re) => ui.openCropper(re.target.result, { urlInputElement: urlInput, previewImgElement: preview });
        // ▲▲▲▲▲▲▲▲▲▲

        // ▼▼▼ 新代码 ▼▼▼
        reader.onload = (re) => {
            // 在这里，我们把原始文件的类型 file.type 也传进去
            ui.openCropper(re.target.result, {
                urlInputElement: urlInput,
                previewImgElement: preview,
                originalMimeType: file.type // ★ 关键新增行
            });
        };
        // ▲▲▲▲▲▲▲▲▲▲
        reader.readAsDataURL(file);
        e.target.value = '';
    });
};
        setupImageUpload(elements.avatarPreviewImg, elements.avatarUploadInput, elements.avatarUrlInput, elements.avatarPreviewImg);
        setupImageUpload(elements.bannerPreviewImg, elements.bannerUploadInput, elements.bannerUrlInput, elements.bannerPreviewImg);
        elements.confirmCropBtn?.addEventListener('click', () => {
    const cropper = ui.getCropper();
    if (cropper && state.croppingContext.urlInputElement && state.croppingContext.previewImgElement) {
        
        // ▼▼▼ 旧代码 ▼▼▼
        // const dataUrl = cropper.getCroppedCanvas({ width: 512, height: 512, imageSmoothingQuality: 'high' }).toDataURL('image/png');
        // ▲▲▲▲▲▲▲▲▲▲

        // ▼▼▼ 新代码 ▼▼▼
        // 1. 从 context 获取原始 MIME 类型，如果不存在则默认为 'image/png'
        const mimeType = state.croppingContext.originalMimeType || 'image/png';
        
        // 2. toDataURL 可以接受第二个参数用于设置图片质量 (主要对 jpg/webp 有效)
        const quality = 0.9; // 0.9 是一个不错的 jpg 压缩质量

        const dataUrl = cropper.getCroppedCanvas({
            width: 512,
            height: 512,
            imageSmoothingQuality: 'high'
        }).toDataURL(mimeType, quality); // ★ 使用动态的 mimeType
        // ▲▲▲▲▲▲▲▲▲▲

        state.croppingContext.urlInputElement.value = dataUrl;
        state.croppingContext.previewImgElement.src = dataUrl;
        ui.closeCropper();
    }
});
        elements.cancelCropBtn?.addEventListener('click', ui.closeCropper);

        // Sub-Editor & Item-Editor Panels
        elements.sepBackBtn?.addEventListener('click', ui.closeSubEditor);
        elements.sepSaveBtn?.addEventListener('click', () => {
            if (typeof state.currentSaveCallback === 'function') {
                state.currentSaveCallback(elements.sepTextarea?.value.trim() || '');
            }
            ui.closeSubEditor();
        });
        elements.itemEditorBackBtn?.addEventListener('click', ui.closeItemEditor);
        elements.itemEditorSaveBtn?.addEventListener('click', () => {
            const { pane, item, onSave } = state.currentItemEditingContext;
            const title = elements.itemEditorTitleInput.value.trim();
            const value = elements.itemEditorValueTextarea.value.trim();

            if (typeof onSave === 'function') {
                onSave(value); 
            } else {
                if (!title) return alert('标题不能为空！');
                if (title.length > 10) return alert('标题不能超过10个字符！');
                if (item) {
                    item.querySelector('label').textContent = title;
                    const valueDisplay = item.querySelector('.value-display');
                    valueDisplay.textContent = value || '点击填写内容';
                    valueDisplay.classList.toggle('placeholder', !value);
                } else {
                    ui.createAndAppendCustomItem(pane, title, value);
                }
            }
            ui.closeItemEditor();
        });

        // Custom Sections Logic
        elements.modalMainContent?.addEventListener('click', (e) => {
            const pane = e.target.closest('.modal-section-pane');
            if (!pane) return;

            if (e.target.closest('.item-actions-btn')) {
                const itemGroup = e.target.closest('.custom-item-group');
                let confirmMessage = '确定要删除这个条目吗？';
                if (itemGroup && itemGroup.hasAttribute('data-rel-char-id')) {
                    confirmMessage = '确定要删除这段关系吗？';
                }
                if (confirm(confirmMessage)) {
                    itemGroup?.remove();
                }
            
            } else if (e.target.closest('.pane-title-capsule') && pane.id.startsWith('modal-section-custom-')) {
                ui.openOptionsBottomSheet(pane);
            
            } else if (e.target.closest('.add-item-btn')) {
                if (e.target.closest('.add-item-btn').id !== 'add-relationship-btn') {
                    ui.openItemEditor({ pane: pane });
                }
            
            } else if (e.target.closest('.custom-item-group')) {
                if (!e.target.closest('.custom-item-group').hasAttribute('data-rel-char-id')) {
                    ui.openItemEditor({ pane: pane, item: e.target.closest('.custom-item-group') });
                }
            }
        });

        // Add Section Sheet
        elements.addSectionBtn?.addEventListener('click', ui.openAddSectionSheet);
        elements.cancelAddSheetBtn?.addEventListener('click', ui.closeAddSectionSheet);
        elements.addSectionSheetOverlay?.addEventListener('click', (e) => e.target === elements.addSectionSheetOverlay && ui.closeAddSectionSheet());
        
        // Preset Tags in Add Section Sheet
        elements.presetTagsContainer?.addEventListener('click', (e) => {
            if (state.isLongPress) { state.isLongPress = false; return; }
            const button = e.target.closest('.preset-tag');
            if (!button) return;
            if (button.dataset.action === 'custom') {
                ui.openNamePrompt({ title: '为新栏目命名', onConfirm: handleConfirmAddSection });
            } else if (button.dataset.presetName) {
                const presetName = button.dataset.presetName;
                const isDuplicate = Array.from(elements.sidebarNavList.querySelectorAll('.modal-nav-button span')).some(span => span.textContent === presetName);
                if (isDuplicate) return alert('该栏目已存在，请勿重复添加');
                const newPane = ui.createNewSection(presetName);
                state.presetContentStore[presetName]?.forEach(item => ui.createAndAppendCustomItem(newPane, item.title, item.value || ''));
            }
            ui.closeAddSectionSheet();
        });
        elements.presetTagsContainer?.addEventListener('mousedown', handlePressStart);
        elements.presetTagsContainer?.addEventListener('touchstart', handlePressStart, { passive: true });
        ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach(evt => elements.presetTagsContainer?.addEventListener(evt, handlePressEnd));

        // Name Prompt
        elements.cancelPromptBtn?.addEventListener('click', ui.closeNamePrompt);
        elements.namePromptOverlay?.addEventListener('click', (e) => e.target === elements.namePromptOverlay && ui.closeNamePrompt());
        elements.confirmPromptBtn?.addEventListener('click', () => typeof state.currentPromptAction === 'function' && state.currentPromptAction());

        // Custom Section Options Sheet
        elements.cancelOptionsSheetBtn?.addEventListener('click', ui.closeOptionsBottomSheet);
        elements.customSectionOptionsOverlay?.addEventListener('click', (e) => e.target === elements.customSectionOptionsOverlay && ui.closeOptionsBottomSheet());
        elements.customSectionOptionsSheet?.addEventListener('click', async (e) => {
            const button = e.target.closest('.action-button');
            if (!button || !state.activeCustomPane) return;
            const action = button.dataset.action;
            const sectionName = state.activeCustomPane.querySelector('.pane-title-capsule')?.textContent;
            if (!sectionName) return;
            switch (action) {
                case 'rename': ui.openNamePrompt({ title: '重命名栏目', defaultValue: sectionName, onConfirm: handleConfirmRenameSection, element: state.activeCustomPane }); break;
                case 'save-preset':
                    if (elements.presetTagsContainer?.querySelector(`[data-preset-name="${sectionName}"]`)) return alert(`预设“${sectionName}”已存在！`);
                    const newTag = document.createElement('button');
                    newTag.className = 'preset-tag'; newTag.dataset.presetName = sectionName; newTag.textContent = sectionName;
                    elements.presetTagsContainer?.appendChild(newTag);
                    const itemsToSave = [...state.activeCustomPane.querySelectorAll('.custom-item-group')].map(item => ({ title: item.querySelector('label')?.textContent || '', value: '' }));
                    await data.savePresetContent(sectionName, itemsToSave);
                    alert(`已将“${sectionName}”保存为预设栏目！`);
                    break;
                case 'delete':
                    if (confirm('确定要删除这个栏目吗？此操作不可撤销。')) {
                        const paneId = state.activeCustomPane.id;
                        state.activeCustomPane.remove();
                        elements.sidebarNavList?.querySelector(`[data-target="${paneId}"]`)?.remove();
                        elements.sidebarNavList?.querySelector('.fixed-nav-button')?.click();
                    }
                    break;
            }
            ui.closeOptionsBottomSheet();
        });

        // 关系选择流程事件绑定
        elements.addRelationshipBtn?.addEventListener('click', async () => {
            const targetMode = state.currentMode === 'YOU' ? 'TA' : 'YOU';
            const dataKey = targetMode === 'TA' ? 'charProfileData' : 'userProfileData';
            const targetData = await data.dbStorage.getItem(dataKey);

            if (!targetData || targetData.length === 0) {
                return alert(`还没有可供选择的“${targetMode}”模式${targetMode === 'TA' ? '角色' : '用户'}，请先创建。`);
            }
            
            ui.renderCharacterSelectorList(targetData || [], state.currentProfileId);
            ui.openCharacterSelector();
        });

        // 角色选择器事件
        elements.cancelCharSelectorBtn?.addEventListener('click', ui.closeCharacterSelector);
        elements.characterSelectorOverlay?.addEventListener('click', e => e.target === elements.characterSelectorOverlay && ui.closeCharacterSelector());
        
        elements.charSearchInput?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            elements.charSelectorList.querySelectorAll('.char-selector-item').forEach(item => {
                const name = item.querySelector('.name').textContent.toLowerCase();
                item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
            });
        });

        elements.charSelectorList?.addEventListener('click', e => {
            const targetItem = e.target.closest('.char-selector-item');
            if (!targetItem) return;

            elements.charSelectorList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            targetItem.classList.add('selected');

            state.selectedCharForRel = {
                id: targetItem.dataset.charId,
                name: targetItem.querySelector('.name').textContent,
                avatar: targetItem.querySelector('.avatar').src,
            };
        });

        elements.confirmCharSelectionBtn?.addEventListener('click', () => {
            if (!state.selectedCharForRel) return alert('请选择一个角色！');
            ui.closeCharacterSelector();
            ui.openRelationshipTypeSelector();
        });

        // 关系类型选择器事件
        elements.cancelRelTypeBtn?.addEventListener('click', ui.closeRelationshipTypeSelector);
        elements.relationshipTypeOverlay?.addEventListener('click', e => e.target === elements.relationshipTypeOverlay && ui.closeRelationshipTypeSelector());
        
        elements.relationshipTypeOptions?.addEventListener('click', e => {
            const targetBtn = e.target.closest('.option-tag');
            if (!targetBtn) return;

            const selectedCount = elements.relationshipTypeOptions.querySelectorAll('.selected').length;
            const isSelected = targetBtn.classList.contains('selected');

            if (!isSelected && selectedCount >= 4) {
                alert('最多只能选择四个关系标签');
                return;
            }

            targetBtn.classList.toggle('selected');

            const type = targetBtn.dataset.type;
            if (targetBtn.classList.contains('selected')) {
                if (!state.selectedRelationshipTypes.includes(type)) {
                    state.selectedRelationshipTypes.push(type);
                }
            } else {
                state.selectedRelationshipTypes = state.selectedRelationshipTypes.filter(t => t !== type);
            }

            ui.updateRelTypeConfirmButtonState();
        });

        elements.confirmRelTypeBtn?.addEventListener('click', async () => {
            if (state.selectedRelationshipTypes.length === 0) return;
            
            const finalRelationshipTypes = state.selectedRelationshipTypes;

            ui.createAndAppendRelationshipItem(state.selectedCharForRel, finalRelationshipTypes);

            const currentProfile = state.profileData.find(p => p.id === state.currentProfileId);
            if (currentProfile) {
                if (!currentProfile.relationships) {
                    currentProfile.relationships = [];
                }
                const relExists = currentProfile.relationships.some(r => r.charId === state.selectedCharForRel.id);
                if (!relExists) {
                    currentProfile.relationships.push({
                        charId: state.selectedCharForRel.id,
                        charName: state.selectedCharForRel.name,
                        type: finalRelationshipTypes.join(' / ')
                    });
                }
                
                await data.syncReverseRelationship(currentProfile, state.selectedCharForRel, finalRelationshipTypes.join(' / '));
            }

            ui.closeRelationshipTypeSelector();
        });

        // Settings Modal
        elements.settingsCloseBtn?.addEventListener('click', ui.closeSwitcherSettingsModal);
        elements.switcherSettingsModal?.addEventListener('click', (e) => e.target === elements.switcherSettingsModal && ui.closeSwitcherSettingsModal());
        elements.settingsDeleteBtn?.addEventListener('click', data.deleteSelectedProfiles);
        elements.settingsMultiSelectBtn?.addEventListener('click', (e) => {
            state.isMultiSelectMode = !state.isMultiSelectMode;
            e.currentTarget.classList.toggle('active', state.isMultiSelectMode);
            if (!state.isMultiSelectMode) {
                elements.settingsUserList?.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
                state.selectedProfileIds = [];
                ui.updateDeleteButtonState();
            }
        });
        elements.settingsUserList?.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-profile-id]:not(.disabled)');
            if (!li) return;
            const profileId = li.dataset.profileId;
            const isSelected = state.selectedProfileIds.includes(profileId);
            if (state.isMultiSelectMode) {
                state.selectedProfileIds = isSelected ? state.selectedProfileIds.filter(id => id !== profileId) : [...state.selectedProfileIds, profileId];
                li.classList.toggle('selected', !isSelected);
            } else {
                elements.settingsUserList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
                state.selectedProfileIds = isSelected ? [] : [profileId];
                if (!isSelected) li.classList.add('selected');
            }
            ui.updateDeleteButtonState();
        });
    }

    return { bindUiSpecificEvents, bindSharedEvents };
}