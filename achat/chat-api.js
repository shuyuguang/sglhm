// 文件名: relia-chat/chat-api.js

import { dbStorage } from '../common/db.js';
import { CHAT_DB_KEYS } from '../config/chat.config.js';

// --- Helper Functions (保留，以防其他地方需要) ---

function isImageUrl(url) {
    if (typeof url !== 'string') return false;
    return url.toLowerCase().startsWith('http') && /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
}

function isBase64(str) {
    if (typeof str !== 'string' || !str) return false;
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    return str.length > 50 && str.length % 4 === 0 && base64Regex.test(str);
}

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
                reader.readAsDataURL(blob);
            })
            .catch(reject);
    });
}

// 注意：AI回复解析逻辑已移至 sw.js，此处保留可能会造成混淆，因此注释掉
/*
function parseAiReply(fullReply, emojis) {
    // ...
}
async function universalStreamHandler(context) {
    // ...
}
*/

// --- Core API Logic (现在是委托逻辑) ---

export function createApiHandler(context) {
    const {
        state, elements, character, user,
        renderSystemMessage, updateButtonStates,
        getIsAiReplying, setIsAiReplying, onHistoryUpdate, // onAiReply 替换为更通用的 onHistoryUpdate
    } = context;

    /**
     * 将AI请求任务委托给Service Worker
     * @param {string} mode - 'new', 'regenerate', 'continue'
     */
    async function handleSendMessage(mode = 'new') {
        if (getIsAiReplying()) {
            console.log("AI is already replying. New request blocked.");
            return;
        }

        if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
            alert('后台服务尚未准备就绪，请稍后重试或刷新页面。');
            return;
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
        if (mode === 'new' && lastMessage && lastMessage.sender !== 'user') {
            console.log("AI can only respond after a user message.");
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

        // 立即进入“思考中”状态
        setIsAiReplying(true);
        updateButtonStates();
        
        const charId = character.id;
        const historyKey = `${CHAT_DB_KEYS.CHAT_HISTORY}_${charId}`;

        // 创建一个“思考中”的占位消息，并立即存入数据库
        const thinkingMessage = { sender: 'system', type: 'loading', text: '...' };
        const currentHistory = state.chatHistory || [];
        
        let historyForSw = currentHistory;
        // 如果是重新生成，不应包含最后的AI回复
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
        
        // 更新UI并保存到DB
        const historyWithThinking = [...historyForSw, thinkingMessage];
        await dbStorage.setItem(historyKey, historyWithThinking);
        onHistoryUpdate(historyWithThinking); // 通知 chat-room.js 更新 state 和 UI

        try {
            // 收集所有需要发送给 Service Worker 的数据
            const payload = {
                character,
                user,
                chatHistory: historyForSw, // 发送不包含 "思考中" 的历史记录
                currentChatApi: state.currentChatApi,
                charId: charId,
                emojis: state.emojis || [],
                mode: mode // 把模式也传过去
            };

            // 发送消息给 Service Worker，让它去处理
            navigator.serviceWorker.controller.postMessage({
                type: 'FETCH_AI_REPLY',
                payload: payload
            });

        } catch (error) {
            console.error('发送任务到 Service Worker 失败:', error);
            // 如果发送失败，也要清理UI
            await dbStorage.setItem(historyKey, currentHistory);
            onHistoryUpdate(currentHistory);
            renderSystemMessage(`错误: 无法连接到后台服务`, 'error', elements.chatArea);
            setIsAiReplying(false);
            updateButtonStates();
        }
    }

    return handleSendMessage;
}