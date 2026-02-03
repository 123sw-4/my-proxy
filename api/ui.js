// api/ui.js

// =================================================================
// 👇👇👇 【自定义配置区】 (在这里修改所有的文字、图片和链接) 👇👇👇
// =================================================================
const CONFIG = {
  // 1. 网页标题 (显示在浏览器标签页)
  pageTitle: "我的专属代理",

  // 2. 主标题 (显示在页面中间的大字)
  mainTitle: "所谓测试",

  // 3. 副标题 (小字说明)
  subTitle: "安全 · 极速 · 隐私保护",

  // 4. 输入框提示文字
  inputPlaceholder: "输入网址，开始探索 (例如: google.com)",

  // 5. 按钮文字
  buttonText: "立即出发",

  // 6. 背景图片 (建议用深色系图片，或者后面加 ?q=80 来压缩图片大小)
  // 备用图1 (极光): https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2940&auto=format&fit=crop
  // 备用图2 (赛博): https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=2070
  bgImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2940&auto=format&fit=crop',

  // 7. 快捷方式列表 (你可以自由增加或删除)
  shortcuts: [
    { name: "谷歌搜索", url: "https://www.google.com" },
    { name: "GitHub",  url: "https://github.com" },
    { name: "维基百科", url: "https://zh.wikipedia.org" },
    { name: "YouTube", url: "https://www.youtube.com" },
    { name: "Twitter", url: "https://twitter.com" }
  ]
};
// =================================================================
// 👆👆👆 【配置区结束】 (下面的代码通常不需要动) 👆👆👆
// =================================================================


export function handleHome(origin) {
  // 自动生成快捷链接的 HTML
  const shortcutsHtml = CONFIG.shortcuts.map(item => {
    return `<a href="${origin}/${item.url}">${item.name}</a>`;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${CONFIG.pageTitle}</title>
      <style>
        :root {
          --glass-bg: rgba(255, 255, 255, 0.1);
          --glass-border: rgba(255, 255, 255, 0.2);
          --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
          --primary-color: #6366f1;
        }
        body {
          margin: 0; min-height: 100vh;
          display: flex; justify-content: center; align-items: center;
          font-family: -apple-system, "Microsoft YaHei", sans-serif;
          color: white;
          background: url('${CONFIG.bgImage}') no-repeat center center fixed;
          background-size: cover;
        }
        /* 黑色遮罩层，防止背景太亮看不清字 */
        body::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.4); z-index: -1;
        }
        .glass-card {
          background: var(--glass-bg);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--glass-border);
          box-shadow: var(--glass-shadow);
          padding: 3rem; border-radius: 24px;
          width: 90%; max-width: 480px; text-align: center;
          animation: fadeInUp 0.8s ease-out;
        }
        h1 { margin: 0 0 10px; font-weight: 200; letter-spacing: 4px; font-size: 28px; text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
        p.subtitle { font-size: 14px; opacity: 0.8; margin-bottom: 2rem; font-weight: 300; letter-spacing: 1px; }
        .input-group { position: relative; margin-bottom: 20px; }
        input {
          width: 100%; padding: 16px 20px; border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50px; background: rgba(0, 0, 0, 0.2);
          color: white; font-size: 16px; outline: none;
          transition: all 0.3s ease; box-sizing: border-box; text-align: center;
        }
        input::placeholder { color: rgba(255, 255, 255, 0.6); }
        input:focus { background: rgba(0, 0, 0, 0.4); border-color: rgba(255, 255, 255, 0.8); box-shadow: 0 0 15px rgba(255, 255, 255, 0.1); }
        button {
          padding: 14px 40px; border-radius: 50px; border: none;
          background: white; color: #333; font-weight: bold; font-size: 16px; cursor: pointer;
          transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.2); width: 100%;
        }
        button:hover { transform: translateY(-2px); background: var(--primary-color); color: white; box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4); }
        .quick-links { margin-top: 2rem; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
        .quick-links a { color: rgba(255, 255, 255, 0.7); text-decoration: none; font-size: 13px; transition: 0.2s; border-bottom: 1px solid transparent; }
        .quick-links a:hover { color: white; border-bottom-color: white; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      </style>
    </head>
    <body>
      <div class="glass-card">
        <h1>${CONFIG.mainTitle}</h1>
        <p class="subtitle">${CONFIG.subTitle}</p>
        <form onsubmit="event.preventDefault();var u=document.getElementById('u').value.trim();if(u){window.location.href='${origin}/'+(u.startsWith('http')?u:'https://'+u)}">
          <div class="input-group">
            <input id="u" type="text" placeholder="${CONFIG.inputPlaceholder}" required autocomplete="off">
          </div>
          <button type="submit">${CONFIG.buttonText}</button>
        </form>
        <div class="quick-links">
          ${shortcutsHtml}
        </div>
      </div>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
}
