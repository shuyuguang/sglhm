// 文件名: achat/chat-memory.js

import { dbStorage } from '../common/db.js';

let state = {};
let elements = {};
let memoryDbKey = '';

function openMemoryEditor(mode, index = -1, text = '') {
    elements.memoryEditorOverlay.dataset.mode = mode;
    elements.memoryEditorOverlay.dataset.index = index;
    elements.memoryEditorTextarea.value = text;

    if (mode === 'add') {
        elements.memoryEditorTitle.textContent = '添加记忆';
        elements.memoryEditorDeleteBtn.style.display = 'none';
    } else {
        elements.memoryEditorTitle.textContent = '编辑记忆';
        elements.memoryEditorDeleteBtn.style.display = 'block';
    }

    elements.memoryEditorOverlay.classList.add('active');
    elements.memoryEditorTextarea.focus();
}

function closeMemoryEditor() {
    elements.memoryEditorOverlay.classList.remove('active');
}

async function renderMemoryCards() {
    state.memories = await dbStorage.getItem(memoryDbKey) || [];
    elements.memoryCardsContainer.innerHTML = '';
    if (state.memories.length === 0) {
        elements.memoryCardsContainer.innerHTML = '<p style="text-align: center; color: var(--text-meta); font-size: 0.85em;">暂无记忆</p>';
        return;
    }
    state.memories.forEach((mem, index) => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.index = index;
        card.innerHTML = `<span class="memory-card-text">${mem}</span>`;
        elements.memoryCardsContainer.appendChild(card);
    });
}

/**
 * 初始化记忆系统的所有功能和事件监听器。
 * @param {object} domElements - 包含所有相关DOM元素的对象。
 * @param {object} chatState - 包含共享状态（如 memories 数组）的对象。
 * @param {string} dbKey - 用于存储此聊天记忆的数据库键。
 */
export function initializeMemorySystem(domElements, chatState, dbKey) {
    elements = domElements; // 直接接收完整的 elements 对象
    state = chatState;
    memoryDbKey = dbKey;

    // --- 绑定事件 ---
    if (elements.addMemoryBtn) {
        elements.addMemoryBtn.addEventListener('click', () => {
            openMemoryEditor('add');
        });
    }
    if (elements.memoryCardsContainer) {
        elements.memoryCardsContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.memory-card');
            if (card) {
                const index = parseInt(card.dataset.index, 10);
                const currentText = state.memories[index];
                openMemoryEditor('edit', index, currentText);
            }
        });
    }

    if (elements.memoryEditorOverlay) {
        elements.memoryEditorOverlay.addEventListener('click', (e) => {
            if (e.target === elements.memoryEditorOverlay) closeMemoryEditor();
        });
        elements.memoryEditorCloseBtn.addEventListener('click', closeMemoryEditor);
        elements.memoryEditorCancelBtn.addEventListener('click', closeMemoryEditor);

        elements.memoryEditorConfirmBtn.addEventListener('click', async () => {
            const mode = elements.memoryEditorOverlay.dataset.mode;
            const index = parseInt(elements.memoryEditorOverlay.dataset.index, 10);
            const newText = elements.memoryEditorTextarea.value.trim();

            if (newText === '') return;

            if (mode === 'add') {
                state.memories.push(newText);
            } else if (mode === 'edit' && index >= 0) {
                state.memories[index] = newText;
            }

            await dbStorage.setItem(memoryDbKey, state.memories);
            await renderMemoryCards();
            closeMemoryEditor();
        });

        elements.memoryEditorDeleteBtn.addEventListener('click', async () => {
            if (confirm('确定要删除这条记忆吗？')) {
                const index = parseInt(elements.memoryEditorOverlay.dataset.index, 10);
                if (index >= 0) {
                    state.memories.splice(index, 1);
                    await dbStorage.setItem(memoryDbKey, state.memories);
                    await renderMemoryCards();
                    closeMemoryEditor();
                }
            }
        });
    }

    return { renderMemoryCards };
}