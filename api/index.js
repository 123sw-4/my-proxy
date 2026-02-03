export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;
  const pathRaw = url.pathname.slice(1) + url.search;

  // --- 1. 首页处理 ---
  if (url.pathname === '/' || url.pathname === '') {
    return handleHome(workerOrigin);
  }
  
  // 快捷指令
  if (pathRaw === 'gh') return Response.redirect(`${workerOrigin}/https://github.com`, 302);

  // --- 2. 解析目标 URL ---
  let targetUrlStr = pathRaw;
  
  // 智能修正 Referer
  if (!targetUrlStr.startsWith('http')) {
    const referer = request.headers.get('Referer');
    if (referer && referer.startsWith(workerOrigin)) {
      try {
        const refererUrl = new URL(referer);
        const targetPart = refererUrl.pathname.slice(1) + refererUrl.search;
        if (targetPart.startsWith('http')) {
           targetUrlStr = new URL(targetUrlStr, targetPart).href;
        }
      } catch(e) {}
    }
  }

  if (!targetUrlStr.startsWith('http')) {
     return handleHome(workerOrigin);
  }

  // --- 3. 发起请求 ---
  let targetUrl;
  try {
    targetUrl = new URL(targetUrlStr);
  } catch (e) {
    return new Response('无效网址', { status: 400 });
  }

  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('Host', targetUrl.hostname);
  proxyHeaders.set('Referer', targetUrl.href);
  proxyHeaders.set('Origin', targetUrl.origin);
  proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 删除 Vercel 特有头
  ['x-vercel-id', 'x-vercel-forwarded-for', 'x-forwarded-for', 'via'].forEach(h => proxyHeaders.delete(h));

  try {
    const proxyRes = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
      redirect: 'manual'
    });

    // --- 4. 处理响应 ---
    const resHeaders = new Headers(proxyRes.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.delete('content-security-policy');
    resHeaders.delete('content-security-policy-report-only');
    resHeaders.delete('clear-site-data');

    // 修正重定向
    if (resHeaders.has('Location')) {
      let loc = resHeaders.get('Location');
      if (loc.startsWith('http')) {
        resHeaders.set('Location', `${workerOrigin}/${loc}`);
      } else if (loc.startsWith('/')) {
        resHeaders.set('Location', `${workerOrigin}/${targetUrl.origin}${loc}`);
      }
    }

    // 修正 Cookie
    if (resHeaders.has('Set-Cookie')) {
       resHeaders.set('Set-Cookie', resHeaders.get('Set-Cookie').replace(/Domain=[^;]+;/gi, ''));
    }

    const contentType = resHeaders.get('Content-Type');
    
    // 如果是 HTML，使用文本替换 (Regex) 而不是 HTMLRewriter
    if (contentType && contentType.includes('text/html')) {
      let text = await proxyRes.text();
      const origin = targetUrl.origin;
      
      // 简单的正则替换：寻找 href="...", src="..." 等
      // 1. 绝对路径 http... -> 代理路径
      text = text.replace(/(href|src|action|data-src) déplacement=["'](http[^"']+)["']/g, (match, attr, url) => {
        return `${attr}="${workerOrigin}/${url}"`;
      });
      
      // 2. 相对路径 /path... -> 代理路径/原域/path
      text = text.replace(/(href|src|action|data-src) déplacement=["'](\/[^/][^"']*)["']/g, (match, attr, path) => {
        return `${attr}="${workerOrigin}/${origin}${path}"`;
      });
      
      // 3. 协议相对路径 //domain... -> 代理路径/https:domain
      text = text.replace(/(href|src|action|data-src) déplacement=["'](\/\/[^"']+)["']/g, (match, attr, url) => {
        return `${attr}="${workerOrigin}/https:${url}"`;
      });

      return new Response(text, { status: proxyRes.status, headers: resHeaders });
    }

    return new Response(proxyRes.body, { status: proxyRes.status, headers: resHeaders });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

function handleHome(origin) {
  const html = `
    <!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Vercel 零依赖代理</title>
    <style>body{font-family:sans-serif;background:#000;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh}
    .box{text-align:center;border:1px solid #333;padding:2rem;border-radius:10px}
    input{padding:10px;width:100%;margin:10px 0;border-radius:5px;border:none}
    button{padding:10px 20px;background:#fff;color:#000;border:none;border-radius:5px;cursor:pointer;font-weight:bold}</style>
    </head><body><div class="box"><h3>⚡ Zero Proxy</h3>
    <form onsubmit="event.preventDefault();var u=document.getElementById('u').value;window.location.href='${origin}/'+(u.startsWith('http')?u:'https://'+u)">
    <input id="u" placeholder="google.com" required><button>Go</button></form></div></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html' } });
}
