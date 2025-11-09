// relia-chat/chat-image-sender.js

let elements = {};
let onSendCallback = null;
let state = {
    activeTab: 'text-photo',
    previewData: null,
    isLoading: false
};

/**
 * 初始化图片发送面板
 * @param {object} domElements - 全局DOM元素引用
 * @param {function} onSend - 发送消息的回调函数
 */
export function initializeImageSender(domElements, onSend) {
    elements = {
        ...domElements,
        overlay: document.getElementById('image-sender-overlay'),
        closeBtn: document.getElementById('close-image-sender-btn'),
        tabs: document.querySelectorAll('.image-sender-tab'),
        panes: document.querySelectorAll('.image-sender-pane'),
        textPhotoInput: document.getElementById('text-photo-input'),
        urlPhotoInput: document.getElementById('url-photo-input'),
        localPhotoBtn: document.getElementById('local-photo-btn'),
        localPhotoInput: document.getElementById('local-photo-upload'),
        previewContainer: document.getElementById('image-preview-container'),
        previewImage: document.getElementById('image-preview-img'),
        previewPlaceholder: document.getElementById('image-preview-placeholder'),
        sendImageBtn: document.getElementById('send-image-btn')
    };
    onSendCallback = onSend;

    bindEvents();
}

export function openImageSender() {
    if (!elements.overlay) return;
    resetPanel();
    elements.overlay.classList.add('active');
    switchTab('text-photo');
}

function closeImageSender() {
    elements.overlay.classList.remove('active');
}

function resetPanel() {
    state.previewData = null;
    state.isLoading = false;
    elements.textPhotoInput.value = '';
    elements.urlPhotoInput.value = '';
    elements.localPhotoInput.value = '';
    updatePreview();
    updateSendButtonState();
}

function switchTab(tabId) {
    state.activeTab = tabId;
    elements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.target === tabId));
    elements.panes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
    resetPanel();
}

function setLoading(isLoading) {
    state.isLoading = isLoading;
    elements.previewContainer.classList.toggle('loading', isLoading);
    updateSendButtonState();
}

function updatePreview() {
    if (state.previewData) {
        elements.previewImage.src = state.previewData;
        elements.previewPlaceholder.style.display = 'none';
        elements.previewImage.style.display = 'block';
    } else {
        elements.previewPlaceholder.style.display = 'flex';
        elements.previewImage.style.display = 'none';
    }
}

function updateSendButtonState() {
    let canSend = false;
    if (state.isLoading) {
        canSend = false;
    } else {
        switch (state.activeTab) {
            case 'text-photo':
                canSend = elements.textPhotoInput.value.trim().length > 0;
                break;
            case 'url-photo':
            case 'local-photo':
                canSend = state.previewData !== null;
                break;
        }
    }
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

async function handleUrlInput() {
    const url = elements.urlPhotoInput.value.trim();
    if (!url || !url.startsWith('http')) {
        state.previewData = null;
        updatePreview();
        updateSendButtonState();
        return;
    }

    setLoading(true);
    state.previewData = null;
    updatePreview();

    try {
        // 使用代理或更安全的方式获取图片以避免CORS问题，这里简化处理
        const response = await fetch(url);
        if (!response.ok) throw new Error('无法加载图片');
        const blob = await response.blob();
        state.previewData = await fileToDataUrl(blob);
    } catch (error) {
        console.error("加载URL图片失败:", error);
        state.previewData = null;
        alert('图片链接加载失败，请检查URL或网络连接。');
    } finally {
        setLoading(false);
        updatePreview();
    }
}

async function handleLocalFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
        state.previewData = await fileToDataUrl(file);
    } catch (error) {
        console.error("加载本地图片失败:", error);
        state.previewData = null;
        alert('本地图片加载失败。');
    } finally {
        setLoading(false);
        updatePreview();
    }
}

function handleSend() {
    if (state.isLoading) return;

    let message = { sender: 'user' };
    switch (state.activeTab) {
        case 'text-photo':
            message.type = 'text-photo';
            message.text = elements.textPhotoInput.value.trim();
            break;
        case 'url-photo':
        case 'local-photo':
            message.type = 'image';
            message.data = state.previewData;
            break;
    }
    
    if (onSendCallback) {
        onSendCallback(message);
    }
    closeImageSender();
}

function bindEvents() {
    elements.overlay.addEventListener('click', e => {
        if (e.target === elements.overlay) closeImageSender();
    });
    elements.closeBtn.addEventListener('click', closeImageSender);
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.target));
    });

    elements.textPhotoInput.addEventListener('input', updateSendButtonState);
    elements.urlPhotoInput.addEventListener('input', handleUrlInput);
    elements.localPhotoBtn.addEventListener('click', () => elements.localPhotoInput.click());
    elements.localPhotoInput.addEventListener('change', handleLocalFileSelect);
    elements.sendImageBtn.addEventListener('click', handleSend);
}