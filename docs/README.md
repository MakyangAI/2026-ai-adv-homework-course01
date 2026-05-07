# 花卉電商網站

Node.js + Express 的全端花卉電商應用，提供 REST API 後端與 EJS 前台頁面渲染，包含會員管理、商品瀏覽、購物車（訪客/會員雙模式）、訂單流程與管理員後台。

## 技術棧

| 層面 | 技術 |
|------|------|
| 執行環境 | Node.js |
| Web 框架 | Express ~4.16.1 |
| 資料庫 | better-sqlite3 ^12.8.0（SQLite，WAL 模式） |
| 樣板引擎 | EJS ^5.0.1 |
| CSS 框架 | Tailwind CSS ^4.2.2 |
| 認證 | JWT（jsonwebtoken ^9.0.2）+ X-Session-Id（訪客） |
| 密碼雜湊 | bcrypt ^6.0.0 |
| API 文件 | swagger-jsdoc ^6.2.8 |
| 測試框架 | Vitest ^2.1.9 + supertest ^7.2.2 |
| ID 生成 | uuid v4 |

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 建立環境變數
cp .env.example .env
# 編輯 .env，設定 JWT_SECRET（必填）

# 3. 啟動開發伺服器（資料庫自動建立並 seed）
npm run dev:server

# 4. 另開終端，監聽 CSS 變化
npm run dev:css
```

預設服務啟動於 `http://localhost:3001`

預設管理員帳號（由 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 控制）：
- Email: `admin@hexschool.com`
- 密碼: `12345678`

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動伺服器（不含 CSS 編譯） |
| `npm run dev:css` | 監聽並編譯 Tailwind CSS |
| `npm start` | 編譯 CSS 後啟動伺服器（正式環境） |
| `npm test` | 執行完整測試套件（Vitest） |
| `npm run openapi` | 產生 OpenAPI JSON 文件 |
| `npm run css:build` | 一次性編譯並 minify CSS |

## 重要路徑

| 路徑 | 說明 |
|------|------|
| `http://localhost:3001/` | 前台首頁（商品列表） |
| `http://localhost:3001/admin/products` | 後台商品管理（需 admin JWT） |
| `http://localhost:3001/admin/orders` | 後台訂單管理（需 admin JWT） |
| `http://localhost:3001/api/...` | REST API 入口 |

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系統架構、目錄結構、API 路由總覽、資料庫 Schema |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增模組步驟、環境變數說明 |
| [FEATURES.md](./FEATURES.md) | 功能清單、業務邏輯說明、錯誤碼一覽 |
| [TESTING.md](./TESTING.md) | 測試規範、執行順序、輔助函式說明 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
| [plans/](./plans/) | 進行中的功能開發計畫 |
| [plans/archive/](./plans/archive/) | 已完成計畫歸檔 |
