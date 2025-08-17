import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

// --- 1. 全域狀態管理 ---
let characterVariables = {};
let UIdisplay = null; // UI 元素的引用
let uiInitializationInterval = null; // 我們輪詢計時器的引用

// --- 2. 核心計算函式 (不變) ---
function updateVariablesFromHistory() {
    const context = getContext();
    if (!context || !context.chat) return;
    characterVariables = {};
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
    updateUIDisplay();
}

// --- 3. 指令執行函式 (不變) ---
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
        case '=': characterVariables[varName] = value; break;
        case '+=': characterVariables[varName] += value; break;
        case '-=': characterVariables[varName] -= value; break;
        default: console.warn(`不支援的運算子: ${operator}`);
    }
}

// --- 4. 介面 (UI) 顯示函式 (不變) ---
function createUIDisplay() {
    if (document.getElementById('character-vars-display')) return; // 防止重複建立
    UIdisplay = document.createElement('div');
    UIdisplay.id = 'character-vars-display';
    UIdisplay.innerHTML = '<h4>角色變數</h4><pre>等待訊息...</pre>';
    document.body.appendChild(UIdisplay);
}

function updateUIDisplay() {
    if (!UIdisplay) return; // 如果 UI 還沒建立，就不更新
    const displayText = Object.keys(characterVariables).length > 0
        ? JSON.stringify(characterVariables, null, 2)
        : "尚未偵測到變數";
    UIdisplay.querySelector('pre').textContent = displayText;
}

// --- 5. 事件監聽器 (不變) ---
function handleChatUpdate() {
    setTimeout(updateVariablesFromHistory, 100);
}
eventSource.on(event_types.MESSAGE_RECEIVED, handleChatUpdate);
eventSource.on(event_types.MESSAGE_EDITED, handleChatUpdate);
eventSource.on(event_types.CHAT_CHANGED, handleChatUpdate);
eventSource.on(event_types.CHAT_LOADED, handleChatUpdate);

// --- 6. (★★★ 全新的) UI 初始化函式 ---
function initializeUI() {
    // 檢查 SillyTavern 的一個核心 UI 元素是否存在。
    // `#chat-input-textarea` 是聊天輸入框，它是一個很好的標誌。
    if (document.getElementById('chat-input-textarea')) {
        console.log("SillyTavern UI 已準備就緒，正在建立變數視窗...");
        createUIDisplay();
        updateVariablesFromHistory(); // 建立後立即更新一次
        // 任務完成，清除計時器，避免不必要的重複執行
        clearInterval(uiInitializationInterval);
    }
}

// --- 7. (★★★ 全新的) 啟動器 ---
// 在擴充功能載入後，每 500 毫秒檢查一次 SillyTavern 的 UI 是否準備好了。
uiInitializationInterval = setInterval(initializeUI, 500);

console.log("角色變數擴充功能已載入，正在等待 SillyTavern UI...");