// 引用 SillyTavern 的必要工具
import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

// --- 1. 全域狀態管理 ---
let characterVariables = {};
let UIdisplay = null;

// --- 2. 核心計算函式 (與之前相同) ---
function updateVariablesFromHistory() {
    console.log("正在從聊天歷史重新計算變數...");
    const context = getContext();
    if (!context || !context.chat) return;

    characterVariables = {}; // 清空舊結果

    for (const message of context.chat) {
        if (message.is_user === false && message.mes) {
            const commands = message.mes.match(/{{(.*?)}}/g);
            if (commands) {
                for (const commandWrapper of commands) {
                    const command = commandWrapper.slice(2, -2).trim();
                    executeCommand(command);
                }
            }
        }
    }

    console.log("計算完成，當前變數狀態:", characterVariables);
    updateUIDisplay(); // 更新介面
}

// --- 3. 指令執行函式 (與之前相同) ---
function executeCommand(command) {
    const parts = command.split(' ');
    if (parts.length !== 3) return;

    const varName = parts[0];
    const operator = parts[1];
    const value = parseFloat(parts[2]);

    if (isNaN(value)) return;

    if (characterVariables[varName] === undefined) {
        characterVariables[varName] = 0;
    }

    switch (operator) {
        case '=':
            characterVariables[varName] = value;
            break;
        case '+=':
            characterVariables[varName] += value;
            break;
        case '-=':
            characterVariables[varName] -= value;
            break;
        default:
            console.warn(`不支援的運算子: ${operator}`);
    }
}

// --- 4. 介面 (UI) 顯示函式 (與之前相同) ---
function createUIDisplay() {
    if (UIdisplay) return;
    UIdisplay = document.createElement('div');
    UIdisplay.id = 'character-vars-display';
    UIdisplay.innerHTML = '<h4>角色變數</h4><pre>等待訊息...</pre>';
    document.body.appendChild(UIdisplay);
}

function updateUIDisplay() {
    if (!UIdisplay) createUIDisplay();
    const displayText = Object.keys(characterVariables).length > 0
        ? JSON.stringify(characterVariables, null, 2)
        : "尚未偵測到變數";
    UIdisplay.querySelector('pre').textContent = displayText;
}

// --- 5. 事件監聽器 (★★★ 這是最重要的修改 ★★★) ---

// 整合所有需要觸發更新的事件到一個函式
function handleChatUpdate(data) {
    // 增加一個小小的延遲，確保DOM和其他腳本都已更新完畢
    setTimeout(updateVariablesFromHistory, 100);
}

// 註冊我們的監聽器到【所有】相關的事件上
eventSource.on(event_types.MESSAGE_RECEIVED, handleChatUpdate); // ★ 新增：處理新訊息
eventSource.on(event_types.MESSAGE_EDITED, handleChatUpdate); // ★ 新增：處理新訊息
eventSource.on(event_types.CHAT_CHANGED, handleChatUpdate);     // 保留：處理切換角色
eventSource.on(event_types.CHAT_LOADED, handleChatUpdate);       // 保留：處理載入聊天

// --- 6. 初始化 (★★★ 這是另一個重要的修改 ★★★) ---

// 在擴充功能腳本被載入後，立刻執行一次UI建立
createUIDisplay();
console.log("角色變數擴充功能已載入，UI已初始化。");