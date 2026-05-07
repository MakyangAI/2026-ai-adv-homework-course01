const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const HASH_KEY = process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6';
const HASH_IV  = process.env.ECPAY_HASH_IV  || 'EkRm7iFT261dpevs';
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || '3002607';
const IS_STAGING = (process.env.ECPAY_ENV || 'staging') !== 'production';

// CMV-SHA256 專用的 URL encode（ecpayUrlEncode）
// 與 AES 服務的 aesUrlEncode 邏輯不同，不可混用
function ecpayUrlEncode(str) {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27')
    .toLowerCase()
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

function generateCheckMacValue(params) {
  const sorted = Object.entries(params)
    .filter(([k]) => k !== 'CheckMacValue')
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const raw = `HashKey=${HASH_KEY}&` + sorted.map(([k, v]) => `${k}=${v}`).join('&') + `&HashIV=${HASH_IV}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

function verifyCheckMacValue(params) {
  const received = (params.CheckMacValue || '').toUpperCase();
  const computed = generateCheckMacValue(params);
  if (received.length !== computed.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(received));
}

function getTaiwanDateString() {
  const now = new Date();
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${utc8.getUTCFullYear()}/${pad(utc8.getUTCMonth() + 1)}/${pad(utc8.getUTCDate())} ${pad(utc8.getUTCHours())}:${pad(utc8.getUTCMinutes())}:${pad(utc8.getUTCSeconds())}`;
}

function buildItemName(items) {
  const name = items.map(item => `${item.product_name} x${item.quantity}`).join('#');
  return name.length > 200 ? name.slice(0, 200) : name;
}

function buildFormParams(order, items, baseUrl) {
  // MerchantTradeNo: 英數字，最長 20 字元，永久唯一
  const merchantTradeNo = `EC${Date.now()}`;
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: getTaiwanDateString(),
    PaymentType: 'aio',
    TotalAmount: order.total_amount,
    TradeDesc: '花卉電商購物',
    ItemName: buildItemName(items),
    ReturnURL: `${baseUrl}/ecpay/notify`,
    OrderResultURL: `${baseUrl}/ecpay/result`,
    ClientBackURL: `${baseUrl}/orders/${order.id}?payment=cancel`,
    ChoosePayment: 'ALL',
    EncryptType: 1,
    CustomField1: order.id,
  };
  params.CheckMacValue = generateCheckMacValue(params);
  return params;
}

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = querystring.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let chunks = '';
      res.on('data', chunk => { chunks += chunk; });
      res.on('end', () => resolve(chunks));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 主動呼叫 QueryTradeInfo/V5 查詢交易狀態
// 回傳物件，TradeStatus === '1' 代表付款成功
async function queryTradeInfo(merchantTradeNo) {
  const params = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  const url = IS_STAGING
    ? 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'
    : 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5';

  const text = await httpsPost(url, params);
  return Object.fromEntries(new URLSearchParams(text));
}

module.exports = { buildFormParams, queryTradeInfo, verifyCheckMacValue, IS_STAGING };
