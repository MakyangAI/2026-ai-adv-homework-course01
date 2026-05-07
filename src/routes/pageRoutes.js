const express = require('express');
const router = express.Router();
const db = require('../database');
const { queryTradeInfo } = require('../ecpay');

// Helper to render with front layout
function renderFront(res, page, locals = {}) {
  res.render('pages/' + page, { layout: 'front', ...locals }, function (err, body) {
    if (err) return res.status(500).send(err.message);
    res.render('layouts/front', { body, ...locals });
  });
}

// Helper to render with admin layout
function renderAdmin(res, page, locals = {}) {
  res.render('pages/admin/' + page, locals, function (err, body) {
    if (err) return res.status(500).send(err.message);
    res.render('layouts/admin', { body, ...locals });
  });
}

// Front pages
router.get('/', function (req, res) {
  renderFront(res, 'index', { title: '首頁', pageScript: 'index' });
});

router.get('/products/:id', function (req, res) {
  renderFront(res, 'product-detail', {
    title: '商品詳情',
    pageScript: 'product-detail',
    productId: req.params.id
  });
});

router.get('/cart', function (req, res) {
  renderFront(res, 'cart', { title: '購物車', pageScript: 'cart' });
});

router.get('/checkout', function (req, res) {
  renderFront(res, 'checkout', { title: '結帳', pageScript: 'checkout' });
});

router.get('/login', function (req, res) {
  renderFront(res, 'login', { title: '登入', pageScript: 'login' });
});

router.get('/orders', function (req, res) {
  renderFront(res, 'orders', { title: '我的訂單', pageScript: 'orders' });
});

router.get('/orders/:id', function (req, res) {
  renderFront(res, 'order-detail', {
    title: '訂單詳情',
    pageScript: 'order-detail',
    orderId: req.params.id,
    paymentResult: req.query.payment || ''
  });
});

// Admin pages
router.get('/admin/products', function (req, res) {
  renderAdmin(res, 'products', {
    title: '商品管理',
    pageScript: 'admin-products',
    currentPath: '/admin/products'
  });
});

router.get('/admin/orders', function (req, res) {
  renderAdmin(res, 'orders', {
    title: '訂單管理',
    pageScript: 'admin-orders',
    currentPath: '/admin/orders'
  });
});

// ECPay OrderResultURL — 消費者付款後，綠界將瀏覽器 Form POST 導回此端點
// 本地端無法接收綠界 Server-to-Server ReturnURL，改由此處主動呼叫 QueryTradeInfo 驗證
router.post('/ecpay/result', async (req, res) => {
  const orderId = req.body.CustomField1;
  const merchantTradeNo = req.body.MerchantTradeNo;

  if (!orderId || !merchantTradeNo) {
    return res.redirect('/');
  }

  try {
    const tradeInfo = await queryTradeInfo(merchantTradeNo);
    const isPaid = tradeInfo.TradeStatus === '1';
    const newStatus = isPaid ? 'paid' : 'failed';

    db.prepare('UPDATE orders SET status = ? WHERE id = ? AND status = ?').run(newStatus, orderId, 'pending');

    res.redirect(`/orders/${orderId}?payment=${isPaid ? 'success' : 'failed'}`);
  } catch (err) {
    console.error('[ECPay] QueryTradeInfo 失敗:', err.message);
    res.redirect(`/orders/${orderId}?payment=failed`);
  }
});

// ECPay ReturnURL dummy — 本地端收不到此 Server-to-Server 呼叫，但端點必須存在
router.post('/ecpay/notify', (req, res) => {
  res.type('text').status(200).send('1|OK');
});

module.exports = router;
