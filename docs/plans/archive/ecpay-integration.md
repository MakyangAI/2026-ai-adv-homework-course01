# 綠界 ECPay 金流串接計畫

## Context

專案目前有完整的商品 → 購物車 → 結帳 → 訂單流程，付款方式為「模擬付款」按鈕（呼叫 `PATCH /api/orders/:id/pay`）。

需求：改為真正串接綠界 AIO 金流，讓使用者被導向綠界付款頁面完成信用卡付款。由於專案僅在本地端運行（`localhost:3001`），無法接收綠界 Server-to-Server 的 `ReturnURL` 回呼，因此付款驗證改為：**付款後前端返回時，由本地後端主動呼叫綠界 `QueryTradeInfo/V5` API 查詢交易狀態**。

---

## 技術選型

- **方案**：ECPay AIO（全方位金流）— 最簡單，消費者跳轉至綠界標準付款頁
- **協議**：CMV-SHA256（`ecpayUrlEncode`）
- **付款方式**：信用卡（`ChoosePayment: 'Credit'`）
- **新增依賴**：無（僅用 Node.js 內建 `crypto` + `https` 模組）

---

## 完整流程

```
1. 使用者在訂單詳情頁點擊「前往綠界付款」按鈕
2. 前端呼叫 POST /api/orders/:id/ecpay-form（帶 JWT）
3. 後端驗證身份、生成 MerchantTradeNo + 計算 CheckMacValue
   → 回傳 JSON { action: "https://payment-stage.ecpay.com.tw/...", params: {...} }
4. 前端建立隱藏 <form>，自動 submit 到 ECPay
5. 使用者在綠界頁面完成信用卡付款（測試卡 4311-9522-2222-2222）
6. 綠界將瀏覽器 Form POST 重導至 OrderResultURL = http://localhost:3001/ecpay/result
7. POST /ecpay/result 接收資料：
   - 取出 CustomField1（= orderId）和 MerchantTradeNo
   - 呼叫綠界 QueryTradeInfo/V5 API 主動查詢
   - TradeStatus === '1' → 更新 order.status = 'paid'
   - 否則 → 更新 order.status = 'failed'
   - 302 重導至 /orders/:id?payment=success 或 ?payment=failed
8. 訂單詳情頁顯示付款結果訊息（現有機制已支援 paymentResult query param）
```

---

## 要修改/新增的檔案

### 1. `src/ecpay.js`（**新建**）

ECPay 工具函式模組，包含：

```javascript
// 環境設定從 .env 讀取（已有 ECPAY_MERCHANT_ID / HASH_KEY / HASH_IV / ENV）
const HASH_KEY = process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6';
const HASH_IV  = process.env.ECPAY_HASH_IV  || 'EkRm7iFT261dpevs';
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || '3002607';
const IS_STAGING = (process.env.ECPAY_ENV || 'staging') !== 'production';

// ecpayUrlEncode（CMV-SHA256 專用）
function ecpayUrlEncode(str) { ... }

// generateCheckMacValue(params) → String（SHA256 大寫 hex）
// 排序規則：key 不分大小寫字母順序，排除 CheckMacValue 本身
function generateCheckMacValue(params) { ... }

// verifyCheckMacValue(params) → Boolean（timing-safe）
function verifyCheckMacValue(params) { ... }

// getTaiwanDateString() → 'yyyy/MM/dd HH:mm:ss'（UTC+8）
function getTaiwanDateString() { ... }

// buildItemName(items) → String（最多 200 字元，多項用 # 分隔）
function buildItemName(items) { ... }

// buildFormParams(order, items, baseUrl) → Object（完整 AIO 必填 + 選填參數 + CheckMacValue）
// MerchantTradeNo = `EC${Date.now()}`（最多 15 字元，符合英數限制）
// CustomField1 = order.id（用於 OrderResultURL 還原訂單）
function buildFormParams(order, items, baseUrl) { ... }

// queryTradeInfo(merchantTradeNo) → Promise<Object>（回傳 ECPay QueryTradeInfo 結果）
// 使用 Node.js 內建 https 模組發 POST，回應為 URL-encoded 字串
// 驗證回傳的 CheckMacValue，取出 TradeStatus（'1' = 付款成功）
async function queryTradeInfo(merchantTradeNo) { ... }
```

