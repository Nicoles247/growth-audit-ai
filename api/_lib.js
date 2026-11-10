// Shared helpers for the paid quick audit: prompt, Gemini call, sealed tokens, Stripe.
// Env vars: GEMINI_API_KEY (required), TOKEN_SECRET (required), STRIPE_SECRET_KEY (enables the paywall),
// AUDIT_PRICE_CENTS (default 1200), SITE_URL (optional, e.g. https://auditaconmigo.com).
const crypto = require('crypto');

const MAX_FIELD = 600;

function clean(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, MAX_FIELD);
}

function sanitizeData(raw) {
  const d = raw || {};
  return {
    nombre: clean(d.nombre),
    industria: clean(d.industria),
    anos: clean(d.anos),
    ciudad: clean(d.ciudad),
    redesStr: clean(d.redesStr),
    problema: clean(d.problema),
    intentado: clean(d.intentado),
    metasStr: clean(d.metasStr),
    presupuesto: clean(d.presupuesto),
  };
}

function buildQuickPrompt(lang, d) {
  if (lang === 'es') {
    return `Actúa como un consultor experto en marketing digital y crecimiento para pequeños negocios locales, especializado en el mercado hispano de Estados Unidos.

Analiza este negocio y genera una AUDITORÍA DE CRECIMIENTO completa y personalizada:

INFORMACIÓN DEL NEGOCIO:
- Nombre: ${d.nombre}
- Industria: ${d.industria}
- Años en operación: ${d.anos}
- Ciudad: ${d.ciudad || 'No especificada'}
- Redes sociales activas: ${d.redesStr || 'Ninguna'}

SITUACIÓN ACTUAL:
- Mayor reto actual: ${d.problema}
- Qué han intentado sin éxito: ${d.intentado || 'No especificado'}

OBJETIVOS:
- Metas principales: ${d.metasStr}
- Presupuesto mensual disponible: ${d.presupuesto || 'No especificado'}

INSTRUCCIONES IMPORTANTES:
- Responde completamente en ESPAÑOL.
- Adapta todas las recomendaciones al presupuesto disponible. Si es "Sin presupuesto" o menos de $100, enfócate en estrategias 100% gratuitas.
- NO repitas estrategias que ya intentaron sin éxito.
- Considera los años de operación: un negocio nuevo necesita construir desde cero; uno de varios años necesita escalar o corregir.
- Alinea el plan de 30 días con las metas específicas del negocio.

Responde ÚNICAMENTE en formato JSON válido (sin markdown, sin backticks, sin texto adicional), con esta estructura exacta:
{
"diagnostico": "Párrafo de 3-4 oraciones diagnosticando la situación actual, considerando los años en operación, lo que ya intentaron y el presupuesto disponible",
"puntuacion_presencia_digital": 7,
"areas_criticas": ["área crítica 1", "área crítica 2", "área crítica 3"],
"plan_30_dias": [
{"semana": "Semana 1", "accion": "Acción específica, accionable y dentro del presupuesto disponible"},
{"semana": "Semana 2", "accion": "Acción específica y accionable"},
{"semana": "Semana 3", "accion": "Acción específica y accionable"},
{"semana": "Semana 4", "accion": "Acción específica y accionable"}
],
"ideas_contenido": ["idea de post 1 con descripción", "idea 2", "idea 3", "idea 4", "idea 5"],
"mensaje_promocional": "Copy de marketing listo para copiar y pegar, máximo 280 caracteres, tono cálido",
"quick_win": "UNA sola acción concreta que el negocio puede hacer HOY MISMO sin costo ni espera"
}`;
  }
  return `Act as an expert consultant in digital marketing and growth for small local businesses in the United States.

Analyze this business and generate a complete, personalized GROWTH AUDIT:

BUSINESS INFORMATION:
- Name: ${d.nombre}
- Industry: ${d.industria}
- Years in business: ${d.anos}
- City: ${d.ciudad || 'Not specified'}
- Active social media: ${d.redesStr || 'None'}

CURRENT SITUATION:
- Biggest current challenge: ${d.problema}
- What they've tried without success: ${d.intentado || 'Not specified'}

GOALS:
- Main goals: ${d.metasStr}
- Available monthly budget: ${d.presupuesto || 'Not specified'}

IMPORTANT INSTRUCTIONS:
- Respond entirely in ENGLISH.
- Adapt every recommendation to the available budget. If it's "No budget" or under $100, focus on 100% free strategies.
- Do NOT repeat strategies they already tried without success.
- Consider years in business: a new business needs to build from scratch; a business with several years needs to scale or fix what's not working.
- Align the 30-day plan with the business's specific goals.

Respond ONLY in valid JSON format (no markdown, no backticks, no extra text), with this exact structure:
{
"diagnostico": "3-4 sentence paragraph diagnosing the current situation, considering years in business, what they already tried, and available budget",
"puntuacion_presencia_digital": 7,
"areas_criticas": ["critical area 1", "critical area 2", "critical area 3"],
"plan_30_dias": [
{"semana": "Week 1", "accion": "Specific, actionable step within the available budget"},
{"semana": "Week 2", "accion": "Specific, actionable step"},
{"semana": "Week 3", "accion": "Specific, actionable step"},
{"semana": "Week 4", "accion": "Specific, actionable step"}
],
"ideas_contenido": ["post idea 1 with description", "idea 2", "idea 3", "idea 4", "idea 5"],
"mensaje_promocional": "Ready-to-copy marketing copy, max 280 characters, warm tone",
"quick_win": "ONE concrete action the business can do TODAY at no cost and no waiting"
}`;
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw httpError(500, 'Server is missing GEMINI_API_KEY');
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) {
    const status = res.status === 429 ? 503 : 502;
    throw httpError(status, res.status === 429 ? 'busy' : 'ai_error');
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

function secretKey() {
  const s = process.env.TOKEN_SECRET;
  if (!s || s.length < 16) throw httpError(500, 'Server is missing TOKEN_SECRET');
  return crypto.createHash('sha256').update(s).digest();
}

// AES-256-GCM: the browser holds the full result but can't read or alter it until payment.
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

function unseal(token) {
  try {
    const buf = Buffer.from(String(token), 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
  } catch (e) {
    throw httpError(400, 'invalid_token');
  }
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function paywallOn() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function priceCents() {
  const n = parseInt(process.env.AUDIT_PRICE_CENTS || '1200', 10);
  return Number.isFinite(n) && n >= 50 ? n : 1200;
}

async function stripe(method, path, params) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw httpError(502, 'payment_error');
  return data;
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers.host}`;
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function handler(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      res.status(200).json(await fn(req, body));
    } catch (e) {
      console.error(e);
      res.status(e.status || 500).json({ error: e.status ? e.message : 'server_error' });
    }
  };
}

module.exports = {
  sanitizeData, buildQuickPrompt, callGemini, seal, unseal, tokenHash,
  paywallOn, priceCents, stripe, siteUrl, httpError, handler,
};
