# 覆蓋範圍與驗證界線

## 1.0.1-patch.1

| 來源 | 命名空間 | 字典鍵數 | 範圍 |
| --- | --- | ---: | --- |
| 上游 DSH 0.2.1-rc.2 快照 | 原有 63 個 | 2,676 | 原樣保留，不重翻既有主介面 |
| dsh-mnemon 0.5.40 | `mnemon` | 1,409 | 經 Host Client locale 服務查詢的主頁、設定、通知等文字 |
| dsh-context 0.81.2 | `dsh-context` | 737 | 經 locale 服務查詢的洞察、上下文、編隊、設定、提示等文字 |

共 65 個命名空間、4,822 個頂層鍵。鍵數是字典覆蓋，不是已目視驗證的頁面數。

## 已確認的上游繞過路徑

Mnemon 0.5.40 的 `lib/client.js`：

- `MemorySourcePageFrame`（10580–10586）：以 `locale.startsWith('en')` 二選一呼叫 `translateEn`／`translateZh`，不走註冊的 `mnemon/zh-TW`。
- `componentCopy`（786–790）：中文語系固定選 `zh-CN` 的元件名稱與說明。
- `ComponentOptions`（5110–5111）：欄位名稱／說明亦直接選擇簡體 metadata。

因此「來源頁、元件名稱、部分欄位說明」可能仍為簡體。即使對應字典已翻譯，繞過呼叫仍不會使用它。本版不猴子補丁這些函式、不覆寫 DOM，也不編輯已安裝外掛。完整修正需要上游將這些呼叫改為共用 locale translator，並支援明確的 `zh-TW` metadata fallback。

其他外掛尚未審核；本版不是通用的全頁簡轉繁器。未收錄的新鍵繼續走 `zh-TW → zh → en` 的安全回退。

## 必須保留的內容

只在建置時轉換版本化的 UI 字典：

- 不讀取或改寫對話、記憶、任務、工具輸出、檔案、使用者輸入或模型內容。
- 字典鍵不變；參數 `{name}`、`${model}`、`%s`、內嵌程式碼、URL、Windows 路徑原樣保留。
- 執行期參數由原外掛插入，簡體的歷史任務名稱不會被轉換。
- 不修改外掛版本、模型設定、依賴解析或安全政策。
- 不注入全頁 MutationObserver、DOM 字詞替換或 locale service 攔截器。

## 測試與未驗證項目

自動測試覆蓋所有已收錄鍵／受保護 token、原 63 個命名空間不變、代表畫面標籤、靜態抽取拒絕可執行運算式、重建一致性、先／後載入外掛、切換語系、卸載清理、未知鍵回退、動態歷史內容不變。

測試使用 mock locale 服務驗證實際生成的 Client 模組；不是 Desktop 真實 UI 端到端測試。本次 fork 工作沒有替換現用 Desktop 語言包，也沒有升級 Mnemon 或 Context。

安裝後應人工驗證：聊天／Mnemon 主頁／Context 洞察／上下文／編隊／設定／延遲出現的提示；再切回簡體與英文。查看歷史任務、原始 JSON、程式碼和路徑，確認未被改寫。來源頁的已知繞過情況不可當作已修復。

## 更新規則

來源版本、命名空間、binding、來源 artifact SHA-256 及授權記於 `dictionaries/sources.json`。更新來源時重新審核 locale 註冊點與私有繞過路徑，再使用 `tools/refresh-plugin-source.mjs`；不要只因套件升版就假定相同覆蓋。若外掛將來自己註冊相同的 `namespace/zh-TW`，需先從這個語言包移除相應覆蓋，避免單一擁有者衝突。
