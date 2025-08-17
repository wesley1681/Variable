// 引用 SillyTavern 的必要工具
import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

// --- 1. 全域狀態管理 (無變動) ---
let characterVariables = {};
let UIdisplay = null;

// --- 2. 核心計算函式 (無變動) ---
// 這個函式的功能不變：從頭到尾掃描一次聊天紀錄，更新所有變數的最終值。
function updateVariablesFromHistory() {
    console.log("正在從聊天歷史重新計算變數...");
    const context = getContext();
    if (!context || !context.chat) return;

    characterVariables = {}; // 每次都從頭計算，確保狀態正確

    for (const message of context.chat) {
        // 我們只處理AI的回覆 (is_user === false)
        if (message.is_user === false && message.mes) {
            // 尋找所有 {{...}} 格式的指令
            const commands = message.mes.match(/{{(.*?)}}/g);
            if (commands) {
                for (const commandWrapper of commands) {
                    const command = commandWrapper.slice(2, -2).trim();
                    // 只執行賦值、加減等操作，忽略 'get' 指令
                    if (!command.startsWith('get ')) {
                        executeCommand(command);
                    }
                }
            }
        }
    }

    console.log("計算完成，當前變數狀態:", characterVariables);
    updateUIDisplay(); // 更新UI面板
}

// --- 3. 指令執行函式 (微調) ---
// 稍微修改，避免 'get' 指令被誤判
function executeCommand(command) {
    const parts = command.split(' ');
    // 'get' 指令格式為 {{get varName}}，長度為2，在此直接忽略
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


// --- 4. 介面 (UI) 顯示函式 (無變動) ---
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

// --- 5. 事件監聽器 (★★★ 核心修改部分 ★★★) ---

/**
 * @description 當收到新訊息時觸發的處理函式。
 * 這個函式是實現新功能的核心。
 */
async function onMessageReceived() {
    // 等待一小段時間 (例如 100 毫秒)，確保新的訊息已經被完整地加入到聊天歷史陣列中。
    await new Promise(resolve => setTimeout(resolve, 100));

    const context = getContext();
    if (!context || !context.chat || context.chat.length === 0) return;

    // 步驟 1: 首先，執行一次完整的變數計算。
    // 這能確保在處理 'get' 指令前，所有的變數 (例如好感度) 都已經是最新狀態。
    updateVariablesFromHistory();

    // 步驟 2: 取得剛剛收到的最後一則訊息。
    const lastMessage = context.chat[context.chat.length - 1];

    // 步驟 3: 檢查這則訊息是否是AI發出的，並且包含 'get' 指令。
    if (lastMessage && !lastMessage.is_user && lastMessage.mes && lastMessage.mes.includes('{{get')) {
        const getCommandRegex = /{{\s*get\s+([a-zA-Z0-9_]+)\s*}}/g;
        const originalMessage = lastMessage.mes;
        let wasMessageModified = false;

        // 步驟 4: 使用正規表示式和 replace 方法，尋找所有 {{get varName}} 的指令。
        const updatedMessage = originalMessage.replace(getCommandRegex, (match, varName) => {
            wasMessageModified = true;
            // 從我們剛計算好的 characterVariables 物件中查找對應的值。
            if (characterVariables.hasOwnProperty(varName)) {
                return String(characterVariables[varName]); // 返回找到的值
            }
            // 如果找不到該變數，可以返回一個預設值，例如 '0' 或 '未知'。
            return '0';
        });

        // 步驟 5: 如果訊息內容被修改了，就更新它並刷新聊天介面。
        if (wasMessageModified) {
            lastMessage.mes = updatedMessage; // 直接修改聊天歷史中的訊息內容

            // 呼叫 SillyTavern 的內建函式來重繪聊天介面，讓修改生效。
            context.updateChat();
        }
    }
}

// 處理其他聊天更新事件的通用函式
function handleChatUpdate() {
    setTimeout(updateVariablesFromHistory, 100);
}

// 註冊我們的監聽器
eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived); // ★ 使用我們新的、更強大的函式
eventSource.on(event_types.MESSAGE_EDITED, handleChatUpdate);   // 當手動編輯訊息時，重新計算
eventSource.on(event_types.CHAT_CHANGED, handleChatUpdate);     // 切換聊天時，重新計算
eventSource.on(event_types.CHAT_LOADED, handleChatUpdate);       // 載入存檔時，重新計算


// --- 6. 初始化 (無變動) ---
createUIDisplay();
console.log("角色變數擴充功能已載入，UI已初始化。");