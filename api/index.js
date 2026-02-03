// api/index.js
// 核心逻辑文件

// 👇 这一行就是关键：从 ui.js 引入界面函数
import { handleHome } from './ui.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;
  const pathRaw = url.pathname.slice(1) + url.search;

  // --- 1. 首页处理 ---
  // 如果没有路径，直接调用 ui.js 里的函数显示界面
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

    if (resHeaders.has('Location')) {
      let loc = resHeaders.get('Location');
      if (loc.startsWith('http')) {
        resHeaders.set('Location', `${workerOrigin}/${loc}`);
      } else if (loc.startsWith('/')) {
        resHeaders.set('Location', `${workerOrigin}/${targetUrl.origin}${loc}`);
      }
    }

    if (resHeaders.has('Set-Cookie')) {
       resHeaders.set('Set-Cookie', resHeaders.get('Set-Cookie').replace(/Domain=[^;]+;/gi, ''));
    }

    const contentType = resHeaders.get('Content-Type');
    if (contentType && contentType.includes('text/html')) {
      let text = await proxyRes.text();
      const origin = targetUrl.origin;
      
      text = text.replace(/(href|src|action|data-src) déplacement=["'](http[^"']+)["']/g, `$1="${workerOrigin}/$2"`);
      text = text.replace(/(href|src|action|data-src) déplacement=["'](\/[^/][^"']*)["']/g, `$1="${workerOrigin}/${origin}$2"`);
      text = text.replace(/(href|src|action|data-src) déplacement=["'](\/\/[^"']+)["']/g, `$1="${workerOrigin}/https:$2"`);

      return new Response(text, { status: proxyRes.status, headers: resHeaders });
    }

    return new Response(proxyRes.body, { status: proxyRes.status, headers: resHeaders });

  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
