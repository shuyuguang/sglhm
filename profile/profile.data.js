// profile.data.js

/**
 * 负责所有数据处理逻辑，如数据库交互、状态管理等
 */
function createDataManager(db, state, ui) {
    const dbStorage = {
        async setItem(key, value) { try { await db.keyValueStore.put({ key, value: JSON.parse(JSON.stringify(value)) }); } catch (error) { console.error(`[dbStorage] Failed to set item '${key}':`, error); } },
        async getItem(key) { try { const item = await db.keyValueStore.get(key); return item ? item.value : null; } catch (error) { console.error(`[dbStorage] Failed to get item '${key}':`, error); return null; } }
    };

    state.getDbKey = (baseKey) => `${state.currentMode === 'YOU' ? 'user' : 'char'}${baseKey.charAt(0).toUpperCase() + baseKey.slice(1)}`;
    state.getDefaultProfileId = () => state.currentMode === 'YOU' ? 'default-user-1' : 'default-char-1';

    const initializeApp = async () => {
        state.currentMode = await dbStorage.getItem(`profile${state.uiStyle}Mode`) || 'YOU';
        const loadedProfiles = await dbStorage.getItem(state.getDbKey('profileData'));

        if (loadedProfiles?.length > 0) {
            state.profileData = loadedProfiles;
        } else {
            const defaultName = state.currentMode === 'YOU' ? 'User' : 'Felotus';
            state.profileData = [{ id: state.getDefaultProfileId(), name: defaultName, gender: '♀（女）', bio: '', age: '', race: '', occupation: '', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg', banner: 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg', customSections: [] }];
            await dbStorage.setItem(state.getDbKey('profileData'), state.profileData);
        }

        state.presetContentStore = await dbStorage.getItem('globalPresetContentStore') || {};
        const presetContainer = state.elements.presetTagsContainer;
        if (presetContainer) {
            presetContainer.querySelectorAll('.preset-tag:not(.preset-tag-custom)').forEach(tag => tag.remove());
            Object.keys(state.presetContentStore).forEach(name => {
                if (!presetContainer.querySelector(`[data-preset-name="${name}"]`)) {
                    const newTag = document.createElement('button');
                    newTag.className = 'preset-tag';
                    newTag.dataset.presetName = name;
                    newTag.textContent = name;
                    presetContainer.appendChild(newTag);
                }
            });
        }

        const loadedProfileId = await dbStorage.getItem(state.getDbKey('currentProfileId'));
        state.currentProfileId = (loadedProfileId && state.profileData.some(p => p.id === loadedProfileId)) ? loadedProfileId : state.getDefaultProfileId();
        await dbStorage.setItem(state.getDbKey('currentProfileId'), state.currentProfileId);

        ui.updateUiForMode();

        if (state.uiStyle === 'YDN' && typeof state.elements.showSwitcherPage === 'function') {
            state.renderSwitcher();
            state.elements.showSwitcherPage();
        } else {
            await loadProfileData(state.currentProfileId);
        }
    };

    const loadProfileData = async (profileId) => {
        if (!state.profileData.find(p => p.id === profileId)) {
            console.warn("Profile not found, re-initializing.", profileId);
            await initializeApp();
            return;
        }
        const profile = state.profileData.find(p => p.id === profileId);
        state.currentProfileId = profileId;
        await dbStorage.setItem(state.getDbKey('currentProfileId'), profileId);

        // Update main page UI
        const { characterBannerImg, profileAvatarImg, userNameEl, genderSymbolEl, homeBioContent } = state.elements;
        if (characterBannerImg) characterBannerImg.src = profile.banner;
        if (profileAvatarImg) profileAvatarImg.src = profile.avatar;
        if (userNameEl) userNameEl.textContent = profile.name || '未命名';
        if (genderSymbolEl) genderSymbolEl.textContent = profile.gender.charAt(0);
        const bioPlaceholder = state.currentMode === 'YOU' ? '这里是用户的个人简介...' : '这里是角色的个人简介...';
        if (homeBioContent) homeBioContent.textContent = profile.bio || bioPlaceholder;

        // Update modal values
        ui.updateEditModalValues(profile);

        // Load custom sections in modal
        state.elements.modalMainContent?.querySelectorAll('.modal-section-pane[id^="modal-section-custom-"]').forEach(pane => pane.remove());
        state.elements.sidebarNavList?.querySelectorAll('.modal-nav-button:not(.fixed-nav-button)').forEach(btn => btn.remove());
        profile.customSections?.forEach(sectionData => {
            const newPane = ui.createNewSection(sectionData.title, false);
            sectionData.items?.forEach(itemData => ui.createAndAppendCustomItem(newPane, itemData.title, itemData.value));
        });

        if (typeof state.renderSwitcher === 'function') state.renderSwitcher();
        ui.renderProfileTab();
    };

    const addNewProfile = async () => {
        const isYouMode = state.currentMode === 'YOU';
        const newProfile = {
            id: `${isYouMode ? 'user' : 'char'}-${Date.now()}`,
            name: '', gender: '♀（女）', bio: '', age: '', race: '', occupation: '',
            avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg', banner: 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg',
            customSections: []
        };
        state.profileData.push(newProfile);
        await dbStorage.setItem(state.getDbKey('profileData'), state.profileData);
        
        if (state.uiStyle === 'YDN' && typeof state.elements.showProfilePage === 'function') {
            await loadProfileData(newProfile.id);
            state.elements.showProfilePage();
        } else {
            state.renderSwitcher();
            await loadProfileData(newProfile.id);
        }
    };

    const saveCurrentProfile = async () => {
        const currentProfile = state.profileData.find(p => p.id === state.currentProfileId);
        if (!currentProfile) return;

        // Extract values from modal form
        currentProfile.name = document.getElementById('edit-username')?.value || '';
        currentProfile.gender = state.currentMode === 'YOU' ? '♀（女）' : (document.getElementById('edit-gender-trigger')?.querySelector('.value-display')?.textContent || '♀（女）');
        currentProfile.avatar = document.getElementById('edit-avatar-url')?.value || '';
        currentProfile.banner = document.getElementById('edit-banner-url')?.value || '';
        const getDisplayValue = (trigger) => { const display = trigger?.querySelector('.value-display'); return (display && !display.classList.contains('placeholder')) ? display.textContent : ''; };
        currentProfile.age = getDisplayValue(state.elements.editAgeTrigger);
        currentProfile.race = getDisplayValue(state.elements.editRaceTrigger);
        currentProfile.occupation = getDisplayValue(state.elements.editOccupationTrigger);
        currentProfile.bio = getDisplayValue(state.elements.editBioTrigger);

        currentProfile.customSections = Array.from(state.elements.modalMainContent.querySelectorAll('.modal-section-pane[id^="modal-section-custom-"]'))
            .map(pane => ({
                title: pane.querySelector('.pane-title-capsule')?.textContent,
                items: Array.from(pane.querySelectorAll('.custom-item-group')).map(itemEl => ({
                    title: itemEl.querySelector('label')?.textContent,
                    value: itemEl.querySelector('.value-display:not(.placeholder)')?.textContent || ''
                }))
            }));

        // Update UI and save
        await loadProfileData(currentProfile.id); // Reload to reflect changes everywhere
        if (typeof state.onProfileSave === 'function') state.onProfileSave(currentProfile);
        await dbStorage.setItem(state.getDbKey('profileData'), state.profileData);
        ui.closeModal();
    };
    
    const deleteSelectedProfiles = async () => {
        if (state.selectedProfileIds.length === 0) return;
        const noun = state.currentMode === 'YOU' ? '用户' : '角色';
        if (!confirm(`确定要删除 ${state.selectedProfileIds.length} 个选定的${noun}吗？\n此操作不可撤销。`)) return;

        state.profileData = state.profileData.filter(p => !state.selectedProfileIds.includes(p.id));
        await dbStorage.setItem(state.getDbKey('profileData'), state.profileData);

        if (state.selectedProfileIds.includes(state.currentProfileId)) {
            if (state.uiStyle === 'YDN') {
                state.currentProfileId = null; // Will force switcher view
            } else {
                await loadProfileData(state.getDefaultProfileId());
            }
        }
        if (state.uiStyle === 'YDM') state.renderSwitcher();
        ui.closeSwitcherSettingsModal();
    };

    const savePresetContent = async (sectionName, items) => {
        state.presetContentStore[sectionName] = items;
        await dbStorage.setItem('globalPresetContentStore', state.presetContentStore);
    };

    const deletePreset = async (presetName) => {
        delete state.presetContentStore[presetName];
        await dbStorage.setItem('globalPresetContentStore', state.presetContentStore);
    };

    return {
        dbStorage, initializeApp, loadProfileData, addNewProfile, saveCurrentProfile,
        deleteSelectedProfiles, savePresetContent, deletePreset
    };
}