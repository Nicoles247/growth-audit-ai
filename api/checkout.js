// POST {token, lang} -> Stripe Checkout URL for unlocking that specific audit.
const L = require('./_lib');

module.exports = L.handler(async (req, body) => {
  if (!L.paywallOn()) throw L.httpError(400, 'paywall_off');
  const sealed = L.unseal(body.token);
  const es = body.lang !== 'en';
  const base = L.siteUrl(req);
  const session = await L.stripe('POST', '/checkout/sessions', {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(L.priceCents()),
    'line_items[0][price_data][product_data][name]': es
      ? `Plan de crecimiento completo — ${sealed.nombre}`.slice(0, 200)
      : `Complete growth plan — ${sealed.nombre}`.slice(0, 200),
    'metadata[token_hash]': L.tokenHash(body.token),
    success_url: `${base}/?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?cancel=1`,
    locale: es ? 'es' : 'en',
  });
  return { url: session.url };
});
