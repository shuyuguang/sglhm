// 文件名: relia-chat/chat-model-selector.js

import { dbStorage } from '../common/db.js';
import { API_DB_KEYS, ALL_BUILT_IN_API_DEFINITIONS } from '../config/api.config.js';

let state = {};
let elements = {};
let selectedApiKey = '';

function renderModelList(models) {
    elements.modelListContainer.dataset.models = JSON.stringify(models);

    if (models.length === 0) {
        elements.modelListContainer.innerHTML = `<p class="no-models-message">没有可用的模型<br>请先到“牵引仪”页面启用并选择模型</p>`;
        return;
    }
    elements.modelListContainer.innerHTML = models.map(m => `
        <div class="model-item ${state.currentChatApi?.id === m.id ? 'active' : ''}" data-model-info='${JSON.stringify(m)}'>
            <div class="model-info"><div class="model-item-name">${m.model}</div><div class="model-item-api">${m.apiName}</div></div><i class="fa-solid fa-check"></i>
        </div>
    `).join('');
}

async function openModelSelector() {
    try {
        const [userConfigs, builtInData, builtInStates] = await Promise.all([
            dbStorage.getItem(API_DB_KEYS.CONFIGS).then(res => res || []),
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_DATA).then(res => res || {}),
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_STATES).then(res => res || {})
        ]);
        let availableModels = [];
        userConfigs.filter(api => api.enabled && Array.isArray(api.model) && api.model.length > 0).forEach(api => {
            api.model.forEach(modelName => {
                availableModels.push({ id: `${api.id}-${modelName}`, apiKey: api.apiKey, baseUrl: api.baseUrl, path: api.path, model: modelName, apiName: api.name });
            });
        });
        Object.keys(builtInStates).forEach(apiId => {
            const userData = builtInData[apiId];
            if (builtInStates[apiId]?.enabled && userData && Array.isArray(userData.model) && userData.model.length > 0) {
                const staticData = ALL_BUILT_IN_API_DEFINITIONS[apiId];
                if (staticData) {
                    userData.model.forEach(modelName => {
                        availableModels.push({ id: `${apiId}-${modelName}`, apiKey: userData.apiKey, baseUrl: staticData.baseUrl, path: staticData.path, model: modelName, apiName: staticData.name });
                    });
                }
            }
        });
        renderModelList(availableModels);
        elements.modelSelectorOverlay.classList.add('active');
    } catch (error) {
        console.error("打开模型选择器失败:", error);
        alert("加载模型列表失败，请检查控制台获取更多信息。");
    }
}

function closeModelSelector() {
    elements.modelSelectorOverlay?.classList.remove('active');
}

export function updateModelButtonText() {
    if (state.currentChatApi) {
        elements.selectedModelName.textContent = state.currentChatApi.model;
        elements.selectModelBtn.classList.add('active');
    } else {
        elements.selectedModelName.textContent = '选择模型';
        elements.selectModelBtn.classList.remove('active');
    }
}

export function initializeModelSelector(domElements, chatState, dbKey) {
    elements = domElements; // 直接接收完整的 elements 对象
    state = chatState;
    selectedApiKey = dbKey;

    if (elements.selectModelBtn) elements.selectModelBtn.addEventListener('click', openModelSelector);
    if (elements.modelSelectorOverlay) {
        elements.modelSelectorOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modelSelectorOverlay) closeModelSelector();
        });
    }
    if (elements.closeModelSelectorBtn) elements.closeModelSelectorBtn.addEventListener('click', closeModelSelector);
    if (elements.modelListContainer) {
        elements.modelListContainer.addEventListener('click', async (e) => {
            const item = e.target.closest('.model-item');
            if (item) {
                const modelInfo = JSON.parse(item.dataset.modelInfo);
                if (state.currentChatApi && state.currentChatApi.id === modelInfo.id) {
                    state.currentChatApi = null;
                } else {
                    state.currentChatApi = modelInfo;
                }
                await dbStorage.setItem(selectedApiKey, state.currentChatApi);
                const models = JSON.parse(item.closest('.model-list-container').dataset.models || '[]');
                renderModelList(models);
                updateModelButtonText();
                setTimeout(closeModelSelector, 200);
            }
        });
    }
}