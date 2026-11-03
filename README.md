# 猴三毛遊戲中心 V0.8.0｜加入猴三毛拉密
正式網址：https://yiq1796.github.io/game-center/

## 遊戲入口（分別獨立維護）
- **財富帝國 V20**：https://yiq1796.github.io/Wealth_Empire/v20/
- **大老二（測試開放）**：https://yiq1796.github.io/BigTwo_Web/
- **猴三毛拉密（測試開放，固定四人）**：https://yiq1796.github.io/Rummikub_Web/

2026-11-03 已核對 Rummikub_Web main SHA cf84d99870242a72eedfc7a135ecd9fc4202ad1f、Pages Run #9 SUCCESS，版本 V0.2.4。單機為一位真人加三位 AI，多人不足四人時由 AI 補齊。跨網路真人 UAT 未驗收，不能標榜正式穩定連線。

## 本輪改動
- V0.7.0 已發布版本為安全回退基準（commit `3c04d5d63d4744a4b94ea1eb055f84eb5e7ed48d`）。
- 新增第三張《猴三毛拉密》卡片；使用 **CSS 數字牌＋現有猴三毛角色**，不額外生成或疊加新圖片。
- 沿用網站版型、favicon 與網站安裝圖示；遊戲清單可搜尋「拉密」。
- 三款遊戲程式本體均未修改。首頁入口按鈕開新分頁；搜尋資料只依一份遊戲清單。
- 對應自動測試 `node scripts/verify-site.mjs`；`node scripts/verify-icons.mjs` 保持不變。
- 發布流程由 `.github/workflows/pages.yml` 自動測試並部署 GitHub Pages。

## Code Review：後續改善
1. 新增真正的 Playwright 三種裝置截圖測試，確保第三張遊戲卡片在寬版／窄版不溢出。
2. 目前網址僅驗證為固定路徑與 Pages SUCCESS；應在 CI 增加入口連結 HTTP 狀態與頁面版本檢查，避免未來退回舊版。
3. 將遊戲卡片資料加上結構驗證（唯一 ID、允許的狀態／視覺型別、可信 HTTPS 網域），防止未來新增遊戲誤連第三方網站。
