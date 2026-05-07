# ARCHITECTURE.md

## 目錄結構

```
.
├── app.js                        # Express 應用程式設定（middleware、路由掛載）
├── server.js                     # HTTP 伺服器啟動入口（監聽 PORT，檢查 JWT_SECRET）
├── vitest.config.js              # Vitest 測試設定（固定執行順序）
├── swagger-config.js             # swagger-jsdoc 設定（OpenAPI 3.0.3）
├── generate-openapi.js           # 執行後輸出 openapi.json 文件
├── database.sqlite               # SQLite 資料庫檔案（自動建立）
├── .env                          # 環境變數（不進版控）
├── .env.example                  # 環境變數範本
├── public/
│   └── css/
│       ├── input.css             # Tailwind CSS 入口（@import "tailwindcss"）
│       └── output.css            # 編譯後的 CSS（由 npm run css:build 產生）
├── src/
│   ├── database.js               # DB 初始化（建表 + seed）+ 匯出 db 連線實例
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT Bearer 驗證（失敗即 401）
│   │   ├── adminMiddleware.js    # 角色守衛（role !== 'admin' 則 403）
│   │   ├── sessionMiddleware.js  # 從 X-Session-Id header 讀取並附加 req.sessionId
│   │   └── errorHandler.js      # 全域錯誤處理（避免洩漏內部細節）
│   └── routes/
│       ├── authRoutes.js         # /api/auth — 註冊、登入、個人資料
│       ├── productRoutes.js      # /api/products — 公開商品列表與詳情
│       ├── cartRoutes.js         # /api/cart — 購物車（雙模式認證）
│       ├── orderRoutes.js        # /api/orders — 訂單建立、查詢、付款（需 JWT）
│       ├── adminProductRoutes.js # /api/admin/products — 後台商品 CRUD（需 admin）
│       ├── adminOrderRoutes.js   # /api/admin/orders — 後台訂單查詢（需 admin）
│       └── pageRoutes.js         # 前台 + 後台 EJS 頁面路由
├── views/
│   ├── layouts/
│   │   ├── front.ejs             # 前台主版型（含 head、header、footer）
│   │   └── admin.ejs             # 後台主版型（含 sidebar）
│   ├── pages/
│   │   ├── index.ejs             # 首頁（商品列表）
│   │   ├── product-detail.ejs   # 商品詳情
│   │   ├── cart.ejs              # 購物車
│   │   ├── checkout.ejs          # 結帳
│   │   ├── login.ejs             # 登入
│   │   ├── orders.ejs            # 我的訂單列表
│   │   ├── order-detail.ejs      # 訂單詳情（含付款結果）
│   │   ├── 404.ejs               # 404 頁面
│   │   └── admin/
│   │       ├── products.ejs      # 後台商品管理
│   │       └── orders.ejs        # 後台訂單管理
│   └── partials/
│       ├── head.ejs              # HTML <head>（含 CSS 引入）
│       ├── header.ejs            # 前台導覽列
│       ├── footer.ejs            # 前台頁尾
│       ├── admin-header.ejs      # 後台頂部導覽
│       ├── admin-sidebar.ejs     # 後台側邊欄
│       └── notification.ejs      # 通知元件
└── tests/
    ├── setup.js                  # 測試輔助函式（getAdminToken、registerUser）
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

## 啟動流程

```
server.js
  ├── 檢查 JWT_SECRET（未設定則 process.exit(1)）
  └── require('./app')
        ├── require('dotenv').config()
        ├── require('./src/database')          ← 副作用：建表 + seed admin + seed products
        ├── 設定 EJS view engine（views/ 目錄）
        ├── express.static('./public')
        ├── CORS（origin: FRONTEND_URL || 'http://localhost:3001'）
        ├── express.json() + express.urlencoded()
        ├── sessionMiddleware（讀取 X-Session-Id → req.sessionId）
        ├── 掛載 API 路由（/api/auth、/api/admin/*、/api/products、/api/cart、/api/orders）
        ├── 掛載 Page 路由（/）
        ├── 404 handler（API 路徑返回 JSON，其餘渲染 404.ejs）
        └── errorHandler（全域 Express 錯誤捕捉）
```

## API 路由總覽

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/auth/register` | 無 | 使用者註冊 |
| POST | `/api/auth/login` | 無 | 使用者登入 |
| GET  | `/api/auth/profile` | JWT | 取得個人資料 |
| GET  | `/api/products` | 無 | 商品列表（分頁） |
| GET  | `/api/products/:id` | 無 | 商品詳情 |
| GET  | `/api/cart` | JWT 或 Session | 查看購物車 |
| POST | `/api/cart` | JWT 或 Session | 加入購物車 |
| PATCH | `/api/cart/:itemId` | JWT 或 Session | 修改數量 |
| DELETE | `/api/cart/:itemId` | JWT 或 Session | 移除項目 |
| POST | `/api/orders` | JWT | 從購物車建立訂單 |
| GET  | `/api/orders` | JWT | 我的訂單列表 |
| GET  | `/api/orders/:id` | JWT | 訂單詳情 |
| PATCH | `/api/orders/:id/pay` | JWT | 模擬付款 |
| GET  | `/api/admin/products` | JWT + admin | 後台商品列表 |
| POST | `/api/admin/products` | JWT + admin | 新增商品 |
| PUT  | `/api/admin/products/:id` | JWT + admin | 編輯商品 |
| DELETE | `/api/admin/products/:id` | JWT + admin | 刪除商品 |
| GET  | `/api/admin/orders` | JWT + admin | 後台訂單列表（可篩選狀態） |
| GET  | `/api/admin/orders/:id` | JWT + admin | 後台訂單詳情（含 user 資訊） |

## 統一回應格式

所有 API 回應統一使用以下三欄結構：

```json
// 成功
{
  "data": { ... },
  "error": null,
  "message": "成功"
}

// 失敗
{
  "data": null,
  "error": "VALIDATION_ERROR",
  "message": "email、password、name 為必填欄位"
}
```

**error code 列表：**

| error code | 對應情境 |
|------------|---------|
| `VALIDATION_ERROR` | 參數缺失或格式錯誤 |
| `UNAUTHORIZED` | 未登入、token 無效或已過期、使用者不存在 |
| `FORBIDDEN` | 已登入但角色不足（非 admin） |
| `NOT_FOUND` | 資源不存在 |
| `CONFLICT` | 重複資源（Email 重複、商品有未完成訂單） |
| `CART_EMPTY` | 購物車無商品即建立訂單 |
| `STOCK_INSUFFICIENT` | 庫存不足 |
| `INVALID_STATUS` | 訂單狀態不符（已付款/失敗的訂單再次付款） |
| `INTERNAL_ERROR` | 伺服器內部錯誤（errorHandler 統一覆寫） |

## 認證與授權機制

### Standard JWT Auth（`authMiddleware`）

用於 `/api/auth/profile`、`/api/orders/*`、`/api/admin/*`。

1. 從 `Authorization: Bearer <token>` header 提取 token
2. 以 `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` 驗證
3. 再次查詢 DB 確認 user 存在（防止帳號刪除後 token 仍有效）
4. 將 `{ userId, email, role }` 附加至 `req.user`

JWT payload：`{ userId, email, role }`，有效期：**7 天**，演算法：**HS256**

### Admin Guard（`adminMiddleware`）

接在 `authMiddleware` 之後執行，檢查 `req.user.role === 'admin'`，否則返回 403 FORBIDDEN。

管理員路由在 **router 層** 統一套用兩個 middleware（`router.use(authMiddleware, adminMiddleware)`），不在個別路由套用。

### Session Middleware（`sessionMiddleware`）

全域掛載於 `app.js`，從 `X-Session-Id` header 讀取值，附加至 `req.sessionId`。若 header 不存在，`req.sessionId` 為 `undefined`。

### 購物車雙模式認證（`dualAuth`）

購物車 API 獨有的內部 middleware，邏輯如下：

```
if Authorization header 存在:
  嘗試驗證 JWT
  → 成功：設定 req.user，繼續
  → 失敗：直接返回 401（不 fallback 至 session）
else if req.sessionId 存在:
  繼續（訪客模式，req.user 為 undefined）
else:
  返回 401
```

購物車資料的擁有判別：
- 已登入（`req.user` 存在）：以 `user_id` 欄位識別
- 訪客（`req.sessionId` 存在）：以 `session_id` 欄位識別

## 資料庫 Schema

資料庫為 SQLite，WAL 模式，外鍵約束啟用。

### users

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL（bcrypt） |
| name | TEXT | NOT NULL |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user', 'admin') |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') |

### products

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| name | TEXT | NOT NULL |
| description | TEXT | 可為 NULL |
| price | INTEGER | NOT NULL, CHECK(price > 0) |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) |
| image_url | TEXT | 可為 NULL |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') |

### cart_items

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| session_id | TEXT | 可為 NULL（訪客購物車） |
| user_id | TEXT | 可為 NULL（FOREIGN KEY → users.id） |
| product_id | TEXT | NOT NULL（FOREIGN KEY → products.id） |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) |

`session_id` 與 `user_id` 互斥：一筆資料只會設定其中一個。

### orders

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| order_no | TEXT | UNIQUE NOT NULL（格式：`ORD-YYYYMMDD-XXXXX`） |
| user_id | TEXT | NOT NULL（FOREIGN KEY → users.id） |
| recipient_name | TEXT | NOT NULL |
| recipient_email | TEXT | NOT NULL |
| recipient_address | TEXT | NOT NULL |
| total_amount | INTEGER | NOT NULL |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'paid', 'failed') |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') |

### order_items

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| order_id | TEXT | NOT NULL（FOREIGN KEY → orders.id） |
| product_id | TEXT | NOT NULL（FOREIGN KEY → products.id） |
| product_name | TEXT | NOT NULL（快照，不隨商品更新而變動） |
| product_price | INTEGER | NOT NULL（快照） |
| quantity | INTEGER | NOT NULL |

`product_name` 與 `product_price` 為快照欄位，記錄下單當下的值，不受後續商品修改影響。

## 訂單建立流程（Transaction）

建立訂單時，以 `db.transaction()` 確保原子性，以下步驟全部成功才提交：

1. 查詢使用者的 `cart_items`（JOIN products）
2. 驗證購物車非空、每項商品庫存充足
3. 計算 `total_amount`
4. INSERT `orders`
5. 遍歷購物車，INSERT `order_items`（快照商品名稱與價格）
6. 遍歷購物車，`UPDATE products SET stock = stock - quantity`
7. `DELETE FROM cart_items WHERE user_id = ?`（清空購物車）

任一步驟拋出例外，整個 transaction 回滾。

## 頁面路由結構

| URL | 版型 | 說明 |
|-----|------|------|
| `/` | front | 首頁（商品列表） |
| `/products/:id` | front | 商品詳情 |
| `/cart` | front | 購物車 |
| `/checkout` | front | 結帳 |
| `/login` | front | 登入 |
| `/orders` | front | 我的訂單列表 |
| `/orders/:id` | front | 訂單詳情（`?payment=success\|fail` 顯示付款結果） |
| `/admin/products` | admin | 後台商品管理 |
| `/admin/orders` | admin | 後台訂單管理 |

EJS 渲染模式：先渲染 `pages/xxx.ejs` 為 `body` 字串，再注入至 `layouts/front.ejs` 或 `layouts/admin.ejs`（兩段式渲染）。
