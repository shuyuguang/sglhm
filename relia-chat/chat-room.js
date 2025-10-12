// relia-chat/chat-room.js

import { dbStorage } from '../common/db.js';
import { API_DB_KEYS } from '../config/api.config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. 获取角色ID和数据 (无变化) ---
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('id');

    if (!charId) {
        document.body.innerHTML = '<p style="text-align: center; margin-top: 50px;">错误：未指定角色ID。</p>';
        return;
    }

    const [allChars, allUsers, currentUserId] = await Promise.all([
        dbStorage.getItem(PROFILE_DB_KEYS.CHAR_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_PROFILES),
        dbStorage.getItem(PROFILE_DB_KEYS.USER_CURRENT_ID)
    ]);

    const character = allChars ? allChars.find(c => c.id === charId) : null;
    if (!character) {
        document.body.innerHTML = `<p style="text-align: center; margin-top: 50px;">错误：找不到ID为 ${charId} 的角色。</p>`;
        return;
    }
    
    const currentUser = allUsers ? allUsers.find(u => u.id === currentUserId) : null;
    const user = currentUser || { name: 'User', avatar: 'https://i.postimg.cc/7hCmXR0s/a-felotus.jpg' };

    // --- 2. 动态生成页面HTML (无变化) ---
    const modelSelectorHtml = `
        <div class="bottom-sheet-overlay" id="model-selector-overlay">
            <div class="bottom-sheet">
                <div class="bottom-sheet-header">选择牵引仪模型</div>
                <div class="model-list-container" id="model-list-container">
                    <!-- 模型列表将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;

    const pageHtml = `
        <div class="chat-container">
            <header class="chat-header">
                <a href="./relia-chat.html" class="chat-header-btn back-btn"><i class="fa-solid fa-chevron-left"></i></a>
                <div class="char-info">
                    <img src="${character.avatar}" alt="${character.name}" class="char-info-avatar">
                    <div class="char-info-text">
                        <span class="char-info-name">${character.name || '未命名'}</span>
                        <span class="char-info-status">在线</span>
                    </div>
                </div>
                <a href="./chat-setting.html?id=${charId}" class="chat-header-btn options-btn"><i class="fa-solid fa-ellipsis-vertical"></i></a>
            </header>
            <main class="chat-messages" id="chat-messages-area"></main>
            <footer class="chat-input-area" id="chat-input-area">
                <div class="chat-input-main" id="chat-input-main">
                    <div class="chat-input-wrapper" id="chat-input-wrapper">
                        <textarea id="chat-input" placeholder="点击输入消息..." rows="1"></textarea>
                        <div class="send-buttons-container" id="send-buttons-container">
                            <button id="respond-btn" class="send-action-btn">响应</button>
                            <button id="send-btn" class="send-action-btn primary">发送</button>
                        </div>
                    </div>
                    <div class="chat-input-controls">
                        <button id="actions-toggle-btn"><i class="fa-solid fa-plus"></i></button>
                        <button id="model-toggle-btn"><i class="fa-solid fa-link"></i></button>
                        <button id="prompt-btn"><i class="fa-solid fa-bolt"></i></button>
                        <button id="inspiration-btn"><i class="fa-regular fa-lightbulb"></i></button>
                        <button id="emoji-toggle-btn"><i class="fa-regular fa-face-smile"></i></button>
                    </div>
                </div>
                <div class="chat-actions-bar">
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-image"></i></button><span>图片</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-camera"></i></button><span>拍照</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-microphone"></i></button><span>音频</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-palette"></i></button><span>主题</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-money-bill-transfer"></i></button><span>转账</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-gift"></i></button><span>礼物</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-phone"></i></button><span>通话</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-location-dot"></i></button><span>位置</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-save"></i></button><span>存档</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-file"></i></button><span>文件</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-list-check"></i></button><span>DIY</span></div>
                    <div class="action-item"><button class="action-btn"><i class="fa-solid fa-music"></i></button><span>音乐</span></div>
                </div>
                <div class="emoji-picker-bar">
                    <div class="emoji-placeholder">表情面板功能待开发...</div>
                </div>
            </footer>
        </div>
        ${modelSelectorHtml}
    `;
    document.body.innerHTML = pageHtml;

    // --- 3. 获取DOM元素和定义变量 (无变化) ---
    const chatArea = document.getElementById('chat-messages-area');
    const input = document.getElementById('chat-input');
    // optionsBtn 现在是 a 标签，所以事件监听器在下面修改
    const chatInputArea = document.getElementById('chat-input-area');
    const actionsToggleBtn = document.getElementById('actions-toggle-btn');
    const emojiToggleBtn = document.getElementById('emoji-toggle-btn');
    const sendButtonsContainer = document.getElementById('send-buttons-container');
    const sendBtn = document.getElementById('send-btn');
    const respondBtn = document.getElementById('respond-btn');
    const modelToggleBtn = document.getElementById('model-toggle-btn');
    const modelSelectorOverlay = document.getElementById('model-selector-overlay');
    const modelListContainer = document.getElementById('model-list-container');
    const promptBtn = document.getElementById('prompt-btn');
    const inspirationBtn = document.getElementById('inspiration-btn');
    
    let currentChatApi = null;
    const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
    let chatHistory = [];

    // ▼▼▼ 新增/修改开始 ▼▼▼

    // --- 4. 核心功能函数 (有重大修改) ---

    /**
     * 构建扮演角色的系统指令 (System Prompt)
     * @param {object} charProfile - 角色信息对象
     * @param {object} userProfile - 用户信息对象
     * @returns {string} - 构建好的系统指令字符串
     */
    function constructSystemPrompt(charProfile, userProfile) {
        let prompt = `你正在扮演一个角色，你需要严格按照以下设定进行对话。\n\n`;
        prompt += `### 角色设定\n`;
        prompt += `- 名字: ${charProfile.name || '未命名'}\n`;
        if (charProfile.gender) prompt += `- 性别: ${charProfile.gender}\n`;
        if (charProfile.age) prompt += `- 年龄: ${charProfile.age}\n`;
        if (charProfile.race) prompt += `- 种族: ${charProfile.race}\n`;
        if (charProfile.occupation) prompt += `- 职业: ${charProfile.occupation}\n`;
        if (charProfile.bio) prompt += `- 简介: ${charProfile.bio}\n`;

        if (charProfile.customSections && charProfile.customSections.length > 0) {
            charProfile.customSections.forEach(section => {
                const itemsWithContent = section.items.filter(item => item.value?.trim());
                if (itemsWithContent.length > 0) {
                    prompt += `\n#### ${section.title}\n`;
                    itemsWithContent.forEach(item => {
                        prompt += `- ${item.title}: ${item.value}\n`;
                    });
                }
            });
        }
        
        prompt += `\n### 对话者信息\n`;
        prompt += `- 对方名字: ${userProfile.name || 'User'}\n`;
        
        prompt += `\n### 扮演要求\n`;
        prompt += `- 你必须完全沉浸在 **${charProfile.name}** 的角色中，用TA的身份、口吻、性格和知识进行回复。\n`;
        prompt += `- 不要暴露你是AI模型或程序，不要提及“扮演”或“角色设定”。\n`;
        prompt += `- 你的回复应该是自然的、符合角色的，就像TA真的在和 **${userProfile.name}** 聊天一样。`;

        return prompt;
    }

    /**
     * 将我们的聊天历史格式化为 OpenAI API 兼容的格式
     * @param {Array} history - 聊天历史数组
     * @returns {Array} - 格式化后的消息数组
     */
    function formatChatHistoryForApi(history) {
        return history.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    function renderMessage({ text, sender }) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${sender}`;
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        avatar.src = (sender === 'user') ? user.avatar : character.avatar;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = text;
        messageRow.appendChild(avatar);
        messageRow.appendChild(bubble);
        chatArea.appendChild(messageRow);
        chatArea.scrollTop = chatArea.scrollHeight;
        return bubble; // 返回创建的 bubble 元素，用于流式更新
    }

    // 新增：用于显示加载中、错误等系统消息
    function renderSystemMessage(text, type = 'loading') {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row system ${type}`;
        messageRow.innerHTML = `<div class="chat-bubble system">${text}</div>`;
        chatArea.appendChild(messageRow);
        chatArea.scrollTop = chatArea.scrollHeight;
        return messageRow;
    }
    
    async function loadAndRenderHistory() {
        const savedHistory = await dbStorage.getItem(historyKey);
        if (savedHistory && Array.isArray(savedHistory) && savedHistory.length > 0) {
            chatHistory = savedHistory;
            chatHistory.forEach(message => renderMessage(message));
        } else {
            // 首次进入时，可以不显示示例，或者显示一个欢迎语
            renderSystemMessage(`你现在正在和 ${character.name} 聊天`, 'info');
        }
    }

    /**
     * 【核心改造】处理发送消息的函数，现在会调用 AI API
     * @param {string} actionType - '发送' 或 '响应'
     */
    async function handleSendMessage(actionType = 'send') {
        const text = input.value.trim();
        if (text === '') return;

        // 1. 检查是否选择了 API 模型
        if (!currentChatApi) {
            alert('请先点击左下角的“链接”图标选择一个牵引仪模型！');
            return;
        }

        // 2. 立即在界面上显示用户消息并保存
        const userMessage = { text, sender: 'user' };
        renderMessage(userMessage);
        chatHistory.push(userMessage);
        await dbStorage.setItem(historyKey, chatHistory);
        input.value = '';
        input.style.height = '';
        input.focus();
        
        // 禁用发送按钮，防止重复发送
        sendBtn.disabled = true;
        respondBtn.disabled = true;

        // 3. 准备 API 请求
        const systemPrompt = constructSystemPrompt(character, user);
        const historyForApi = formatChatHistoryForApi(chatHistory);
        
        const messages = [
            { role: 'system', content: systemPrompt },
            ...historyForApi
        ];

        const endpoint = (currentChatApi.baseUrl.replace(/\/$/, '')) + (currentChatApi.path || '/v1/chat/completions');
        const payload = {
            model: currentChatApi.model,
            messages: messages,
            stream: true // 开启流式响应
        };

        // 4. 创建一个空的 AI 回复气泡用于填充
        const thinkingBubble = renderMessage({ text: '...', sender: 'character' });
        let fullReply = '';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentChatApi.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API 请求失败，状态码: ${response.status}`);
            }

            // 5. 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            thinkingBubble.textContent = ''; // 清空"..."

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr === '[DONE]') break;
                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content;
                            if (content) {
                                fullReply += content;
                                thinkingBubble.textContent = fullReply;
                                chatArea.scrollTop = chatArea.scrollHeight;
                            }
                        } catch (e) {
                            // 忽略无法解析的行
                        }
                    }
                }
            }

            // 6. 流式响应结束后，保存完整的 AI 回复
            if (fullReply) {
                const replyMessage = { text: fullReply, sender: 'character' };
                chatHistory.push(replyMessage);
                await dbStorage.setItem(historyKey, chatHistory);
            }

        } catch (error) {
            console.error('AI 回复生成失败:', error);
            renderSystemMessage(`错误: ${error.message}`, 'error');
            thinkingBubble.remove(); // 移除不完整的思考气泡
        } finally {
            // 重新启用发送按钮
            sendBtn.disabled = false;
            respondBtn.disabled = false;
            input.focus();
        }
    }
    
    async function openModelSelector() {
        // ... 此函数无变化 ...
        const [userConfigs, builtInData, builtInStates] = await Promise.all([
            dbStorage.getItem(API_DB_KEYS.CONFIGS) || [],
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_DATA) || {},
            dbStorage.getItem(API_DB_KEYS.BUILT_IN_STATES) || {}
        ]);

        let availableModels = [];

        userConfigs
            .filter(api => api.enabled && api.model?.length > 0)
            .forEach(api => {
                api.model.forEach(modelName => {
                    availableModels.push({
                        id: `${api.id}-${modelName}`,
                        apiId: api.id,
                        apiKey: api.apiKey,
                        baseUrl: api.baseUrl,
                        path: api.path,
                        model: modelName,
                        apiName: api.name,
                    });
                });
            });
        
        Object.keys(builtInStates)
            .filter(apiId => builtInStates[apiId]?.enabled && builtInData[apiId]?.model?.length > 0)
            .forEach(apiId => {
                const apiData = builtInData[apiId];
                const builtInConfig = ALL_BUILT_IN_API_DEFINITIONS[apiId];
                apiData.model.forEach(modelName => {
                     availableModels.push({
                        id: `${apiId}-${modelName}`,
                        apiId: apiId,
                        apiKey: apiData.apiKey,
                        baseUrl: builtInConfig.baseUrl, 
                        path: builtInConfig.path,
                        model: modelName,
                        apiName: builtInConfig.name,
                    });
                });
            });

        renderModelList(availableModels);
        modelSelectorOverlay.classList.add('active');
    }

    function renderModelList(models) {
        // ... 此函数无变化 ...
        if (models.length === 0) {
            modelListContainer.innerHTML = `<p class="no-models-message">没有可用的模型<br>请先到“牵引仪”页面启用并选择模型</p>`;
            return;
        }

        modelListContainer.innerHTML = models.map(m => `
            <div class="model-item ${currentChatApi?.id === m.id ? 'active' : ''}" data-model-info='${JSON.stringify(m)}'>
                <div class="model-info">
                    <div class="model-item-name">${m.model}</div>
                    <div class="model-item-api">${m.apiName}</div>
                </div>
                <i class="fa-solid fa-check"></i>
            </div>
        `).join('');
    }

    const expandInputLayout = () => {
        // ... 此函数无变化 ...
        if (!chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.add('input-focused');
            sendButtonsContainer.classList.add('visible');
        }
    };

    const collapseInputLayout = () => {
        // ... 此函数无变化 ...
        if (chatInputArea.classList.contains('input-focused')) {
            chatInputArea.classList.remove('input-focused');
            sendButtonsContainer.classList.remove('visible');
        }
        chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    };

    // ▲▲▲ 新增/修改结束 ▲▲▲


    // --- 5. 绑定事件 (有微小修改) ---
    input.addEventListener('input', () => {
        if (input.value.trim() === '') {
            input.style.height = '';
        } else {
            input.style.height = 'auto';
            input.style.height = (input.scrollHeight) + 'px';
        }
    });

    if (sendBtn) sendBtn.addEventListener('click', () => handleSendMessage('发送'));
    if (respondBtn) respondBtn.addEventListener('click', () => handleSendMessage('响应'));
    
    // optionsBtn 现在是 a 标签，不再需要 JS 事件监听器
    // if (optionsBtn) optionsBtn.addEventListener('click', () => { window.location.href = `./chat-setting.html?id=${charId}`; });

    if (actionsToggleBtn) actionsToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('emoji-expanded'); chatInputArea.classList.toggle('actions-expanded'); });
    if (emojiToggleBtn) emojiToggleBtn.addEventListener('click', (e) => { e.stopPropagation(); chatInputArea.classList.remove('actions-expanded'); chatInputArea.classList.toggle('emoji-expanded'); });
    if (modelToggleBtn) modelToggleBtn.addEventListener('click', openModelSelector);
    
    if (promptBtn) {
        promptBtn.addEventListener('click', () => {
            alert('“快捷指令（闪电）”功能待开发');
        });
    }
    if (inspirationBtn) {
        inspirationBtn.addEventListener('click', () => {
            alert('“灵感（灯泡）”功能待开发');
        });
    }

    if (modelSelectorOverlay) {
        modelSelectorOverlay.addEventListener('click', (e) => {
            if (e.target === modelSelectorOverlay) {
                modelSelectorOverlay.classList.remove('active');
            }
        });
    }
    if (modelListContainer) {
        modelListContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.model-item');
            if (item) {
                const modelInfo = JSON.parse(item.dataset.modelInfo);
                if (currentChatApi && currentChatApi.id === modelInfo.id) {
                    currentChatApi = null;
                    item.classList.remove('active');
                } else {
                    currentChatApi = modelInfo;
                    const currentActive = modelListContainer.querySelector('.model-item.active');
                    if (currentActive) currentActive.classList.remove('active');
                    item.classList.add('active');
                }
                console.log('当前选择的API:', currentChatApi);
                setTimeout(() => modelSelectorOverlay.classList.remove('active'), 200);
            }
        });
    }

    input.addEventListener('focus', () => {
        expandInputLayout();
        chatInputArea.classList.remove('actions-expanded', 'emoji-expanded');
    });

    document.addEventListener('click', (event) => {
        if (!chatInputArea.contains(event.target)) {
            collapseInputLayout();
        }
    });

    // --- 6. 初始化页面 (无变化) ---
    await loadAndRenderHistory();
});