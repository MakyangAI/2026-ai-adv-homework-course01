# FEATURES.md

## 功能完成狀態

| 功能模組 | 狀態 |
|---------|------|
| 使用者認證（註冊/登入/個人資料） | 完成 |
| 商品列表與詳情（公開） | 完成 |
| 購物車（訪客/會員雙模式） | 完成 |
| 訂單建立（購物車轉訂單） | 完成 |
| 訂單查詢（個人） | 完成 |
| 模擬付款（success / fail） | 完成 |
| 綠界 ECPay AIO 金流串接 | 完成 |
| 後台商品管理（CRUD） | 完成 |
| 後台訂單管理（列表/詳情） | 完成 |
| OpenAPI 文件產生 | 完成 |
| EJS 前台頁面 | 完成 |
| EJS 後台頁面 | 完成 |

---

## 使用者認證

### 行為描述

使用者以 email + password 在系統中建立帳號。密碼以 bcrypt 雜湊儲存（正式環境 salt rounds = 10，測試環境 = 1）。帳號的 `role` 固定為 `user`，管理員帳號由 seed 資料建立，不提供公開建立管理員的 API。

登入或註冊成功後，回傳 JWT token（HS256、有效期 7 天），後續需要認證的 API 均在 `Authorization: Bearer <token>` header 帶入此 token。

### 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊 |
| POST | `/api/auth/login` | 登入 |
| GET  | `/api/auth/profile` | 個人資料（需 JWT） |

### 請求欄位

**POST /api/auth/register**
| 欄位 | 必填 | 說明 |
|------|------|------|
| email | 是 | 需符合 email 格式，不可重複 |
| password | 是 | 至少 6 個字元 |
| name | 是 | 使用者顯示名稱 |

**POST /api/auth/login**
| 欄位 | 必填 | 說明 |
|------|------|------|
| email | 是 | |
| password | 是 | |

### 錯誤情境

| HTTP | error code | 情境 |
|------|-----------|------|
| 400 | VALIDATION_ERROR | 缺少必填欄位、email 格式錯誤、密碼少於 6 字元 |
| 401 | UNAUTHORIZED | 密碼錯誤（登入時） |
| 404 | NOT_FOUND | JWT 有效但 user 已不存在於 DB |
| 409 | CONFLICT | Email 已被使用（註冊時） |

---

## 商品列表與詳情

### 行為描述

公開 API，不需任何認證。商品按 `created_at DESC` 排序。列表支援分頁，`page` 和 `limit` 以 query string 傳入。`limit` 上限為 100，超過會被截斷至 100。`page` 最小值為 1，傳入非數字時預設為 1。

### 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/products` | 商品列表 |
| GET | `/api/products/:id` | 商品詳情 |

### 查詢參數（列表）

| 參數 | 預設值 | 說明 |
|------|--------|------|
| page | 1 | 頁碼，最小 1 |
| limit | 10 | 每頁數量，最小 1，最大 100 |

### 回應資料結構（列表）