**AIO 參數設計：**
| 參數 | 值 |
|------|-----|
| ReturnURL | `{baseUrl}/ecpay/notify`（本地 dummy，ECPay 呼叫不到但格式合法） |
| OrderResultURL | `{baseUrl}/ecpay/result`（瀏覽器重導，localhost 可收到）|
| ClientBackURL | `{baseUrl}/orders/{order.id}?payment=cancel` |
| CustomField1 | `order.id`（UUID，用於還原訂單）|
| ChoosePayment | `Credit` |
| EncryptType | `1` |

---

### 2. `src/routes/orderRoutes.js`（**修改**）

在現有 routes 後方加入新端點（保留現有 mock pay 端點）：

```javascript
// POST /api/orders/:id/ecpay-form
// 驗證：authMiddleware（已在 router.use(authMiddleware) 套用）
// 驗證：order 存在、屬於當前用戶、status === 'pending'
// 回應：{ data: { action: String, params: Object }, error: null, message: '' }
router.post('/:id/ecpay-form', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(...);
  // 取得 order_items
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const params = buildFormParams(order, items, baseUrl);
  const action = IS_STAGING ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
                            : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
  res.json({ data: { action, params }, error: null, message: '' });
});
```

---

### 3. `src/routes/pageRoutes.js`（**修改**）

新增兩個路由（不需 authMiddleware，屬於公開頁面路由）：

```javascript
// POST /ecpay/result — OrderResultURL 瀏覽器重導處理
// 取出 CustomField1（orderId）和 MerchantTradeNo
// 呼叫 queryTradeInfo(merchantTradeNo)，檢查 TradeStatus
// 更新 DB → redirect /orders/:id?payment=success|failed
router.post('/ecpay/result', async (req, res) => { ... });

// POST /ecpay/notify — ReturnURL dummy（本地接不到但需有端點）
// 回應純文字 '1|OK'，HTTP 200
router.post('/ecpay/notify', (req, res) => {
  res.type('text').status(200).send('1|OK');
});
```

---

### 4. `views/pages/order-detail.ejs`（**修改**）

在 Payment Buttons 區塊（第 74-89 行），將現有的「付款成功」/「付款失敗」按鈕改為：

```html
<!-- 前往綠界付款（替換現有 2 個模擬按鈕） -->
<div v-if="order.status === 'pending'" class="flex gap-4">
  <button
    @click="goToEcpay"
    :disabled="paying"
    class="bg-sage text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-sage/90 transition-colors disabled:opacity-50"
  >
    {{ paying ? '準備中...' : '前往綠界付款' }}
  </button>
</div>
```

---

### 5. `public/js/pages/order-detail.js`（**修改**）

移除 `simulatePay` / `handlePaySuccess` / `handlePayFail`，新增：

```javascript
async function goToEcpay() {
  if (!order.value || paying.value) return;
  paying.value = true;
  try {
    const res = await apiFetch('/api/orders/' + order.value.id + '/ecpay-form', { method: 'POST' });
    const { action, params } = res.data;
    // 建立隱藏 form 並自動 submit
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    Object.entries(params).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  } catch (e) {
    Notification.show('建立付款資訊失敗', 'error');
    paying.value = false;
  }
}
```

return 中加入 `goToEcpay`，移除舊的 `handlePaySuccess` / `handlePayFail`。

---

## 不需修改

- `src/database.js` — 無需改 schema（改用 CustomField1 傳遞 orderId，不需新增欄位）
- `app.js` — 已有 `express.urlencoded({ extended: false })` 及路由設定 ✓
- `.env.example` — 已有 ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV / ECPAY_ENV ✓

---

## 測試驗證

### 測試帳號（已在 .env.example 中）
```
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
ECPAY_ENV=staging
```

### 測試信用卡
- 卡號：`4311-9522-2222-2222`
- 有效期限：任意未來日期
- CVV：任意 3 碼（如 222）
- 3DS 驗證碼：`1234`

### 端對端測試步驟
1. `npm run dev:server` 啟動伺服器
2. 登入帳號 → 加入商品至購物車 → 前往結帳
3. 填入收件資訊 → 送出訂單 → 進入訂單詳情頁
4. 點擊「前往綠界付款」→ 被導向綠界測試付款頁
5. 輸入測試信用卡完成付款
6. 確認被導回 `http://localhost:3001/ecpay/result`
7. 確認再被重導至訂單詳情頁，顯示「付款成功！感謝您的購買。」
8. 確認 DB 中訂單 `status` 已更新為 `paid`
