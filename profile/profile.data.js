// profile.data.js
import { PROFILE_DB_KEYS } from '../config/profile.config.js';

/**
 * 负责所有数据处理逻辑，如数据库交互、状态管理等
 */
export function createDataManager(db, state, ui) {
    const dbStorage = {
        async setItem(key, value) { try { await db.keyValueStore.put({ key, value: JSON.parse(JSON.stringify(value)) }); } catch (error) { console.error(`[dbStorage] Failed to set item '${key}':`, error); } },
        async getItem(key) { try { const item = await db.keyValueStore.get(key); return item ? item.value : null; } catch (error) { console.error(`[dbStorage] Failed to get item '${key}':`, error); return null; } }
    };

    // ▼▼▼【BUG修复】▼▼▼
    // 补上缺失的辅助函数，用于从 .value-display 元素中安全地获取值
    const getDisplayValue = (trigger) => {
        if (!trigger) return '';
        const display = trigger.querySelector('.value-display');
        // 如果 display 元素不存在，或者它带有 placeholder 类，则返回空字符串
        if (!display || display.classList.contains('placeholder')) {
            return '';
        }
        return display.textContent.trim();
    };
    // ▲▲▲【修复结束】▲▲▲

    // ▼▼▼【核心修改 1/4】：不再使用 getDbKey 函数，直接从配置中获取键名 ▼▼▼
    const getProfileDataKey = () => state.currentMode === 'YOU' ? PROFILE_DB_KEYS.USER_PROFILES : PROFILE_DB_KEYS.CHAR_PROFILES;
    const getCurrentIdKey = () => state.currentMode === 'YOU' ? PROFILE_DB_KEYS.USER_CURRENT_ID : PROFILE_DB_KEYS.CHAR_CURRENT_ID;
    const getModeKey = () => state.uiStyle === 'YDN' ? PROFILE_DB_KEYS.YDN_MODE : PROFILE_DB_KEYS.YDM_MODE;
    
    state.getDefaultProfileId = () => state.currentMode === 'YOU' ? 'default-user-1' : 'default-char-1';

    const initializeApp = async () => {
        // ▼▼▼【核心修改 2/4】：使用新的函数获取键名 ▼▼▼
        state.currentMode = await dbStorage.getItem(getModeKey()) || 'YOU';
        const loadedProfiles = await dbStorage.getItem(getProfileDataKey());

        if (loadedProfiles?.length > 0) {
            state.profileData = loadedProfiles;
        } else {
            const defaultName = state.currentMode === 'YOU' ? 'User' : 'Felotus';
            state.profileData = [{ id: state.getDefaultProfileId(), name: defaultName, gender: '♀（女）', bio: '', age: '', race: '', occupation: '', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg', banner: 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg', customSections: [], relationships: [] }];
            await dbStorage.setItem(getProfileDataKey(), state.profileData);
        }

        state.presetContentStore = await dbStorage.getItem(PROFILE_DB_KEYS.PRESETS) || {};
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

        const loadedProfileId = await dbStorage.getItem(getCurrentIdKey());
        state.currentProfileId = (loadedProfileId && state.profileData.some(p => p.id === loadedProfileId)) ? loadedProfileId : state.getDefaultProfileId();
        await dbStorage.setItem(getCurrentIdKey(), state.currentProfileId);
        // ▲▲▲【修改结束】▲▲▲

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
        await dbStorage.setItem(getCurrentIdKey(), profileId); // 使用配置键

        const { characterBannerImg, profileAvatarImg, userNameEl, genderSymbolEl, homeBioContent } = state.elements;
        if (characterBannerImg) characterBannerImg.src = profile.banner;
        if (profileAvatarImg) profileAvatarImg.src = profile.avatar;
        if (userNameEl) userNameEl.textContent = profile.name || '未命名';
        if (genderSymbolEl) genderSymbolEl.textContent = profile.gender.charAt(0);
        const bioPlaceholder = state.currentMode === 'YOU' ? '这里是用户的个人简介...' : '这里是角色的个人简介...';
        if (homeBioContent) homeBioContent.textContent = profile.bio || bioPlaceholder;

        ui.updateEditModalValues(profile);

        state.elements.modalMainContent?.querySelectorAll('.modal-section-pane[id^="modal-section-custom-"]').forEach(pane => pane.remove());
        state.elements.sidebarNavList?.querySelectorAll('.modal-nav-button:not(.fixed-nav-button)').forEach(btn => btn.remove());
        profile.customSections?.forEach(sectionData => {
            const newPane = ui.createNewSection(sectionData.title, false);
            sectionData.items?.forEach(itemData => ui.createAndAppendCustomItem(newPane, itemData.title, itemData.value));
        });

        const relationshipContainer = state.elements.relationshipItemsContainer;
        if (relationshipContainer) relationshipContainer.innerHTML = '';
        if (profile.relationships && profile.relationships.length > 0) {
            // ▼▼▼【核心修改 3/4】：使用配置键获取关联数据 ▼▼▼
            const relatedProfileKey = state.currentMode === 'YOU' ? PROFILE_DB_KEYS.CHAR_PROFILES : PROFILE_DB_KEYS.USER_PROFILES;
            const relatedData = await dbStorage.getItem(relatedProfileKey) || [];
            // ▲▲▲【修改结束】▲▲▲
            const relatedMap = new Map(relatedData.map(c => [c.id, c]));

            profile.relationships.forEach(rel => {
                const character = relatedMap.get(rel.charId) || { id: rel.charId, name: rel.charName || '未知角色', avatar: '' };
                const relationshipTypesArray = rel.type ? rel.type.split(' / ') : [];
                ui.createAndAppendRelationshipItem(character, relationshipTypesArray);
            });
        }

        if (typeof state.renderSwitcher === 'function') state.renderSwitcher();
        ui.renderProfileTab();
    };

    const addNewProfile = async () => {
        const isYouMode = state.currentMode === 'YOU';
        const newProfile = {
            id: `${isYouMode ? 'user' : 'char'}-${Date.now()}`,
            name: '', gender: '♀（女）', bio: '', age: '', race: '', occupation: '',
            avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg', banner: 'https://i.postimg.cc/NjRJ5qdx/a-good.jpg',
            customSections: [], relationships: []
        };
        state.profileData.push(newProfile);
        await dbStorage.setItem(getProfileDataKey(), state.profileData); // 使用配置键
        
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

        currentProfile.name = document.getElementById('edit-username')?.value || '';
        currentProfile.avatar = state.elements.avatarUrlInput.value;
        currentProfile.banner = state.elements.bannerUrlInput.value;
        currentProfile.gender = state.elements.editGenderTrigger.querySelector('.value-display').textContent;
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
        
        if (state.elements.relationshipItemsContainer) {
            currentProfile.relationships = Array.from(state.elements.relationshipItemsContainer.querySelectorAll('.custom-item-group'))
                .map(itemEl => ({
                    charId: itemEl.dataset.relCharId,
                    charName: itemEl.dataset.relCharName,
                    type: itemEl.dataset.relType
                }));
        }

        await loadProfileData(currentProfile.id);
        if (typeof state.onProfileSave === 'function') state.onProfileSave(currentProfile);
        await dbStorage.setItem(getProfileDataKey(), state.profileData); // 使用配置键
        ui.closeModal();
    };
    
    const syncReverseRelationship = async (sourceProfile, targetProfileData, relationshipType) => {
        // ▼▼▼【核心修改 4/4】：使用配置键获取目标数据 ▼▼▼
        const targetDbKey = state.currentMode === 'YOU' ? PROFILE_DB_KEYS.CHAR_PROFILES : PROFILE_DB_KEYS.USER_PROFILES;
        const targetDataSet = await dbStorage.getItem(targetDbKey) || [];
        // ▲▲▲【修改结束】▲▲▲
        const target = targetDataSet.find(p => p.id === targetProfileData.id);
        if (!target) {
            console.error(`反向关系同步失败: 找不到ID为 ${targetProfileData.id} 的目标。`);
            return;
        }
        if (!target.relationships) {
            target.relationships = [];
        }
        const reverseRelExists = target.relationships.some(r => r.charId === sourceProfile.id);
        if (!reverseRelExists) {
            target.relationships.push({
                charId: sourceProfile.id,
                charName: sourceProfile.name,
                type: relationshipType
            });
            await dbStorage.setItem(targetDbKey, targetDataSet); // 使用配置键
        }
    };

    const deleteSelectedProfiles = async () => {
        if (state.selectedProfileIds.length === 0) return;
        const noun = state.currentMode === 'YOU' ? '用户' : '角色';
        if (!confirm(`确定要删除 ${state.selectedProfileIds.length} 个选定的${noun}吗？\n此操作不可撤销。`)) return;

        state.profileData = state.profileData.filter(p => !state.selectedProfileIds.includes(p.id));
        await dbStorage.setItem(getProfileDataKey(), state.profileData); // 使用配置键

        if (state.selectedProfileIds.includes(state.currentProfileId)) {
            if (state.uiStyle === 'YDN') {
                state.currentProfileId = null; 
            } else {
                await loadProfileData(state.getDefaultProfileId());
            }
        }
        if (state.uiStyle === 'YDM') state.renderSwitcher();
        ui.closeSwitcherSettingsModal();
    };

    const savePresetContent = async (sectionName, items) => {
        state.presetContentStore[sectionName] = items;
        await dbStorage.setItem(PROFILE_DB_KEYS.PRESETS, state.presetContentStore); // 使用配置键
    };

    const deletePreset = async (presetName) => {
        delete state.presetContentStore[presetName];
        await dbStorage.setItem(PROFILE_DB_KEYS.PRESETS, state.presetContentStore); // 使用配置键
    };

    return {
        dbStorage, initializeApp, loadProfileData, addNewProfile, saveCurrentProfile,
        syncReverseRelationship,
        deleteSelectedProfiles, savePresetContent, deletePreset
    };
}