# TESTING.md

## 測試技術棧

- **框架**：Vitest ^2.1.9（`globals: true`，可直接使用 `describe`、`it`、`expect` 等，不需 import）
- **HTTP 測試**：supertest ^7.2.2
- **資料庫**：使用正式資料庫 `database.sqlite`（非 mock，非記憶體 DB）

## 測試檔案清單

| 檔案 | 說明 |
|------|------|
| `tests/setup.js` | 輔助函式（非測試套件） |
| `tests/auth.test.js` | 使用者認證 API 測試 |
| `tests/products.test.js` | 商品列表/詳情 API 測試 |
| `tests/cart.test.js` | 購物車 API 測試（含訪客與會員模式） |
| `tests/orders.test.js` | 訂單建立/查詢/付款 API 測試 |
| `tests/adminProducts.test.js` | 後台商品管理 API 測試 |
| `tests/adminOrders.test.js` | 後台訂單管理 API 測試 |

## 執行順序與依賴關係

`vitest.config.js` 中設定 `fileParallelism: false`，強制依以下順序**逐一**執行（不並行）：

```
auth.test.js
  └─ 建立使用者、取得 token
products.test.js
  └─ 讀取商品列表、取得 productId（供後續使用）
cart.test.js
  └─ 依賴 products 存在才能加入購物車
orders.test.js
  └─ 依賴 products + cart 功能；測試中 beforeAll 會先加入商品至購物車
adminProducts.test.js
  └─ 依賴 admin seed 帳號（seed 於 DB 初始化時建立）
adminOrders.test.js
  └─ 在 beforeAll 中建立一筆完整訂單供後續查詢測試使用
```

測試順序不可任意調換，因為後面的測試依賴前面的測試所建立的 DB 狀態（特別是 orders.test.js 依賴 products 存在且購物車功能可用）。

## 輔助函式（tests/setup.js）

```js
// 以 seed 管理員帳號登入，返回 JWT token
async function getAdminToken(): Promise<string>

// 動態生成唯一 email 並註冊新使用者，返回 { token, user }
async function registerUser(overrides = {}): Promise<{ token: string, user: object }>
```

`registerUser` 使用 `${Date.now()}-${Math.random().toString(36).slice(2)}` 確保每次呼叫都生成唯一 email，避免測試間衝突。

## 執行測試

```bash
# 執行全部測試
npm test

# 執行單一測試檔案
npx vitest run tests/auth.test.js

# 觀察模式（自動重跑）
npx vitest
```

## 撰寫新測試

### 步驟

1. 在 `tests/` 目錄新增 `<feature>.test.js`
2. 在 `vitest.config.js` 的 `sequence.files` 中加入新檔案（插入適當位置以滿足依賴順序）
3. 使用 `setup.js` 中的輔助函式取得 token
4. 使用 `supertest` 發送 HTTP 請求並驗證回應

### 範例：新增一個認證必要的 API 測試

```js
const { app, request, registerUser } = require('./setup');

describe('Coupon API', () => {
  let userToken;
  let couponId;

  beforeAll(async () => {
    const { token } = await registerUser();
    userToken = token;
  });

  it('should apply a valid coupon', async () => {
    const res = await request(app)
      .post('/api/coupons/apply')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'WELCOME10' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body).toHaveProperty('message');
  });

  it('should return 404 for non-existent coupon', async () => {
    const res = await request(app)
      .post('/api/coupons/apply')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'INVALID' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('data', null);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).not.toBeNull();
  });
});
```

### 測試訪客模式（購物車）

```js
const sessionId = 'test-session-' + Date.now(); // 唯一 session ID

const res = await request(app)
  .post('/api/cart')
  .set('X-Session-Id', sessionId)
  .send({ productId, quantity: 1 });
```

### 測試需要 admin 的 API

```js
const { getAdminToken } = require('./setup');

let adminToken;
beforeAll(async () => {
  adminToken = await getAdminToken();
});

it('should require admin role', async () => {
  const { token: userToken } = await registerUser();
  const res = await request(app)
    .get('/api/admin/something')
    .set('Authorization', `Bearer ${userToken}`);

  expect(res.status).toBe(403);
});
```

## 常見陷阱

### 測試不隔離資料庫

本專案測試使用正式 `database.sqlite`（非記憶體 DB），每次測試執行後資料都會留在 DB 中。這意味著：

- 測試中建立的使用者、訂單、商品在每次 `npm test` 後都會累積
- 若 seed 資料被修改，可能導致測試失敗（例如手動刪除所有商品後，cart.test.js 的 `beforeAll` 無法取得 productId）
- 測試 email 使用時間戳確保唯一性，但 DB 持久化意味著重複執行仍會累積 user 資料

若要重置 DB，手動刪除 `database.sqlite` 後重啟伺服器，會重新建立並 seed。

### 測試執行順序不可變更

`vitest.config.js` 中的 `sequence.files` 順序是強制的，不可任意調換。`orders.test.js` 在 `beforeAll` 中需要可用商品且購物車功能正常，若先跑 orders 再跑 products 會失敗。

### 管理員帳號依賴 seed

`getAdminToken()` 使用 `ADMIN_EMAIL` / `ADMIN_PASSWORD`（預設 `admin@hexschool.com` / `12345678`）。測試環境必須保持 `.env` 中這兩個值與 `src/database.js` 的 seed 資料一致，否則 `getAdminToken()` 會回傳 undefined token。

### bcrypt 在測試環境的處理

`src/database.js` 中以 `NODE_ENV === 'test'` 判斷 bcrypt salt rounds：
- `test` 環境：rounds = 1（快速）
- 其他環境：rounds = 10（安全）

但 Vitest 並不會自動設定 `NODE_ENV=test`。若 `authRoutes.js` 的 `register` handler 使用 `saltRounds = 10`，測試中的 `registerUser()` 呼叫會較慢，但不影響正確性。只有 seed 管理員（在 DB 初始化時執行）受到 `NODE_ENV` 影響。

### 購物車 session 測試

購物車測試中使用 `'test-session-' + Date.now()` 作為 session ID，確保每次測試執行使用不同的 session，避免上次執行殘留的 cart_items 影響當前測試。
