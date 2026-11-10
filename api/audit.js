// POST {lang, data} -> free preview + sealed token holding the full audit (or the full audit when the paywall is off).
const L = require('./_lib');

module.exports = L.handler(async (req, body) => {
  const lang = body.lang === 'en' ? 'en' : 'es';
  const d = L.sanitizeData(body.data);
  if (!d.nombre || !d.industria || !d.anos || !d.problema || !d.metasStr) throw L.httpError(400, 'missing_fields');

  const r = await L.callGemini(L.buildQuickPrompt(lang, d));
  if (!L.paywallOn()) return { locked: false, result: r };

  return {
    locked: true,
    price_cents: L.priceCents(),
    preview: {
      diagnostico: r.diagnostico,
      puntuacion_presencia_digital: r.puntuacion_presencia_digital,
      areas_criticas: r.areas_criticas,
      quick_win: r.quick_win,
    },
    token: L.seal({ r, nombre: d.nombre, t: Date.now() }),
  };
});