```json
{
  "data": {
    "products": [...],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

### 錯誤情境

| HTTP | error code | 情境 |
|------|-----------|------|
| 404 | NOT_FOUND | 商品不存在（詳情） |

---

## 購物車（雙模式認證）

### 行為描述

購物車支援兩種使用者模式，透過 `dualAuth` middleware 實作：

**會員模式（Bearer JWT）**：購物車資料以 `user_id` 欄位識別，資料跨裝置共享。

**訪客模式（X-Session-Id）**：購物車資料以 `session_id` 欄位識別，由前端自行生成並管理 session ID（UUID 或任意字串均可）。

**重要**：若 `Authorization` header 存在但 token 無效，系統**不會**嘗試 fallback 至 session 模式，直接返回 401。只有在完全沒有 `Authorization` header 時才使用 session 模式。

**加入購物車累加邏輯**：若相同商品已在購物車中，系統將數量累加（現有數量 + 新增數量），並在累加前驗證是否超過庫存。若超過庫存則返回 400 STOCK_INSUFFICIENT。若商品不在購物車中，則新建一筆 cart_item。

### 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET    | `/api/cart` | 查看購物車 |
| POST   | `/api/cart` | 加入商品 |
| PATCH  | `/api/cart/:itemId` | 修改數量（直接設定，非累加） |
| DELETE | `/api/cart/:itemId` | 移除項目 |

### 請求欄位

**POST /api/cart（加入購物車）**
| 欄位 | 必填 | 說明 |
|------|------|------|
| productId | 是 | 商品 UUID |
| quantity | 否 | 預設為 1，必須為正整數 |

**PATCH /api/cart/:itemId（修改數量）**
| 欄位 | 必填 | 說明 |
|------|------|------|
| quantity | 是 | 必須為正整數，直接設定為此值（非累加） |

### 購物車回應資料

```json
{
  "data": {
    "items": [
      {
        "id": "cart-item-uuid",
        "product_id": "product-uuid",
        "quantity": 2,
        "product": {
          "name": "粉色玫瑰花束",
          "price": 1680,
          "stock": 30,
          "image_url": "https://..."
        }
      }
    ],
    "total": 3360
  }
}
```

`total` 由後端計算：`items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)`

### 錯誤情境

| HTTP | error code | 情境 |
|------|-----------|------|
| 400 | VALIDATION_ERROR | productId 缺失、quantity 不是正整數 |
| 400 | STOCK_INSUFFICIENT | 加入或更新時庫存不足 |
| 401 | UNAUTHORIZED | 未提供有效 token 或 session ID |
| 404 | NOT_FOUND | 商品不存在（加入時）、購物車項目不存在（修改/刪除時） |

---

## 訂單系統

### 行為描述

訂單 API **全部需要 JWT**，不支援訪客模式。建立訂單時，系統從**當前使用者的 `user_id`** 查詢購物車（非 session 購物車），因此訪客在結帳前必須先登入。

**建立訂單的原子 transaction 流程**：
1. 查詢使用者購物車（含商品資訊）
2. 驗證購物車非空
3. 驗證所有商品庫存充足
4. 計算總金額
5. 建立 order 記錄（`order_no` 格式：`ORD-YYYYMMDD-XXXXX`，XXXXX 為 UUID 前 5 碼大寫）
6. 建立每筆 order_item（快照商品名稱與價格）
7. 扣減每筆商品庫存
8. 清空使用者購物車

以上步驟在 `db.transaction()` 中執行，任一失敗均回滾。

**模擬付款**：`PATCH /api/orders/:id/pay` 接受 `action: "success"` 或 `action: "fail"`，將訂單 status 從 `pending` 更新為 `paid` 或 `failed`。只有 `pending` 狀態的訂單可以付款，已付款或失敗的訂單再次呼叫此 API 會返回 400。

### 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST  | `/api/orders` | 從購物車建立訂單 |
| GET   | `/api/orders` | 我的訂單列表（按 created_at DESC） |
| GET   | `/api/orders/:id` | 訂單詳情（含 items） |
| PATCH | `/api/orders/:id/pay` | 模擬付款 |

### 請求欄位

**POST /api/orders**
| 欄位 | 必填 | 說明 |
|------|------|------|
| recipientName | 是 | 收件人姓名 |
| recipientEmail | 是 | 收件人 email（需通過格式驗證） |
| recipientAddress | 是 | 收件地址 |

**PATCH /api/orders/:id/pay**
| 欄位 | 必填 | 說明 |
|------|------|------|
| action | 是 | `"success"` 或 `"fail"` |

### 訂單狀態流程

```
pending ──[action=success]──▶ paid
        ──[action=fail]────▶ failed
