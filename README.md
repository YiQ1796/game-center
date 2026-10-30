# 猴三毛遊戲中心 / Game Center

正式公開網址：**https://yiq1796.github.io/game-center/**

- 專案：`YiQ1796/game-center`；`main`；版本 `V0.6.0`
- 首頁：猴三毛原創角色與已選定的可愛遊戲村莊風格，純 HTML、CSS、JavaScript，手機與電腦響應式
- 《財富帝國》新版：<https://yiq1796.github.io/Wealth_Empire/v20/>
- 《大老二》測試版：<https://yiq1796.github.io/BigTwo_Web/>
- 《大老二》P2P 連線跨網路真人驗收尚未完成；本專案只提供遊戲入口，不自建多人連線伺服器。

## 使用方式

直接開啟 `index.html` 可本機預覽。正式站使用 GitHub Actions 部署 Pages，檔案存放於倉庫根目錄。

`node scripts/verify-site.mjs` 可檢查遊戲入口、圖片與基本版本標記。

## 安全與回退

這個專案**不修改**《財富帝國》和《大老二》來源碼。上線後以獨立 commit 回退，不覆寫兩款遊戲的 `main`。

最初版本由《大老二》儲存庫 `docs/sanmao/index.html` V0.5.1 遷移；前一公開入口 `https://yiq1796.github.io/BigTwo_Web/sanmao/` 作為過渡版留存，不自動刪除。

## Code Review 的 3 個後續改善

1. 定期 HTTP 檢查兩款遊戲的正式頁面版本，不僅檢查連結字串存在。
2. 為圖像尺寸和 CSS 手機斷點建立視覺回歸測試，避免裁切、溢出。
3. 日後增加遊戲採取 JSON Schema 及自動校驗，避免卡片、狀態和連結資料不同步。
