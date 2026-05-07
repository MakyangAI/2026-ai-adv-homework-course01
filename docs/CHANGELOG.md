# CHANGELOG.md

## [1.0.0] — 2026-05-07

### 新增

- 使用者認證系統（JWT HS256，有效期 7 天）
  - `POST /api/auth/register`：使用者註冊（email + password + name）
  - `POST /api/auth/login`：使用者登入
  - `GET /api/auth/profile`：取得個人資料（需 JWT）

- 商品公開瀏覽 API
  - `GET /api/products`：分頁商品列表（page、limit 查詢參數）
  - `GET /api/products/:id`：單一商品詳情

- 購物車系統（訪客/會員雙模式）
  - `GET /api/cart`：查看購物車（Bearer JWT 或 X-Session-Id）
  - `POST /api/cart`：加入商品（累加邏輯）
  - `PATCH /api/cart/:itemId`：修改數量
  - `DELETE /api/cart/:itemId`：移除項目

- 訂單系統
  - `POST /api/orders`：從購物車建立訂單（atomic transaction：建立 order、order_items、扣庫存、清購物車）
  - `GET /api/orders`：我的訂單列表
  - `GET /api/orders/:id`：訂單詳情（含 items）
  - `PATCH /api/orders/:id/pay`：模擬付款（success → paid / fail → failed）

- 後台商品管理（需 admin role）
  - `GET /api/admin/products`：後台商品列表
  - `POST /api/admin/products`：新增商品
  - `PUT /api/admin/products/:id`：編輯商品
  - `DELETE /api/admin/products/:id`：刪除商品（保護：有 pending 訂單時拒絕）

- 後台訂單管理（需 admin role）
  - `GET /api/admin/orders`：後台訂單列表（可篩選 status）
  - `GET /api/admin/orders/:id`：後台訂單詳情（含 user 資訊）

- EJS 前台頁面：首頁、商品詳情、購物車、結帳、登入、我的訂單、訂單詳情、404
- EJS 後台頁面：商品管理、訂單管理
- Tailwind CSS 前台樣式
- SQLite 資料庫（WAL 模式，外鍵約束）
- 資料庫自動初始化與 seed（8 筆花卉商品、1 筆管理員帳號）
- OpenAPI 文件產生（`npm run openapi`）
- Vitest 整合測試套件（6 個測試檔案，強制順序執行）
- 統一 API 回應格式：`{ data, error, message }`
- 全域錯誤處理（避免洩漏 500 內部細節）