```

`paid` 和 `failed` 為終態，無法再次呼叫付款 API。

### 錯誤情境

| HTTP | error code | 情境 |
|------|-----------|------|
| 400 | VALIDATION_ERROR | 必填欄位缺失、email 格式錯誤、action 值非法 |
| 400 | CART_EMPTY | 購物車無商品 |
| 400 | STOCK_INSUFFICIENT | 建立訂單時某商品庫存不足 |
| 400 | INVALID_STATUS | 訂單已非 pending 狀態 |
| 401 | UNAUTHORIZED | 未提供 JWT 或 token 無效 |
| 404 | NOT_FOUND | 訂單不存在（含查詢其他使用者的訂單） |

---

## 後台商品管理

### 行為描述

所有後台 API 需要 JWT + `role === 'admin'`，由 `authMiddleware + adminMiddleware` 雙重守衛在 router 層統一套用。

商品列表與前台 `/api/products` 邏輯相同，但允許篩選所有商品（包含庫存為 0 的商品）。

**刪除商品保護**：刪除前會查詢是否有 `status = 'pending'` 的訂單含有此商品，若有則拒絕刪除（409 CONFLICT），避免訂單資料殘缺。已付款或失敗的訂單中的商品可以刪除（order_items 保有快照資料）。

**編輯商品**：`PUT /api/admin/products/:id` 使用全量更新語意，但每個欄位均為選填，未傳入的欄位保留現有值（並非強制全替換）。`updated_at` 在每次更新時自動更新為 `datetime('now')`。

### 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET    | `/api/admin/products` | 商品列表（分頁） |
| POST   | `/api/admin/products` | 新增商品 |
| PUT    | `/api/admin/products/:id` | 編輯商品 |
| DELETE | `/api/admin/products/:id` | 刪除商品 |

### 請求欄位

**POST /api/admin/products（新增）**
| 欄位 | 必填 | 說明 |
|------|------|------|
| name | 是 | 商品名稱 |
| price | 是 | 正整數（>0） |
| stock | 是 | 非負整數（>=0） |
| description | 否 | 商品描述 |
| image_url | 否 | 圖片 URL |

**PUT /api/admin/products/:id（編輯）**
| 欄位 | 必填 | 說明 |
|------|------|------|
| name | 否 | 不可為空字串（trim 後） |
| price | 否 | 正整數 |
| stock | 否 | 非負整數 |
| description | 否 | |
| image_url | 否 | |

### 錯誤情境

| HTTP | error code | 情境 |
|------|-----------|------|
| 400 | VALIDATION_ERROR | 新增時缺少必填欄位、price/stock 型別錯誤、name 為空字串 |
| 401 | UNAUTHORIZED | 未提供 JWT |
| 403 | FORBIDDEN | 已登入但非 admin |
| 404 | NOT_FOUND | 商品不存在（編輯/刪除） |
| 409 | CONFLICT | 商品有 pending 訂單（刪除時） |

---

## 綠界 ECPay AIO 金流串接

### 行為描述

整合綠界科技 AIO（All-In-One）金流，讓使用者在付款時跳轉至綠界付款頁面，完成付款後由綠界回調本站更新訂單狀態。

**付款流程**：
1. 前端呼叫 `POST /api/orders/:id/ecpay-form`，取得 AIO Checkout 的表單 `action` URL 與所有參數（含 CheckMacValue）
2. 前端動態建立 HTML form 並 POST 至綠界 AIO Checkout
3. 使用者在綠界付款頁面完成付款（信用卡、ATM、超商代碼、WebATM 等）
4. 付款完成後，綠界將瀏覽器 Form POST 導回本站 `OrderResultURL`（`/ecpay/result`）
5. 本站主動呼叫綠界 `QueryTradeInfo/V5` API 驗證交易狀態（避免依賴可偽造的前端參數）
6. 依據 `TradeStatus === '1'` 更新訂單狀態為 `paid` 或 `failed`，並重新導向訂單詳情頁

**Server-to-Server ReturnURL**：`POST /ecpay/notify` 端點固定回應 `1|OK`；本地開發環境無法接收綠界主動呼叫，故不作為主要驗證依據。

**CheckMacValue 產生**：
- 參數依 key 字典序排序（case-insensitive）
- 串接格式：`HashKey={key}&{params}&HashIV={iv}`
- 套用 ECPay 專用 URL Encode（`+` 代替 `%20`，部分符號轉義不同於標準 RFC 3986）
- SHA-256 雜湊後轉大寫

**環境切換**：透過環境變數 `ECPAY_ENV=production` 切換正式環境，預設為 staging（測試）環境。

### 核心模組

`src/ecpay.js` 提供以下函式，由 route handler 直接 require 使用：

| 函式 | 說明 |
|------|------|
| `generateCheckMacValue(params)` | 依規格產生 CheckMacValue（SHA-256） |
| `verifyCheckMacValue(params)` | 驗證 CheckMacValue（timing-safe 比對） |
| `buildFormParams(order, items, baseUrl)` | 組出送往 AIO Checkout 的完整表單參數 |
| `queryTradeInfo(merchantTradeNo)` | 主動查詢綠界 QueryTradeInfo/V5 取得交易狀態 |
| `IS_STAGING` | boolean，`true` 時使用測試環境端點 |

### 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/orders/:id/ecpay-form` | 產生 AIO Checkout 表單參數（需 JWT） |
| POST | `/ecpay/result` | OrderResultURL 回調（綠界導回，不需認證） |
| POST | `/ecpay/notify` | ReturnURL dummy，固定回應 `1|OK` |

