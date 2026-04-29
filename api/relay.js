export const config = {
  runtime: 'nodejs',        
  // runtime: 'edge',       
};

const TARGET = process.env.TARGET_DOMAIN?.trim().replace(/\/$/, '');

if (!TARGET) {
  console.error('TARGET_DOMAIN environment variable is missing');
}

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-connection', 'transfer-encoding',
  'te', 'upgrade', 'trailer', 'content-length', 'expect'
]);

export default async function handler(req) {

  if (req.method === 'GET' && req.url === '/' && 
      req.headers.get('accept')?.includes('text/html')) {
    return fetch(new URL('/index.html', `http://${req.headers.get('host')}`));
  }

  if (!TARGET) {
    return new Response('Service Unavailable', { status: 503 });
  }

  const url = new URL(req.url, `http://${req.headers.get('host')}`);
  const targetUrl = TARGET + url.pathname + url.search;


  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    const k = key.toLowerCase();
    if (HOP_BY_HOP.has(k) || k.startsWith('x-vercel-') || k === 'host') {
      continue;
    }
    headers.set(key, value);
  }


  const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor.split(',')[0].trim());
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.body,        
      duplex: 'half',
      redirect: 'manual',
    });

    
    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const key of HOP_BY_HOP) {
      responseHeaders.delete(key);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });

  } catch (err) {
    console.error('Relay error:', err.message);
    return new Response('Bad Gateway', { status: 502 });
  }
}