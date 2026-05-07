# DEVELOPMENT.md

## 模組系統

本專案使用 **CommonJS**（`require` / `module.exports`），**不使用** ES Module（`import` / `export`）。

例外：`vitest.config.js` 使用 ES Module 語法（`import { defineConfig }`），因為 Vitest 設定檔有獨立的 ESM 上下文。

## 命名規則

| 類別 | 規則 | 範例 |
|------|------|------|
| 檔案名稱（路由） | camelCase + `Routes.js` | `productRoutes.js`、`adminOrderRoutes.js` |
| 檔案名稱（middleware） | camelCase + `Middleware.js` / `Handler.js` | `authMiddleware.js`、`errorHandler.js` |
| 檔案名稱（頁面） | kebab-case `.ejs` | `product-detail.ejs`、`order-detail.ejs` |
| 函式名稱 | camelCase | `getOwnerCondition`、`generateOrderNo`、`renderFront` |
| 資料庫欄位 | snake_case | `password_hash`、`user_id`、`created_at` |
| API 回應欄位 | snake_case | `order_no`、`total_amount`、`image_url` |
| API 請求 body 欄位（訂單） | camelCase | `recipientName`、`recipientEmail`、`recipientAddress` |
| API 請求 body 欄位（購物車） | camelCase | `productId`、`quantity` |
| 環境變數 | SCREAMING_SNAKE_CASE | `JWT_SECRET`、`ADMIN_EMAIL` |
| 常數（物件） | camelCase | `actionMap`、`SAFE_MESSAGES` |

注意：DB 欄位與 API 回應欄位統一使用 snake_case，但部分 POST body 欄位（如訂單收件人資訊）使用 camelCase，這是故意的設計（前端友善）。

## 環境變數

| 變數 | 用途 | 必要 | 預設值 |
|------|------|------|--------|
| `JWT_SECRET` | JWT 簽名金鑰 | **必填**（server.js 啟動時強制檢查） | 無 |
| `PORT` | 伺服器監聽埠號 | 否 | `3001` |
| `BASE_URL` | 伺服器 base URL（OpenAPI docs 使用） | 否 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許的來源 | 否 | `http://localhost:3001` |
| `ADMIN_EMAIL` | Seed 管理員 email | 否 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | Seed 管理員密碼 | 否 | `12345678` |
| `NODE_ENV` | 環境標識（`test` 時 bcrypt rounds = 1） | 否 | 無 |
| `ECPAY_MERCHANT_ID` | 綠界商店代號（預留） | 否 | `3002607` |
| `ECPAY_HASH_KEY` | 綠界 Hash Key（預留） | 否 | 見 .env.example |
| `ECPAY_HASH_IV` | 綠界 Hash IV（預留） | 否 | 見 .env.example |
| `ECPAY_ENV` | 綠界環境（staging / production，預留） | 否 | `staging` |

ECPay 相關變數目前為預留欄位，尚未整合至付款流程。

## 新增 API 路由

1. 在 `src/routes/` 新增路由檔案，例如 `src/routes/couponRoutes.js`
2. 在 `app.js` 掛載路由：
   ```js
   app.use('/api/coupons', require('./src/routes/couponRoutes'));
   ```
3. 在路由 handler 上方加入 `@openapi` JSDoc 註解（swagger-jsdoc 從 `src/routes/*.js` 讀取）
4. 若需認證，在 `router.use()` 或個別路由中套用 `authMiddleware` 和/或 `adminMiddleware`
5. 回應統一使用 `{ data, error, message }` 格式

## 新增 Middleware

1. 在 `src/middleware/` 新增檔案，例如 `src/middleware/rateLimitMiddleware.js`
2. 匯出函式（標準 Express middleware 簽名：`(req, res, next) => {}`）
3. 在 `app.js`（全域）或特定路由檔案（局部）`require` 並套用

## 新增資料表

1. 在 `src/database.js` 的 `db.exec()` 中加入 `CREATE TABLE IF NOT EXISTS ...`
2. 若有外鍵，確認外鍵欄位已在被引用的表建立完成（SQLite 建表順序很重要）
3. 若需 seed 資料，新增對應函式並在 `initializeDatabase()` 中呼叫
4. 更新 [ARCHITECTURE.md](./ARCHITECTURE.md) 中的資料庫 Schema 章節

## JSDoc / OpenAPI 格式

每個路由 handler 上方加入 `@openapi` 格式的 JSDoc 區塊，供 swagger-jsdoc 自動解析產生 API 文件：

```js
/**
 * @openapi
 * /api/coupons:
 *   post:
 *     summary: 使用優惠券
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 優惠券不存在或已過期
 */
router.post('/', authMiddleware, (req, res) => {
  // ...
});
```

`tags` 對應 swagger-config.js 中定義的 tag 群組。`security` 使用 `bearerAuth`（JWT）或 `sessionId`（X-Session-Id）。

執行 `npm run openapi` 後會在根目錄產生 `openapi.json`。

## 計畫歸檔流程

1. 計畫檔案命名格式：`YYYY-MM-DD-<feature-name>.md`
   - 範例：`2026-05-07-coupon-system.md`

2. 計畫文件結構：
   ```markdown
   # 功能名稱

   ## User Story
   As a ...，I want to ...，so that ...

   ## Spec
   - API 設計
   - DB 設計
   - 業務邏輯

   ## Tasks
   - [ ] 建立 DB schema
   - [ ] 實作 API
   - [ ] 撰寫測試
   - [ ] 更新文件
   ```

3. 功能完成後：將計畫檔案移至 `docs/plans/archive/`

4. 更新 `docs/FEATURES.md`：在功能清單中加入新功能，狀態標記為「完成」

5. 更新 `docs/CHANGELOG.md`：在對應版本下加入變更紀錄

## SQL 操作規範

所有 SQL 操作必須使用 better-sqlite3 的 prepared statements，**禁止**字串拼接 SQL：

```js
// 正確
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// 禁止
const user = db.prepare(`SELECT * FROM users WHERE id = '${userId}'`).get();
```

多筆資料寫入使用 `db.transaction()` 包裹：

```js
const insertMany = db.transaction((items) => {
  for (const item of items) {
    stmt.run(item.id, item.value);
  }
});
insertMany(data);
```

## 頁面渲染模式（EJS）

前台和後台頁面使用兩段式渲染：

```js
// pageRoutes.js 中的 renderFront helper
function renderFront(res, page, locals = {}) {
  res.render('pages/' + page, { layout: 'front', ...locals }, function (err, body) {
    if (err) return res.status(500).send(err.message);
    res.render('layouts/front', { body, ...locals });
  });
}
```

步驟：
1. 先渲染 `pages/xxx.ejs`，將 HTML 存入 `body` 變數
2. 將 `body` 注入 `layouts/front.ejs` 主版型

新增前台頁面時：
1. 在 `views/pages/` 新增 `.ejs` 檔案
2. 在 `pageRoutes.js` 新增路由，使用 `renderFront(res, 'page-name', { title, pageScript })`

`pageScript` 對應 `public/js/` 目錄下的 JavaScript 檔案名稱（不含副檔名），由版型自動引入。
