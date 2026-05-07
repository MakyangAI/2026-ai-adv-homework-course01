# CLAUDE.md

## 專案概述

花卉電商網站 — Node.js + Express + better-sqlite3 + EJS + Tailwind CSS + JWT 認證

這是一個花卉電商 REST API 後端，搭配 EJS 前台頁面渲染，提供使用者註冊/登入、商品瀏覽、購物車（支援訪客與會員雙模式）、訂單建立與付款模擬，以及管理員後台商品管理與訂單查詢功能。

## 常用指令

```bash
# 啟動開發伺服器（不編譯 CSS）
npm run dev:server

# 啟動（含 CSS 建置）
npm start

# 監聽 CSS 變化（另開終端）
npm run dev:css

# 執行測試（Vitest，嚴格順序）
npm test

# 產生 OpenAPI 文件（輸出 JSON）
npm run openapi
```

## 關鍵規則

- **統一回應格式**：所有 API 回應必須遵守 `{ data, error, message }` 三欄結構，不可偏離。`error` 在成功時為 `null`，`data` 在失敗時為 `null`
- **購物車雙模式認證**：購物車 API 的 `dualAuth` middleware 優先嘗試 Bearer JWT，若無則接受 `X-Session-Id` header；若兩者皆無則返回 401。注意：若 Authorization header 存在但 token 無效，**不會** fallback 至 session，直接返回 401
- **訂單建立必須用 JWT**：`POST /api/orders` 與所有訂單 API 只接受 JWT，不支援 session 模式
- **管理員路由雙重守衛**：`/api/admin/*` 路由統一在 router 層套用 `authMiddleware + adminMiddleware`（不在個別 handler 套用），role 必須為 `admin`
- **DB 初始化副作用**：`require('./src/database')` 會直接執行建表與 seed，不需額外呼叫初始化函式
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- [docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則
- [docs/FEATURES.md](./docs/FEATURES.md) — 功能列表與完成狀態
- [docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌

## 必要遵守項目

- 所有 SQL 操作使用 better-sqlite3 的 prepared statements（`db.prepare(sql).run(...)` / `.get(...)` / `.all(...)`），禁止字串拼接 SQL
- 訂單建立使用 `db.transaction()` 包裹（建立 order、order_items、扣庫存、清購物車），確保原子性
- 新增 API 路由時須同時補寫 `@openapi` JSDoc 註解（swagger-jsdoc 從 `src/routes/*.js` 讀取）
- 測試環境下 bcrypt salt rounds 固定為 1（由 `NODE_ENV === 'test'` 判斷），避免拖慢測試速度
- 刪除商品前須確認無 `pending` 狀態訂單，避免外鍵一致性問題
