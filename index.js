// 引用 SillyTavern 的必要工具
import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

// --- 1. 全域狀態管理 ---
// 這個物件將用來儲存我們所有變數的【最終計算結果】。
// 它會在每次聊天紀錄變動時被清空並重新計算。
let characterVariables = {};

// 這個變數將用來存放我們要在介面上顯示變數的那個小視窗。
let UIdisplay = null;

// --- 2. 核心計算函式 ---
// 這是我們擴充功能最重要的大腦。它會讀取整個聊天紀錄並更新變數。
function updateVariablesFromHistory() {
    console.log("正在從聊天歷史重新計算變數...");

    // 取得當前的聊天紀錄
    const context = getContext();
    if (!context || !context.chat) return;

    // **關鍵步驟**：清空舊的結果，準備從頭開始計算。
    characterVariables = {};

    // 遍歷每一條聊天訊息
    for (const message of context.chat) {
        // 只處理 AI 的回覆 (is_user: false)
        if (message.is_user === false && message.mes) {
            // 使用正規表示式來尋找所有 {{...}} 格式的指令
            const commands = message.mes.match(/{{(.*?)}}/g);

            if (commands) {
                // 如果找到了指令，就逐一執行
                for (const commandWrapper of commands) {
                    // 去掉外面的 {{ 和 }}
                    const command = commandWrapper.slice(2, -2).trim();
                    executeCommand(command);
                }
            }
        }
    }

    console.log("計算完成，當前變數狀態:", characterVariables);
    // 更新介面上的顯示
    updateUIDisplay();
}

// --- 3. 指令執行函式 ---
// 這個函式負責解析並執行單一指令，例如 "A += 100"
function executeCommand(command) {
    // 簡單的解析：用空格分割指令
    const parts = command.split(' ');
    if (parts.length !== 3) return; // 指令格式必須是 [變數, 運算子, 值]

    const varName = parts[0];
    const operator = parts[1];
    const value = parseFloat(parts[2]); // 將字串值轉換為數字

    // 如果值不是一個有效的數字，就忽略這個指令
    if (isNaN(value)) return;

    // 初始化變數 (如果它還不存在的話)
    if (characterVariables[varName] === undefined) {
        characterVariables[varName] = 0;
    }

    // 根據運算子執行對應的操作
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
        // 您可以在這裡新增更多運算子，例如 *=, /=
        default:
            console.warn(`不支援的運算子: ${operator}`);
    }
}

// --- 4. 介面 (UI) 顯示函式 ---
// 這些函式負責在 SillyTavern 介面上建立一個小視窗來顯示變數的即時狀態。
function createUIDisplay() {
    if (UIdisplay) return; // 如果已經存在了，就不再建立

    UIdisplay = document.createElement('div');
    UIdisplay.id = 'character-vars-display';
    UIdisplay.innerHTML = '<h4>角色變數</h4><pre></pre>';
    document.body.appendChild(UIdisplay);
}

function updateUIDisplay() {
    if (!UIdisplay) createUIDisplay();

    // 將 characterVariables 物件轉換為格式化的文字
    const displayText = JSON.stringify(characterVariables, null, 2);
    UIdisplay.querySelector('pre').textContent = displayText;
}

// --- 5. 事件監聽器 ---
// 告訴 SillyTavern 在什麼時候需要觸發我們的計算函式。
function onChatChanged() {
    // 當聊天訊息新增、刪除、或編輯時，這個事件會被觸發
    updateVariablesFromHistory();
}

function onChatLoaded() {
    // 當一個已存在的聊天被載入時，這個事件會被觸發
    console.log("聊天已載入，初始化變數...");
    createUIDisplay(); // 建立 UI 視窗
    updateVariablesFromHistory();
}

// 註冊我們的監聽器
eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
eventSource.on(event_types.CHAT_LOADED, onChatLoaded);

console.log("角色變數擴充功能已載入。");