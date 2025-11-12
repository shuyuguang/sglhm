// 文件名: relia-chat/chat-api.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

function blobUrlToDataUrl(blobUrl) {
    return new Promise((resolve, reject) => {
        fetch(blobUrl)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result);
                };
                reader.onerror = reject;
                // ▼▼▼ 隐藏BUG修复：之前这里错误地写成了 file ▼▼▼
                reader.readAsDataURL(blob);
                // ▲▲▲ 修复结束 ▲▲▲
            })
            .catch(reject);
    });
}

export function createApiHandler(context) {
    const {
        state, elements, character, user,
        renderSystemMessage, updateButtonStates,
        getIsAiReplying, setIsAiReplying, onHistoryUpdate,
    } = context;

    async function handleSendMessage(mode = 'new') {
        if (getIsAiReplying()) {
            console.log("AI is already replying. New request blocked.");
            return;
        }

        if (!navigator.serviceWorker) {
             alert('你的浏览器不支持后台服务，AI回复功能可能无法使用。');
             return;
        }
        
        if (!navigator.serviceWorker.controller) {
            try {
                console.warn("Service Worker controller not found. Waiting for it to become ready...");
                await navigator.serviceWorker.ready; 
                console.log("Service Worker is now ready.");
                
                if (!navigator.serviceWorker.controller) {
                    throw new Error("Service Worker is active but still not controlling the page.");
                }
            } catch (error) {
                console.error("Failed to get Service Worker ready:", error);
                alert('后台服务初始化失败，请尝试强制刷新页面 (Ctrl+Shift+R) 后重试。');
                return;
            }
        }

        if (!state.currentChatApi) {
            alert('请先点击“选择模型”按钮选择一个牵引仪模型！');
            return;
        }

        const lastMessage = state.chatHistory.length > 0 ? state.chatHistory[state.chatHistory.length - 1] : null;

        if (mode !== 'new' && !lastMessage) {
            alert('还没有聊天记录，无法触发AI。');
            return;
        }
        
        if (mode === 'regenerate' && lastMessage && lastMessage.sender !== 'character') {
             console.log("Last message is not from AI, cannot regenerate.");
             return;
        }
         if (mode === 'continue' && lastMessage && lastMessage.sender !== 'character') {
             console.log("Last message is not from AI, cannot continue.");
             return;
        }

        setIsAiReplying(true);
        updateButtonStates();
        
        const charId = character.id;
        const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;
        const thinkingMessage = { sender: 'system', type: 'loading', text: '...' };
        const currentHistory = state.chatHistory || [];
        
        let historyForSw = currentHistory;
        if (mode === 'regenerate') {
            let lastAiMsgIndex = -1;
             for (let i = currentHistory.length - 1; i >= 0; i--) {
                if (currentHistory[i].sender === 'character') {
                    lastAiMsgIndex = i;
                    break;
                }
            }
            if(lastAiMsgIndex > -1) {
                historyForSw = currentHistory.slice(0, lastAiMsgIndex);
            }
        }
        
        const historyWithThinking = [...historyForSw, thinkingMessage];
        await dbStorage.setItem(historyKey, historyWithThinking);
        onHistoryUpdate(historyWithThinking);

        try {
            const payload = {
                character,
                user,
                chatHistory: historyForSw,
                currentChatApi: state.currentChatApi,
                charId: charId,
                emojis: state.emojis || [],
                mode: mode
            };

            navigator.serviceWorker.controller.postMessage({
                type: 'FETCH_AI_REPLY',
                payload: payload
            });

        } catch (error) {
            console.error('发送任务到 Service Worker 失败:', error);
            await dbStorage.setItem(historyKey, currentHistory);
            onHistoryUpdate(currentHistory);
            renderSystemMessage(`错误: 无法连接到后台服务`, 'error', elements.chatArea);
            setIsAiReplying(false);
            updateButtonStates();
        }
    }

    return handleSendMessage;
}