### 請求與回應

**POST /api/orders/:id/ecpay-form**

無需 body，JWT 認證即可。

成功回應（`200`）：
```json
{
  "data": {
    "action": "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
    "params": {
      "MerchantID": "3002607",
      "MerchantTradeNo": "EC1715000000000",
      "MerchantTradeDate": "2026/05/12 10:00:00",
      "PaymentType": "aio",
      "TotalAmount": 3360,
      "TradeDesc": "花卉電商購物",
      "ItemName": "粉色玫瑰花束 x2",
      "ReturnURL": "https://yourdomain/ecpay/notify",
      "OrderResultURL": "https://yourdomain/ecpay/result",
      "ClientBackURL": "https://yourdomain/orders/{id}?payment=cancel",
      "ChoosePayment": "ALL",
      "EncryptType": 1,
      "CustomField1": "{order-uuid}",
      "CheckMacValue": "..."
    }
  },
  "error": null,
  "message": ""
}
```

**POST /ecpay/result（OrderResultURL）**

由綠界以 Form POST 呼叫，帶入 `CustomField1`（order UUID）及 `MerchantTradeNo`。
本站主動查詢 QueryTradeInfo 後，根據結果 redirect 至 `/orders/{id}?payment=success|failed|cancel`。

### 環境變數

| 變數 | 預設值（Staging） | 說明 |
|------|-----------------|------|
| `ECPAY_MERCHANT_ID` | `3002607` | 綠界商店代號 |
| `ECPAY_HASH_KEY` | `pwFHCqoQZGmho4w6` | AES/SHA256 金鑰 |
| `ECPAY_HASH_IV` | `EkRm7iFT261dpevs` | AES/SHA256 向量 |
| `ECPAY_ENV` | `staging` | `staging` 或 `production` |
| `BASE_URL` | `{req.protocol}://{req.host}` | 回調 URL 的 base，正式環境需設定 |

### 錯誤情境

| HTTP | error code | 情境 |
|------|-----------|------|
| 400 | INVALID_STATUS | 訂單狀態非 `pending`，無法送出付款 |
| 401 | UNAUTHORIZED | 未提供 JWT |
| 404 | NOT_FOUND | 訂單不存在或不屬於當前使用者 |

---

## 後台訂單管理

### 行為描述

後台訂單列表顯示所有使用者的訂單（非僅當前使用者），支援分頁和狀態篩選。狀態篩選使用 `?status=pending|paid|failed` query string，只接受這三個值，非法值則不套用篩選（顯示全部）。

後台訂單詳情額外包含下訂單的 user 資訊（name、email），若 user 已被刪除則 `user` 欄位為 `null`。

### 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/admin/orders` | 後台訂單列表 |
| GET | `/api/admin/orders/:id` | 後台訂單詳情（含 user） |

### 查詢參數（列表）

| 參數 | 預設值 | 說明 |
|------|--------|------|
| page | 1 | 頁碼 |
| limit | 10 | 每頁數量（最大 100） |
| status | 無（全部） | pending / paid / failed |

### 錯誤情境

| HTTP | error code | 情境 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 未提供 JWT |
| 403 | FORBIDDEN | 非 admin |
| 404 | NOT_FOUND | 訂單不存在 |
