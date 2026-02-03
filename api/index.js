import { HTMLRewriter } from '@vercel/edge';

export const config = {
  runtime: 'edge',
};

// 拦截规则配置
const REWRITE_CONFIG = {
  // 基础链接
  'a': 'href',
  'area': 'href',
  'link': 'href',
  'script': 'src',
  'form': 'action',
  
  // 媒体资源
  'img': 'src',
  'iframe': 'src',
  'video': 'src',
  'audio': 'src',
  'source': 'src',
  'embed': 'src',
  'object': 'data',
  'track': 'src',
  
  // ✨ GitHub 专属优化 (处理懒加载和动态内容)
  'img': ['src', 'data-src', 'data-hi-res-src'], // 头像和高清图
  'include-fragment': 'src', // GitHub 的动态加载块
  'image-crop': 'src',       // 图片裁剪工具
  'div': 'data-url',         // 部分动态组件
};

export default async function handler(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;
  const pathRaw = url.pathname.slice(1) + url.search;

  // --- 1. 首页与快捷指令 ---
  if (url.pathname === '/' || url.pathname === '') {
    return handleHome(workerOrigin);
  }
  
  // 快捷指令: 输入 /gh 直接跳转 GitHub
  if (pathRaw === 'gh' || pathRaw === 'github') {
    return Response.redirect(`${workerOrigin}/https://github.com`, 302);
  }

  // --- 2. 解析目标 URL ---
  let targetUrlStr = pathRaw;
  
  // 智能修正 Referer (防止 CSS/JS 404)
  if (!targetUrlStr.startsWith('http')) {
    const referer = request.headers.get('Referer');
    if (referer && referer.startsWith(workerOrigin)) {
      try {
        const refererUrl = new URL(referer);
        const refererTargetStr = refererUrl.pathname.slice(1) + refererUrl.search;
        if (refererTargetStr.startsWith('http')) {
          const refererTarget = new URL(refererTargetStr);
          // 拼接相对路径
          targetUrlStr = new URL(targetUrlStr, refererTarget.href).href;
        }
      } catch(e) {}
    }
  }

  // 还没解析出来？回首页
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
  proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'); // 伪装 User-Agent 防止被 GitHub 拦截
  
  ['x-vercel-id', 'x-vercel-forwarded-for', 'x-forwarded-for', 'via'].forEach(h => proxyHeaders.delete(h));

  try {
    const proxyRes = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
      redirect: 'manual'
    });

    // --- 4. 响应处理 ---
    const resHeaders = new Headers(proxyRes.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');
    resHeaders.delete('content-security-policy'); // 关键：移除 GitHub 严格的安全策略
    resHeaders.delete('content-security-policy-report-only');
    resHeaders.delete('clear-site-data');

    // 处理重定向
    if (resHeaders.has('Location')) {
      let loc = resHeaders.get('Location');
      if (loc.startsWith('http')) {
        resHeaders.set('Location', `${workerOrigin}/${loc}`);
      } else if (loc.startsWith('/')) {
        resHeaders.set('Location', `${workerOrigin}/${targetUrl.origin}${loc}`);
      }
    }

    // HTML 重写 (核心优化部分)
    const contentType = resHeaders.get('Content-Type');
    if (contentType && contentType.includes('text/html')) {
      let rewriter = new HTMLRewriter();
      
      // 遍历配置进行重写
      for (const [tag, attrs] of Object.entries(REWRITE_CONFIG)) {
        const attrList = Array.isArray(attrs) ? attrs : [attrs];
        rewriter.on(tag, {
          element(element) {
            for (const attr of attrList) {
              const val = element.getAttribute(attr);
              if (val) {
                if (val.startsWith('http')) element.setAttribute(attr, `${workerOrigin}/${val}`);
                else if (val.startsWith('//')) element.setAttribute(attr, `${workerOrigin}/https:${val}`);
                else if (val.startsWith('/')) element.setAttribute(attr, `${workerOrigin}/${targetUrl.origin}${val}`);
              }
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

// 界面增加 GitHub 快捷方式
function handleHome(origin) {
  const html = `
    <!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>GitHub 优化版代理</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#0d1117;color:#c9d1d9}
      .box{background:#161b22;padding:2rem;border-radius:6px;border:1px solid #30363d;text-align:center;width:90%;max-width:400px}
      h3{color:#fff;margin-top:0}
      input{width:100%;padding:10px;margin:15px 0;border:1px solid #30363d;border-radius:6px;box-sizing:border-box;background:#0d1117;color:#fff}
      button{width:100%;padding:10px;background:#238636;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600}
      button:hover{background:#2ea043}
      .quick{margin-top:15px;font-size:12px}
      .quick a{color:#58a6ff;text-decoration:none;margin:0 5px}
    </style></head>
    <body><div class="box">
      <h3>🐙 GitHub Proxy</h3>
      <form onsubmit="event.preventDefault();var u=document.getElementById('u').value.trim();if(u){window.location.href='${origin}/'+(u.startsWith('http')?u:'https://'+u)}">
      <input id="u" placeholder="输入网址..." required>
      <button>Go</button>
      </form>
      <div class="quick">
        快捷跳转: 
        <a href="${origin}/https://github.com">GitHub</a>
        <a href="${origin}/https://raw.githubusercontent.com">Raw</a>
        <a href="${origin}/https://www.google.com">Google</a>
      </div>
    </div></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html' } });
}
