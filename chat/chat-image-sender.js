// relia-chat/chat-image-sender.js

let elements = {};
let onSendCallback = null;
let state = {
    // ▼▼▼ 核心重构：从单个状态变为队列和当前选项 ▼▼▼
    activeOption: 'text-photo',
    imagesToSend: [], // { type: 'text-photo'/'image', content: '...' }
    isLoading: false
    // ▲▲▲ 重构结束 ▲▲▲
};

export function initializeImageSender(domElements, onSend) {
    elements = {
        ...domElements,
        overlay: document.getElementById('image-sender-overlay'),
        closeBtn: document.getElementById('close-image-sender-btn'),
        // ▼▼▼ 核心重构：获取新UI元素 ▼▼▼
        optionRows: document.querySelectorAll('.option-row'),
        textPhotoInput: document.getElementById('text-photo-input'),
        urlPhotoInput: document.getElementById('url-photo-input'),
        localPhotoBtn: document.getElementById('local-photo-btn'),
        localPhotoInput: document.getElementById('local-photo-upload'),
        addTextBtn: document.getElementById('add-text-photo-btn'),
        addUrlBtn: document.getElementById('add-url-photo-btn'),
        addLocalBtn: document.getElementById('add-local-photo-btn'),
        multiPreviewContainer: document.getElementById('image-multi-preview-container'),
        multiPreviewPlaceholder: document.getElementById('image-multi-preview-placeholder'),
        sendImageBtn: document.getElementById('send-image-btn')
        // ▲▲▲ 重构结束 ▲▲▲
    };
    onSendCallback = onSend;
    bindEvents();
}

export function openImageSender() {
    if (!elements.overlay) return;
    resetPanel();
    elements.overlay.classList.add('active');
    switchOption('text-photo');
}

function closeImageSender() {
    elements.overlay.classList.remove('active');
}

function resetPanel() {
    state.imagesToSend = [];
    state.isLoading = false;
    elements.textPhotoInput.value = '';
    elements.urlPhotoInput.value = '';
    elements.localPhotoInput.value = '';
    updatePreview();
    updateSendButtonState();
}

// ▼▼▼ 核心重构：新的选项切换逻辑 ▼▼▼
function switchOption(optionId) {
    state.activeOption = optionId;
    elements.optionRows.forEach(row => {
        row.classList.toggle('active', row.dataset.option === optionId);
    });
}
// ▲▲▲ 重构结束 ▲▲▲

function setLoading(isLoading) {
    state.isLoading = isLoading;
    // 未来可以添加全局加载指示器
}

// ▼▼▼ 核心重构：渲染多图预览 ▼▼▼
function updatePreview() {
    elements.multiPreviewContainer.innerHTML = '';
    if (state.imagesToSend.length > 0) {
        elements.multiPreviewPlaceholder.style.display = 'none';
        state.imagesToSend.forEach((item, index) => {
            const thumb = document.createElement('div');
            thumb.className = 'preview-thumbnail';

            if (item.type === 'text-photo') {
                thumb.innerHTML = `<span class="preview-thumbnail-text">${item.text}</span>`;
            } else if (item.type === 'image') {
                thumb.innerHTML = `<img src="${item.data}" alt="预览">`;
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'preview-thumbnail-remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                state.imagesToSend.splice(index, 1);
                updatePreview();
                updateSendButtonState();
            };
            thumb.appendChild(removeBtn);
            elements.multiPreviewContainer.appendChild(thumb);
        });
    } else {
        elements.multiPreviewPlaceholder.style.display = 'flex';
    }
}
// ▲▲▲ 重构结束 ▲▲▲

function updateSendButtonState() {
    const canSend = state.imagesToSend.length > 0;
    elements.sendImageBtn.disabled = !canSend;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ▼▼▼ 核心重构：处理添加图片的逻辑 ▼▼▼
function handleAddText() {
    const text = elements.textPhotoInput.value.trim();
    if (!text) return;
    state.imagesToSend.push({ type: 'text-photo', text: text });
    elements.textPhotoInput.value = '';
    updatePreview();
    updateSendButtonState();
}

async function handleAddUrl() {
    const url = elements.urlPhotoInput.value.trim();
    if (!url || !url.startsWith('http')) return;

    setLoading(true);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('无法加载图片');
        const blob = await response.blob();
        const dataUrl = await fileToDataUrl(blob);
        state.imagesToSend.push({ type: 'image', data: dataUrl });
        elements.urlPhotoInput.value = '';
        updatePreview();
        updateSendButtonState();
    } catch (error) {
        console.error("加载URL图片失败:", error);
        alert('图片链接加载失败，请检查URL或网络连接。');
    } finally {
        setLoading(false);
    }
}

async function handleAddLocal(file) {
    if (!file) return;
    setLoading(true);
    try {
        const dataUrl = await fileToDataUrl(file);
        state.imagesToSend.push({ type: 'image', data: dataUrl });
        updatePreview();
        updateSendButtonState();
    } catch (error) {
        console.error("加载本地图片失败:", error);
        alert('本地图片加载失败。');
    } finally {
        setLoading(false);
    }
}
// ▲▲▲ 重构结束 ▲▲▲

function handleSend() {
    if (state.imagesToSend.length === 0) return;

    if (onSendCallback) {
        state.imagesToSend.forEach(item => {
            const message = { sender: 'user', ...item };
            onSendCallback(message);
        });
    }
    closeImageSender();
}

function bindEvents() {
    elements.overlay.addEventListener('click', e => {
        if (e.target === elements.overlay) closeImageSender();
    });
    elements.closeBtn.addEventListener('click', closeImageSender);
    elements.sendImageBtn.addEventListener('click', handleSend);

    // ▼▼▼ 核心重构：新的事件绑定 ▼▼▼
    elements.optionRows.forEach(row => {
        const optionId = row.dataset.option;
        // 点击整行或单选框切换
        row.querySelector('.radio-control').addEventListener('click', () => switchOption(optionId));
        // 点击输入框或按钮时，自动切换到该选项
        row.querySelector('.option-input').addEventListener('focus', () => switchOption(optionId));
        row.querySelector('.option-input').addEventListener('click', () => switchOption(optionId));
    });

    elements.addTextBtn.addEventListener('click', handleAddText);
    elements.addUrlBtn.addEventListener('click', handleAddUrl);
    elements.addLocalBtn.addEventListener('click', () => elements.localPhotoInput.click());
    elements.localPhotoInput.addEventListener('change', e => handleAddLocal(e.target.files[0]));
    // ▲▲▲ 重构结束 ▲▲▲
}