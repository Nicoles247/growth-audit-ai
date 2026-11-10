// POST {session_id, token} -> full audit, only if that Stripe session is paid and was created for this token.
const L = require('./_lib');

module.exports = L.handler(async (req, body) => {
  if (!L.paywallOn()) throw L.httpError(400, 'paywall_off');
  const id = String(body.session_id || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) throw L.httpError(400, 'invalid_session');
  const session = await L.stripe('GET', '/checkout/sessions/' + id);
  if (session.payment_status !== 'paid') throw L.httpError(402, 'not_paid');
  if (session.metadata?.token_hash !== L.tokenHash(body.token)) throw L.httpError(403, 'token_mismatch');
  const sealed = L.unseal(body.token);
  return { result: sealed.r, nombre: sealed.nombre };
});
