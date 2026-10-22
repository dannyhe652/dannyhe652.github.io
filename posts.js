/* Shared by the public website and the local preview. User text is never HTML. */
window.Posts = (() => {
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  // HTML is disabled and markdown-it validates link/image protocols. TeX is
  // tokenized before Markdown escapes/emphasis can consume its backslashes.
  const markdown = window.markdownit({ html: false, linkify: true, breaks: false });
  function escaped(source, index) {
    let slashes = 0;
    while (index > 0 && source[--index] === '\\') slashes++;
    return slashes % 2 === 1;
  }
  function mathAt(source, start) {
    const open = ['\\[', '\\(', '$$', '$'].find(value => source.startsWith(value, start));
    if (!open) return null;
    const close = { '\\[': '\\]', '\\(': '\\)', '$$': '$$', '$': '$' }[open];
    const display = open === '\\[' || open === '$$';
    if (open === '$' && /\s/.test(source[start + 1] || ' ')) return null;
    let end = start + open.length;
    while ((end = source.indexOf(close, end)) !== -1) {
      if (!escaped(source, end) && (open !== '$' ||
          (!/\s/.test(source[end - 1]) && !/\d/.test(source[end + 1] || '')))) {
        const content = source.slice(start + open.length, end);
        if (!content.trim() || (!display && content.includes('\n'))) return null;
        return { content, display, end: end + close.length };
      }
      end += close.length;
    }
    return null;
  }
  markdown.inline.ruler.before('escape', 'math', (state, silent) => {
    const math = mathAt(state.src, state.pos);
    if (!math) return false;
    if (!silent) {
      const token = state.push('math', '', 0);
      token.content = math.content; token.meta = { display: math.display };
    }
    state.pos = math.end;
    return true;
  });
  markdown.block.ruler.before('fence', 'math_block', (state, start, end, silent) => {
    const pos = state.bMarks[start] + state.tShift[start];
    if (state.sCount[start] - state.blkIndent >= 4 ||
        !['\\[', '$$'].some(open => state.src.startsWith(open, pos))) return false;
    const math = mathAt(state.src, pos);
    if (!math || math.end > state.eMarks[end - 1]) return false;
    let last = start;
    while (last < end && state.eMarks[last] < math.end) last++;
    if (state.src.slice(math.end, state.eMarks[last]).trim()) return false;
    if (silent) return true;
    const token = state.push('math_block', '', 0);
    token.block = true; token.content = math.content; token.meta = { display: true };
    token.map = [start, last + 1]; state.line = last + 1;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  // Text environments are Markdown blocks, not MathJax equations. Only known
  // names become markup; titles and bodies still pass through safe renderers.
  const environments = {
    definition: 'Definition', proof: 'Proof', theorem: 'Theorem',
    problem: 'Problem', lemma: 'Lemma', corollary: 'Corollary',
    conjecture: 'Conjecture', corolloary: 'Corollary'
  };
  const environmentStart = /^\\begin\{(definition|proof|theorem|problem|lemma|corollary|conjecture|corolloary)\}(?:\[([^\n]*)\])?\s*$/;
  const environmentEnd = /^\\end\{(definition|proof|theorem|problem|lemma|corollary|conjecture|corolloary)\}\s*$/;
  const canonicalEnvironment = name => name === 'corolloary' ? 'corollary' : name;
  markdown.block.ruler.before('fence', 'math_environment', (state, start, end, silent) => {
    if (state.sCount[start] - state.blkIndent >= 4) return false;
    const lineText = line => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
    const opening = lineText(start).match(environmentStart);
    if (!opening) return false;
    const stack = [canonicalEnvironment(opening[1])];
    let last = start + 1;
    let fence = null;
    for (; last < end; last++) {
      const line = lineText(last);
      // Delimiters inside fenced code or display math are literal content.
      if (fence) {
        if (new RegExp(`^${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = null;
        continue;
      }
      const code = line.match(/^(`{3,}|~{3,})(.*)$/);
      if (code && !(code[1][0] === '`' && code[2].includes('`'))) { fence = code[1]; continue; }
      if (state.sCount[last] - state.blkIndent >= 4) continue;
      if (line.startsWith('\\[') || line.startsWith('$$')) {
        const math = mathAt(state.src, state.bMarks[last] + state.tShift[last]);
        if (math) {
          while (last + 1 < end && state.eMarks[last] < math.end) last++;
          continue;
        }
      }
      const nested = line.match(environmentStart);
      if (nested) { stack.push(canonicalEnvironment(nested[1])); continue; }
      const closing = line.match(environmentEnd);
      if (closing) {
        if (canonicalEnvironment(closing[1]) !== stack[stack.length - 1]) return false;
        stack.pop();
        if (!stack.length) break;
      }
    }
    if (last === end) return false; // Incomplete drafts remain ordinary text.
    if (silent) return true;
    const name = canonicalEnvironment(opening[1]);
    const token = state.push('math_environment_open', 'section', 1);
    token.block = true; token.map = [start, last + 1];
    token.meta = { name, title: opening[2] || '' };
    const oldMax = state.lineMax;
    state.lineMax = last;
    state.md.block.tokenize(state, start + 1, last);
    state.lineMax = oldMax;
    const close = state.push('math_environment_close', 'section', -1);
    close.block = true; close.meta = { name };
    state.line = last + 1;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  markdown.renderer.rules.math_environment_open = (tokens, index) => {
    const { name, title } = tokens[index].meta;
    const label = environments[name] + (title ? ` (${title})` : '');
    return `<section class="math-environment math-environment-${name}" aria-label="${markdown.utils.escapeHtml(label)}">\n<p class="math-environment-label">${markdown.utils.escapeHtml(label)}.</p>\n`;
  };
  markdown.renderer.rules.math_environment_close = (tokens, index) =>
    (tokens[index].meta.name === 'proof' ? '<div class="proof-end" aria-label="End of proof">□</div>\n' : '') + '</section>\n';
  function mathHTML(tokens, index) {
    const token = tokens[index];
    const tag = token.block ? 'div' : 'span';
    const delimiters = token.meta.display ? ['\\[', '\\]'] : ['\\(', '\\)'];
    return `<${tag} class="tex-math">${markdown.utils.escapeHtml(delimiters[0] + token.content + delimiters[1])}</${tag}>`;
  }
  markdown.renderer.rules.math = mathHTML;
  markdown.renderer.rules.math_block = mathHTML;
  function body(container, text) {
    const prose = element('div', undefined, 'post-body');
    // Only parser-generated HTML reaches this sink; author HTML is escaped.
    prose.innerHTML = markdown.render(text);
    container.append(prose);
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
  let mathQueue = Promise.resolve();
  function typeset(container) {
    const nodes = [...container.querySelectorAll('.tex-math')];
    if (!nodes.length) return Promise.resolve();
    if (!mathReady) {
      window.MathJax = { tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']], packages: { '[+]': ['noerrors'] } }, options: { enableMenu: false }, startup: { typeset: false }, loader: { load: ['[tex]/noerrors', 'ui/safe'] } };
      mathReady = new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js'; script.onload = resolve; script.onerror = reject; document.head.append(script);
      });
    }
    mathQueue = mathQueue.then(() => mathReady).then(() => window.MathJax.startup.promise)
      .then(() => window.MathJax.typesetPromise(nodes.filter(node => node.isConnected)))
      .catch(() => { /* TeX remains readable offline. Allow a later retry. */ mathReady = null; });
    return mathQueue;
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
