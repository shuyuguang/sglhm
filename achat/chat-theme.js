// 文件名: relia-chat/chat-theme.js

import { dbStorage } from '../common/db.js';

/**
 * 初始化聊天主题（背景）系统
 * @param {object} elements - 共享的DOM元素引用
 * @param {object} state - 共享的状态对象
 * @param {object} dbKeys - 包含 { bgDbKey, activeBgDbKey } 的对象
 */
export function initializeThemeSystem(elements, state, dbKeys) {
    
    function renderBackgrounds() {
        if (!elements.bgThumbnailsContainer) return;
        elements.bgThumbnailsContainer.innerHTML = '';
        // ▼▼▼ 核心修改：将默认背景颜色从固定值改为 null (透明) ▼▼▼
        const defaultBgColor = null;
        // ▲▲▲ 修改结束 ▲▲▲

        const defaultItem = document.createElement('div');
        defaultItem.className = 'bg-thumbnail-item';
        defaultItem.dataset.defaultBg = 'true';
        // ▼▼▼ 核心修改：判断 active 状态的条件变更 ▼▼▼
        if (state.activeBackground === defaultBgColor) defaultItem.classList.add('active');
        // ▲▲▲ 修改结束 ▲▲▲
        if (state.isBgMultiSelectMode) defaultItem.classList.add('disabled');
        
        const colorPreview = document.createElement('div');
        colorPreview.className = 'bg-default-preview';
        // ▼▼▼ 核心修改：预览块的背景也设为透明，CSS会为其添加边框 ▼▼▼
        colorPreview.style.backgroundColor = 'transparent';
        // ▲▲▲ 修改结束 ▲▲▲
        
        defaultItem.appendChild(colorPreview);
        elements.bgThumbnailsContainer.appendChild(defaultItem);

        state.backgrounds.forEach((bgUrl, index) => {
            const item = document.createElement('div');
            item.className = 'bg-thumbnail-item';
            item.dataset.index = index;
            if (bgUrl === state.activeBackground) item.classList.add('active');
            if (state.isBgMultiSelectMode && state.selectedBgIndices.has(index)) item.classList.add('selected');
            
            const img = document.createElement('img');
            img.src = bgUrl;
            img.alt = `背景 ${index + 1}`;
            
            const overlay = document.createElement('div');
            overlay.className = 'selection-overlay';
            overlay.innerHTML = '<i class="fa-solid fa-circle-check"></i>';

            item.appendChild(img);
            item.appendChild(overlay);
            elements.bgThumbnailsContainer.appendChild(item);
        });
    }

    async function setActiveBackground(bgUrl) {
        state.activeBackground = bgUrl;
        const container = document.querySelector('.chat-container');
        if (container) {
            if (bgUrl && bgUrl.startsWith('#')) {
                container.style.backgroundImage = '';
                container.style.backgroundColor = bgUrl;
                container.classList.remove('has-background');
            } else if (bgUrl) {
                container.style.backgroundColor = '';
                container.style.backgroundImage = `url('${bgUrl}')`;
                container.classList.add('has-background');
            } else {
                container.style.backgroundImage = '';
                container.style.backgroundColor = '';
                container.classList.remove('has-background');
            }
        }
        await dbStorage.setItem(dbKeys.activeBgDbKey, bgUrl);
        renderBackgrounds();
    }
    
    function enterBgMultiSelectMode() {
        state.isBgMultiSelectMode = true;
        state.selectedBgIndices.clear();
        elements.themeContentPane.classList.add('multi-select-mode');
        renderBackgrounds();
    }

    function exitBgMultiSelectMode() {
        state.isBgMultiSelectMode = false;
        state.selectedBgIndices.clear();
        elements.themeContentPane.classList.remove('multi-select-mode');
        renderBackgrounds();
    }
    
    // --- 事件绑定 ---
    if (elements.addBgFromLocalBtn && elements.bgUploadInput) {
        elements.addBgFromLocalBtn.addEventListener('click', () => elements.bgUploadInput.click());
        elements.bgUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    state.backgrounds.push(event.target.result);
                    await dbStorage.setItem(dbKeys.bgDbKey, state.backgrounds);
                    renderBackgrounds();
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        });
    }

    if (elements.addBgFromUrlBtn && elements.bgUrlPromptOverlay) {
        elements.addBgFromUrlBtn.addEventListener('click', () => {
            elements.bgUrlInput.value = '';
            elements.bgUrlPromptOverlay.classList.add('active');
            elements.bgUrlInput.focus();
        });
        elements.cancelBgUrlBtn.addEventListener('click', () => elements.bgUrlPromptOverlay.classList.remove('active'));
        elements.bgUrlPromptOverlay.addEventListener('click', (e) => {
             if (e.target === elements.bgUrlPromptOverlay) elements.bgUrlPromptOverlay.classList.remove('active');
        });
        elements.confirmBgUrlBtn.addEventListener('click', async () => {
            const newBgUrl = elements.bgUrlInput.value.trim();
            if (newBgUrl) {
                state.backgrounds.push(newBgUrl);
                await dbStorage.setItem(dbKeys.bgDbKey, state.backgrounds);
                renderBackgrounds();
                elements.bgUrlPromptOverlay.classList.remove('active');
            } else {
                alert('请输入有效的URL');
            }
        });
    }

    if (elements.bgThumbnailsContainer) {
        elements.bgThumbnailsContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.bg-thumbnail-item');
            if (!item) return;

            // ▼▼▼ 核心修改：点击默认背景按钮的行为统一为移除背景 ▼▼▼
            if (item.dataset.defaultBg === 'true') {
                setActiveBackground(null);
                return;
            }
            // ▲▲▲ 修改结束 ▲▲▲

            const index = parseInt(item.dataset.index, 10);
            if (isNaN(index)) return;
            
            if (state.isBgMultiSelectMode) {
                if (state.selectedBgIndices.has(index)) {
                    state.selectedBgIndices.delete(index);
                    item.classList.remove('selected');
                } else {
                    state.selectedBgIndices.add(index);
                    item.classList.add('selected');
                }
            } else {
                const clickedBgUrl = state.backgrounds[index];
                setActiveBackground(clickedBgUrl === state.activeBackground ? null : clickedBgUrl);
            }
        });
    }

    if (elements.multiSelectBgBtn) {
        elements.multiSelectBgBtn.addEventListener('click', () => {
            state.isBgMultiSelectMode ? exitBgMultiSelectMode() : enterBgMultiSelectMode();
        });
    }

    if (elements.deleteSelectedBgBtn) {
        elements.deleteSelectedBgBtn.addEventListener('click', async () => {
            if (!state.isBgMultiSelectMode || state.selectedBgIndices.size === 0) return;
            if (confirm(`确定要删除选中的 ${state.selectedBgIndices.size} 个背景吗？`)) {
                const activeBgWasDeleted = state.activeBackground && Array.from(state.selectedBgIndices).some(idx => state.backgrounds[idx] === state.activeBackground);
                state.backgrounds = state.backgrounds.filter((_, index) => !state.selectedBgIndices.has(index));
                await dbStorage.setItem(dbKeys.bgDbKey, state.backgrounds);
                if (activeBgWasDeleted) await setActiveBackground(null);
                exitBgMultiSelectMode();
            }
        });
    }

    // 暴露需要在外部调用的函数
    return { renderBackgrounds, setActiveBackground };
}