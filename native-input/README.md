# 聊天輸入框右鍵繁簡互轉：未安裝候選版

**這次的目標是直接改輸入框草稿，不是閱讀面板。只有工作區修補與測試，未安裝、未推送、未重啟 Desktop。**

## 已實作的行為

- 在聊天輸入框按右鍵，原生選單追加「轉為繁體」「轉為簡體」，保留原本 Undo／Redo／Cut／Copy／Paste／SelectAll。
- 有反白：只轉選取範圍；沒有反白：轉整份草稿。直接替換文字，不另開閱讀面板。
- 一次正常轉換是一個編輯器復原步驟，Ctrl＋Z 可回復；可重做。前後打字不併入此步驟。沒有文字變化就不新增復原紀錄。
- 保留檔案／命令標籤的節點、資料與命令 claim，保留附件、段落及換行。只轉換一般文字節點，不改標籤的名稱／路徑。
- 不自動送出，不修改已送出的訊息。簡繁轉換可能有多對一映射；精確回原文應用 **復原**，不要靠再反向轉一次。

普通文字節點中的中文（包含你以純文字輸入的程式碼、網址或路徑中文）也在明確選取／整框轉換範圍內；需要保留的片段請縮小反白範圍。這與既有閱讀面板的技術字串保護不同。

## 必須配套的三部分

1. [Desktop 原生選單及窄版 preload 橋接](<src/native-composer-main.mjs>)：只新增操作事件，不透過新 IPC 傳送草稿、選取原文或 HTML。
2. [編輯器擁有者補丁](<../input-owner/patch-owner.mjs>)：新增 `inputActions.transformDraftText`，在 Lexical 內做一次文字交易。這是**本候選版新增介面，不是目前已安裝 DSH 已提供的 API**。不可用直接修改 DOM、`setDraft` 或逐段 `insertText` 代替，否則會破壞標籤／復原邊界。
3. [語言包配套控制器](<../src/composer-conversion.mjs>)與[Slot 元件](<../src/composer-ui.mjs>)：透過已查證的 `conversation.input.overlay`、session `inputActions` 及目前輸入框根節點綁定。僅有使用者真正右鍵事件才建立短期快照。

分支 `patch/input-conversion`，候選語言包 `1.0.1-patch.3.input.1`。既有語言字典與 patch.3 閱讀功能保留；原本已部署的語言包未修改。**單獨更新語言包，不能啟用這個原生功能。**

目標只限 Desktop **0.2.1-rc.5**、build `d4db512a969fccf0c5cc7ec8fe38e9c1d27af916`，且四份來源 SHA-256 必須符合[固定來源清單](<known-source.json>)。不接受其他版本或漂移來源。

## 交付及防護

- [產生的完整差異](<generated/desktop-and-owner.diff>)及[來源／產物雜湊](<generated/manifest.json>)。來源產物只寫入本工作區 generated，沒有安裝器、ASAR 重封裝或簽章繞過。
- [產生器](<prepare.mjs>)及[原始碼唯讀擷取器](<capture-baseline.mjs>)。獨立編輯器介面規格見[擁有者 API 說明](<../input-owner/README.md>)。
- 主程序驗證視窗、mainFrame、`dsh-app://app`、訂閱 revision 與單次 menuId；導覽、卸載、關閉及舊選單失效。一般 input／textarea、其他來源及子框架不能直接使用此入口。
- renderer 再檢查同一個 composer 根節點、session、actions 身分、草稿 revision、精確非空選取範圍（兩次均未反白時，游標自動定位不改變整框轉換意圖）、編輯權限與組字狀態。快照有效 30 秒；滑鼠／鍵盤／捲動／隱藏頁面／組字會取消舊快照。
- 轉換前先計算並驗證全部輸出，再一次修改；選取的一般文字上限 20,000 UTF-16 字元，輸出合計上限 80,000。組字中、送出判定中、唯讀或有待完成編輯時拒絕。
- 審查發現並修正：同文件導覽不應丟失訂閱；Lexical 錯誤回呼拋出不能留下稍後偷偷提交的未完成轉換。
- 極端的編輯器通知／DOM 提交故障會回報「狀態無法確認」，不宣稱未修改或保證復原，不自動重試。無法修復任意第三方 listener 的其他副作用。
- OpenCC 轉換本身在本機進行，不呼叫模型／網路。正常編輯器的草稿保存、建議及狀態更新仍照原來機制運作。

## 驗證結果

- **70 項單元／來源測試通過**：語言包及控制器 41；Desktop 橋接與來源補丁 14；實際 bundled Lexical／owner 15。
- 獨立 Electron **45.2.3**、React StrictMode、真正 Chromium 右鍵事件、真正 native Menu 物件、隔離 preload IPC、**從目標版本擷取的真正 Lexical 與 SessionInputShell**：整框、部分選取、跨標籤轉換、附件保留、不送出皆通過。
- 真正 Chromium 鍵盤 Ctrl＋Z／Ctrl＋Y 事件通過，包含有命令／檔案標籤的草稿；不是只測自製字串堆疊。
- 舊草稿、組字旗標、唯讀、其他編輯框、其他 origin、子框架、同文件導覽及卸載測試通過。組字測試注入狀態旗標，**不是實際作業系統中文輸入法驗證**。
- 既有獨立 Edge 閱讀器 fixture 另跑回歸；完整產生的 Main／preload／Client 可通過語法檢查，來源差異可反向檢查。
- [安裝未變驗證器](<verify-untouched.mjs>)核對完整原始 ASAR 及四份來源；沒有改動已部署語言包、profile 套件／設定、Codex 或其他現用依賴。

### 尚未驗證，不能說已可直接安裝

測試的 service／Slot 掛載環境是替身，雖然用了真正編輯器及 React，**仍不是完整已安裝 DSH GUI**。隱藏 fixture 沒有呼叫 native popup，也沒測實際 popup 的顯示、點選／關閉時序、原生複製或 OS 剪貼簿。獨立 Electron 的版本不等於已安裝 Desktop 的內嵌版本。

套用前還要驗證原生 popup、完整 GUI/session 切換、實際輸入法、Electron fuses／ASAR integrity／簽章、更新覆蓋及完整回復方案。不要直接覆蓋安裝檔；現階段不需回復，因為尚未套用。套用或重啟必須另行確認。

## 重現（只在工作區）

先在 repo 根目錄執行 `npm ci --include=dev --ignore-scripts`。需 Node 與 Git；本目錄：

```powershell
npm ci --include=dev --ignore-scripts
# 首次建立 baseline；已存在時不要重跑。參數只讀。
node capture-baseline.mjs 'C:\你的安裝位置\resources\app.asar'
node prepare.mjs
npm test
# 明確安裝的是獨立測試 Electron，不是更新現用 Desktop。
node node_modules/electron/install.js
npm run test:electron
node verify-untouched.mjs 'C:\你的安裝位置\resources\app.asar'
```

repo 根目錄再執行 `npm run build`、`npm test`、`node tools/browser-smoke.mjs --fixture`。編輯器來源擷取在本機 research 與 baseline，皆不納入 Git；fixture／測試 profile／下載快取亦不納入。

開發依賴的完整 audit 為 0 已知漏洞，並非零風險保證。ASAR 3.4.1 仍有 glob／inflight 棄用警告，只使用唯讀 `extractFile`，不納入執行期。測試用 Zod 已採修補版本 4.6.7，沒有更動現用 DSH 自帶版本。正式維護應更新至上游已修復的受支援工具。
