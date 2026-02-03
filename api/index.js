// api/index.js
import { handleHome } from './ui.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;
  const pathRaw = url.pathname.slice(1) + url.search;

  // 1. 如果没有输入网址，显示中文首页
  if (url.pathname === '/' || url.pathname === '') {
    return handleHome(workerOrigin);
  }
  
  // 快捷指令: 如果输入 /gh 直接跳去 GitHub
  if (pathRaw === 'gh') return Response.redirect(`${workerOrigin}/https://github.com`, 302);

  // 2. 解析目标 URL
  let targetUrlStr = pathRaw;
  
  // 智能修正 Referer (解决 CSS/图片 404 问题)
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

  // 还是解析不出 http? 返回首页
  if (!targetUrlStr.startsWith('http')) {
     return handleHome(workerOrigin);
  }

  // 3. 构建代理请求
  let targetUrl;
  try {
    targetUrl = new URL(targetUrlStr);
  } catch (e) {
    return new Response('❌ 错误：无效的网址链接', { status: 400 });
  }

  // 伪装请求头
  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('Host', targetUrl.hostname);
  proxyHeaders.set('Referer', targetUrl.href);
  proxyHeaders.set('Origin', targetUrl.origin);
  proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 移除隐私和 Vercel 特有头
  ['x-vercel-id', 'x-vercel-forwarded-for', 'x-forwarded-for', 'via', 'cookie'].forEach(h => proxyHeaders.delete(h));

  try {
    const proxyRes = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
      redirect: 'manual'
    });

    // 4. 处理响应头
    const resHeaders = new Headers(proxyRes.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.delete('content-security-policy');
    resHeaders.delete('content-security-policy-report-only');
    resHeaders.delete('clear-site-data');

    // 修正重定向 Location
    if (resHeaders.has('Location')) {
      let loc = resHeaders.get('Location');
      if (loc.startsWith('http')) {
        resHeaders.set('Location', `${workerOrigin}/${loc}`);
      } else if (loc.startsWith('/')) {
        resHeaders.set('Location', `${workerOrigin}/${targetUrl.origin}${loc}`);
      }
    }

    // 修正 Cookie 域 (允许简单的 Cookie 写入，但保持安全)
    if (resHeaders.has('Set-Cookie')) {
       resHeaders.set('Set-Cookie', resHeaders.get('Set-Cookie').replace(/Domain=[^;]+;/gi, ''));
    }

    // 5. 网页内容替换 (核心：把页面里的链接换成代理链接)
    const contentType = resHeaders.get('Content-Type');
    if (contentType && contentType.includes('text/html')) {
      let text = await proxyRes.text();
      const origin = targetUrl.origin;
      
      // 正则替换：无需第三方库
      text = text.replace(/(href|src|action|data-src) déplacement=["'](http[^"']+)["']/g, `$1="${workerOrigin}/$2"`);
      text = text.replace(/(href|src|action|data-src) déplacement=["'](\/[^/][^"']*)["']/g, `$1="${workerOrigin}/${origin}$2"`);
      text = text.replace(/(href|src|action|data-src) déplacement=["'](\/\/[^"']+)["']/g, `$1="${workerOrigin}/https:$2"`);

      return new Response(text, { status: proxyRes.status, headers: resHeaders });
    }

    return new Response(proxyRes.body, { status: proxyRes.status, headers: resHeaders });

  } catch (e) {
    return new Response(`❌ 代理请求失败: ${e.message}`, { status: 500 });
  }
}
