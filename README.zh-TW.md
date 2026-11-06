# dsh-lang-zhtw — n4714806 修補版

[English](<README.md>) · 上游：[Grasseed/dsh-lang-zhtw](https://github.com/Grasseed/dsh-lang-zhtw)

修補分支：`patch/plugin-pages-zh-tw`；版本：**1.0.1-patch.2**。

## 新增：繁體閱讀面板

在原頁反白一般內文，再按右下角 **繁體閱讀**（Hot Restart 上方）。可切換原文／繁體，**複製原文**保留選取時的字串；直接反白面板文字複製，則是顯示文字。原頁與資料不動、不傳網路、不儲存內文；關閉即釋放內容。這不是整頁自動翻譯。詳見[使用方式、保護範圍與限制](<docs/reader.md>)。

## 不只主介面，也補上外掛字典

- 原有 DSH **63 個命名空間／2,676 個鍵**原樣保留。
- 新增 **Mnemon 1,409 個鍵**（0.5.40）及 **Context／編隊 737 個鍵**（0.81.2）。
- 合計 **65 個命名空間／4,822 個鍵**。這是字典覆蓋數，不是所有頁面已目視驗證的保證。
- 字典可重建，建置依賴鎖版；保護插值參數、程式碼、URL 與路徑。
- 不改寫原頁 DOM、不攔截 locale service，不改寫歷史對話、任務、記憶、工具輸出或使用者輸入。閱讀面板只在明確點擊時檢查選取範圍。

**已知限制：** Mnemon 部分來源頁與元件 metadata 直接選簡體，沒有查詢語系服務。本版不冒險覆寫它們，完整範圍與上游修正方向見[覆蓋說明](<docs/coverage.md>)。其他未審核外掛、新增字串仍可能回退到簡體。

## 安裝／更新自己的修補版

```sh
git clone --branch patch/plugin-pages-zh-tw https://github.com/n4714806/dsh-lang-zhtw.git
```

透過 Desktop 的外掛管理器，將**既有的** `dsh-lang-zhtw` 更新為這個資料夾；或在管理器的 Git 來源使用 `github:n4714806/dsh-lang-zhtw#patch/plugin-pages-zh-tw`。

- 只啟用一份語言包，避免同時註冊 `zh-TW` 衝突。
- 語言選擇「繁體中文（台灣）」。成品已提交，使用者不必自行 npm install／build。
- **本次 Git 修補不會自動替換目前 Desktop 的語言包。** 安裝另行確認後，先備份、再檢查管理器結果及原有外掛功能。
- 不在 Desktop profile 裡直接執行 npm/pnpm，不手改其依賴或設定檔，也不為翻譯順便升級 Mnemon、Context 或模型相關套件。

## 開發與測試（只在這個 repo）

```sh
npm ci --include=dev --ignore-scripts
npm run build
npm test
```

建置讀取已提交的字典快照與閱讀面板原始碼，產生 [client.js](<client.js>)，不依賴 `/tmp`，也不覆寫套件資訊、圖示、語系 metadata 或 profile。套件只宣告開發依賴；閱讀面板所用 OpenCC 核心與字典已內嵌，不需執行期安裝或網路下載。

[來源清單](<dictionaries/sources.json>)記錄來源版本、命名空間、binding、artifact SHA-256 與授權。審核新版本的字典註冊方式後，可明確更新快照：

```sh
node tools/refresh-plugin-source.mjs dsh-mnemon /path/to/package/lib/client.js 0.5.40
npm run build
npm test
```

新抽取器只解析靜態資料，不執行外掛程式。原[主程式字典抽取器](<tools/extract-dicts4.mjs>)保留為舊版參考，不被目前建置流程呼叫；它含動態求值，不可用於不可信 artifact。DSH 主介面字典升版另行審核，不會自動覆蓋。

## 驗證界線

測試使用 mock locale 服務執行真正生成的 Client 模組，涵蓋先／後載入外掛、語系切換、卸載清理、回退、所有鍵與參數保護、歷史內容不被轉換；**不等於真實 Desktop 點擊／畫面驗證**。未升級任何已安裝的 Mnemon／Context。

原語言包保留 MIT © 2026 Grasseed；外掛字典部分各自保留 MIT／Apache-2.0 授權，詳見[第三方聲明](<THIRD_PARTY_NOTICES.md>)。
