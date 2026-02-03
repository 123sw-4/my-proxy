import { HTMLRewriter } from '@vercel/edge';

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

  // --- 2. 解析目标 URL ---
  let targetUrlStr = pathRaw;
  
  // 智能修正：如果不是以 http 开头，尝试通过 Referer 自动补全
  if (!targetUrlStr.startsWith('http')) {
    const referer = request.headers.get('Referer');
    if (referer && referer.startsWith(workerOrigin)) {
      try {
        const refererUrl = new URL(referer);
        const refererTargetStr = refererUrl.pathname.slice(1) + refererUrl.search;
        if (refererTargetStr.startsWith('http')) {
          const refererTarget = new URL(refererTargetStr);
          targetUrlStr = refererTarget.origin + url.pathname + url.search;
        }
      } catch(e) {}
    }
  }

  // 再次检查，如果还没解析出来，就默认跳回首页
  if (!targetUrlStr.startsWith('http')) {
     return handleHome(workerOrigin);
  }

  // --- 3. 发起代理请求 ---
  let targetUrl;
  try {
    targetUrl = new URL(targetUrlStr);
  } catch (e) {
    return new Response('无效网址', { status: 400 });
  }

  // 重写请求头，伪装成浏览器直接访问
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('Host', targetUrl.hostname);
  proxyHeaders.set('Referer', targetUrl.href);
  proxyHeaders.set('Origin', targetUrl.origin);
  // 删除 Vercel 特有头，防止暴露
  ['x-vercel-id', 'x-vercel-forwarded-for', 'x-forwarded-for'].forEach(h => proxyHeaders.delete(h));

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
    
    // 修正重定向路径
    if (resHeaders.has('Location')) {
      let loc = resHeaders.get('Location');
      if (loc.startsWith('http')) {
        resHeaders.set('Location', `${workerOrigin}/${loc}`);
      } else if (loc.startsWith('/')) {
        resHeaders.set('Location', `${workerOrigin}/${targetUrl.origin}${loc}`);
      }
    }

    // 修正 Cookie 域限制
    if (resHeaders.has('Set-Cookie')) {
       resHeaders.set('Set-Cookie', resHeaders.get('Set-Cookie').replace(/Domain=[^;]+;/gi, ''));
    }

    // HTML 内容重写 (核心：把页面里的链接都替换掉)
    const contentType = resHeaders.get('Content-Type');
    if (contentType && contentType.includes('text/html')) {
      let rewriter = new HTMLRewriter();
      const tags = {
        'a': 'href', 'img': 'src', 'link': 'href', 'script': 'src', 
        'form': 'action', 'iframe': 'src'
      };
      
      for (const [tag, attr] of Object.entries(tags)) {
        rewriter.on(tag, {
          element(element) {
            const val = element.getAttribute(attr);
            if (val) {
              // 简单暴力的替换逻辑
              if (val.startsWith('http')) element.setAttribute(attr, `${workerOrigin}/${val}`);
              else if (val.startsWith('//')) element.setAttribute(attr, `${workerOrigin}/https:${val}`);
              else if (val.startsWith('/')) element.setAttribute(attr, `${workerOrigin}/${targetUrl.origin}${val}`);
            }
          }
        });
      }
      return rewriter.transform(new Response(proxyRes.body, { status: proxyRes.status, headers: resHeaders }));
    }

    return new Response(proxyRes.body, { status: proxyRes.status, headers: resHeaders });

  } catch (e) {
    return new Response(`代理错误: ${e.message}`, { status: 500 });
  }
}

// 简单的中文首页
function handleHome(origin) {
  const html = `
    <!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>极简 Vercel 代理</title>
    <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5}
    .box{background:#fff;padding:2rem;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.1);text-align:center;width:90%;max-width:400px}
    input{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:5px;box-sizing:border-box}
    button{width:100%;padding:10px;background:#000;color:#fff;border:none;border-radius:5px;cursor:pointer}
    </style></head>
    <body><div class="box"><h3>🚀 Vercel Proxy</h3>
    <form onsubmit="event.preventDefault();var u=document.getElementById('u').value.trim();if(u){window.location.href='${origin}/'+(u.startsWith('http')?u:'https://'+u)}">
    <input id="u" placeholder="输入网址 (如 google.com)" required><button>访问</button></form></div></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html' } });
}
