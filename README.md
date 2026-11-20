# growth-audit-ai
AI-powered marketing audit tool for Hispanic small businesses. Built with Gemini API + Google Cloud. XPRIZE Build with Gemini 2026 — Small Business Services category.

## Auditoría de pago (link público)

El link público (`/`) ya no pide API key: la auditoría se genera en el servidor (`api/`).
El diagnóstico y el "haz esto hoy" son gratis; el plan de 30 días, las ideas de contenido,
el mensaje promocional y el PDF se desbloquean con un pago único en Stripe.
El link privado `/?modo=completa` sigue igual (usa tu propia API key en el navegador).

Variables de entorno en Vercel:

| Variable | Obligatoria | Para qué |
|---|---|---|
| `GEMINI_API_KEY` | Sí | Tu clave de Gemini (solo vive en el servidor) |
| `TOKEN_SECRET` | Sí | Texto largo y aleatorio (32+ caracteres) para sellar las auditorías |
| `STRIPE_SECRET_KEY` | No | Activa el cobro. Sin ella, todo es gratis (útil para probar) |
| `AUDIT_PRICE_CENTS` | No | Precio en centavos. Por defecto `1200` ($12) |
| `SITE_URL` | No | Tu dominio, si usas uno propio (ej. `https://auditaconmigo.com`) |

Recomendado: pon un límite de gasto en Google Cloud para la clave de Gemini.
