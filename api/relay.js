export const config = {
  runtime: 'nodejs',     // توصیه می‌کنم اول با nodejs تست کنی (کمتر CPU می‌خوره)
  // runtime: 'edge',    // اگر می‌خوای Edge، این رو فعال کن و خط بالا رو کامنت کن
};

const TARGET = process.env.TARGET_DOMAIN?.trim()?.replace(/\/$/, '');

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-connection', 'transfer-encoding',
  'te', 'upgrade', 'trailer', 'content-length', 'expect'
]);

export default async function handler(req) {
  // نمایش صفحه وب برای کاربران عادی
  if (req.method === 'GET' && req.url === '/' && 
      req.headers.get('accept')?.includes('text/html')) {
    return fetch(new URL('/index.html', `http://${req.headers.get('host')}`));
  }

  if (!TARGET) {
    return new Response('Service Configuration Error', { status: 503 });
  }

  const url = new URL(req.url, `http://${req.headers.get('host')}`);
  const targetUrl = TARGET + url.pathname + url.search;

  const headers = new Headers();

  for (const [key, value] of req.headers) {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k) || k.startsWith('x-vercel-') || k === 'host') continue;
    headers.set(key, value);
  }

  const realIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (realIP) headers.set('x-forwarded-for', realIP.split(',')[0].trim());

  try {
    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      duplex: 'half',
      redirect: 'manual',
    });

    const responseHeaders = new Headers(res.headers);
    for (const key of HOP_BY_HOP) responseHeaders.delete(key);

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });

  } catch (err) {
    console.error('Relay Error:', err.message);
    return new Response('Bad Gateway', { status: 502 });
  }
}
