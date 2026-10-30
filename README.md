# 猴三毛遊戲中心 V0.7.0｜遊戲圖示整合版

正式網站：https://yiq1796.github.io/game-center/

本輪只新增網站圖示與可安裝網站資訊。沿用 V0.6.0 首頁主視覺和遊戲入口，並未修改《財富帝國》或《大老二》的程式碼。

## 圖示來源與用途
- `assets/icons/source-monkey-gaming.png`：使用者已選定的猴三毛打電動圖示原圖，保留作美術來源（本機備份，不加入 GitHub 公開站以避免額外下載負擔）。
- `favicon.ico`：多尺寸 16/32/48，Windows／瀏覽器舊式圖示。
- `assets/icons/favicon-32-v070.png`：瀏覽器分頁與書籤。
- `assets/icons/apple-touch-icon-v070.png`：iPhone/iPad 加入主畫面。
- `assets/icons/app-icon-192-v070.png`：瀏覽器網頁應用安裝。
- `assets/icons/app-icon-512-v070.png`：高解析度安裝圖示。
- `assets/icons/app-maskable-512-v070.png`：支援 maskable 的 Android 圖示，主角保留安全邊界。
- `site.webmanifest`：PWA 安裝描述、起始網址、語言與圖示。

## 使用方法
1. iPhone Safari 開啟網站，使用「分享 → 加入主畫面」；若原有舊圖示，先刪除舊捷徑再加入。
2. Windows Edge/Chrome 開啟網站，在瀏覽器選單中「應用程式 → 將此網站安裝為應用程式」或同義選項。普通 .url 捷徑是否採用網站 favicon 取決於瀏覽器/Windows，不能保證已建立的舊捷徑會自動換圖。
3. 圖示檔名帶 v070 以避開快取，新舊安裝圖示仍可能需重新建立捷徑。

## Code Review 需追蹤的三項改善
1. 減小圖示的 PNG 大小，並以清晰度比較結果調整色階；避免為了壓縮讓猴子線條失真。
2. 為各平台捷徑／圖示建立實機截圖驗收：iOS Safari、Android Chrome、Windows Edge/Chrome。
3. 下一版將圖示轉換流程寫成可重現 CLI 和 CI QA，並增加 manifest 路徑／來源版本自動驗證。

## 發布與驗證
執行 `node scripts/verify-icons.mjs` 與 `node scripts/verify-site.mjs`；完成 GitHub Actions 部署後查核 commit / Pages run / 公開網址。
