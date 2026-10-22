/* Shared by the public website and the local preview. User text is never HTML. */
window.Posts = (() => {
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function inline(node, text) {
    // Keep TeX intact; interpret only simple emphasis outside math delimiters.
    const pieces = text.split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    pieces.forEach(piece => {
      if (piece.startsWith('**')) node.append(element('strong', piece.slice(2, -2)));
      else if (piece.startsWith('*')) node.append(element('em', piece.slice(1, -1)));
      else node.append(document.createTextNode(piece));
    });
  }
  function body(container, text) {
    text.split(/\n\s*\n/).filter(Boolean).forEach(block => {
      let node;
      if (/^#{1,3} /.test(block)) node = element('h3', block.replace(/^#{1,3} /, ''));
      else if (block.split('\n').every(line => line.startsWith('- '))) {
        node = element('ul');
        block.split('\n').forEach(line => { const item = element('li'); inline(item, line.slice(2)); node.append(item); });
      } else { node = element('p'); inline(node, block); }
      container.append(node);
    });
  }
  function media(container, source) {
    if (!source) return;
    let url;
    try { url = new URL(source); } catch { return; }
    if (url.protocol !== 'https:') return;
    let embed;
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
      if (/^[\w-]{11}$/.test(id || '')) embed = `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname) && /^\/\d+$/.test(url.pathname)) embed = `https://player.vimeo.com/video${url.pathname}`;
    if (embed) {
      const frame = element('iframe'); frame.src = embed; frame.title = 'Video player'; frame.loading = 'lazy'; frame.allowFullscreen = true;
      frame.allow = 'fullscreen; encrypted-media; picture-in-picture'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; container.append(frame);
    } else if (/\.(mp3|wav|ogg|m4a|mp4|webm)$/i.test(url.pathname)) {
      const player = element(/\.(mp4|webm)$/i.test(url.pathname) ? 'video' : 'audio'); player.controls = true; player.preload = 'metadata'; player.src = url.href; container.append(player);
    } else {
      const link = element('a', 'Listen / watch at the source ↗', 'contact-link'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; container.append(link);
    }
  }
  function render(post) {
    const article = element('article', undefined, 'journal-post'); article.id = `post-${post.id}`;
    const time = element('time', new Date(post.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), 'post-date'); time.dateTime = post.date; article.append(time);
    article.append(element('h2', post.title, 'post-title'));
    if (post.summary) article.append(element('p', post.summary, 'post-summary'));
    (post.images || []).forEach(image => {
      if (!/^uploads\/[a-f0-9]+\.(jpg|png|webp)$/.test(image.src)) return;
      const figure = element('figure'); const img = element('img'); img.src = image.src; img.alt = image.alt; img.loading = 'lazy'; figure.append(img); article.append(figure);
    });
    body(article, post.body || ''); media(article, post.mediaUrl); return article;
  }
  let mathReady;
  function typeset(container) {
    if (!/\\[([]/.test(container.textContent)) return;
    if (!mathReady) {
      window.MathJax = { tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], packages: { '[+]': ['noerrors'] } }, options: { enableMenu: false }, startup: { typeset: false }, loader: { load: ['[tex]/noerrors', 'ui/safe'] } };
      mathReady = new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js'; script.onload = resolve; script.onerror = reject; document.head.append(script);
      });
    }
    mathReady.then(() => window.MathJax.startup.promise).then(() => window.MathJax.typesetPromise([container])).catch(() => { /* TeX remains readable offline. */ });
  }
  return { render, typeset };
})();

if (!location.pathname.startsWith('/studio/') && document.querySelector('#art')) {
  fetch('content/posts.json', { cache: 'no-cache' }).then(response => {
    if (!response.ok) throw new Error('Content unavailable'); return response.json();
  }).then(posts => {
    if (!Array.isArray(posts)) return;
    for (const category of ['art', 'music', 'yoyo', 'math']) {
      const selected = posts.filter(post => post.category === category).sort((a, b) => b.date.localeCompare(a.date));
      if (!selected.length) continue;
      const section = document.getElementById(category);
      if (category !== 'art') section.querySelectorAll('p, .contact-link').forEach(node => node.remove());
      const journal = document.createElement('div'); journal.className = 'journal';
      if (category === 'art') { const heading = document.createElement('h2'); heading.textContent = 'New work & notes'; journal.append(heading); }
      selected.forEach(post => journal.append(Posts.render(post))); section.append(journal); Posts.typeset(journal);
    }
  }).catch(() => { /* Original static content is always available. */ });
}
