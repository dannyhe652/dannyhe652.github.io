const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const markdownit = require('../assets/vendor/markdown-it.min.js');

// Exercise the actual shared renderer with a minimal DOM, without dependencies.
function renderer(setup) {
  const document = {
    createElement(tag) {
      return { tag, children: [], append(...nodes) { this.children.push(...nodes); }, setAttribute(key, value) { this[key] = value; } };
    },
    querySelector() { return null; }
  };
  const window = { markdownit };
  if (setup) setup(window, document);
  vm.runInNewContext(fs.readFileSync(require.resolve('../posts.js'), 'utf8'), {
    window, document, URL, location: { pathname: '/studio/' }
  });
  return window.Posts;
}
function html(body) {
  const post = renderer().render({ id: 'test', title: 'Test', date: '2026-01-01', body });
  return post.children.find(node => node.className === 'post-body').innerHTML;
}

test('uploaded MP4 renders with relative paths, controls and no autoplay', () => {
  const src = `uploads/${'a'.repeat(32)}.mp4`;
  const post = renderer().render({ title: 'Performance', date: '2026-01-01', videoSrc: src });
  const video = post.children.find(node => node.tag === 'video');
  assert.equal(video.src, src); // Relative URL also works under GitHub project Pages.
  assert.equal(video.controls, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.preload, 'metadata');
  assert.equal(video['aria-label'], 'Performance — video');
  assert.equal(video.autoplay, undefined);
});

test('uploaded video rejects unsafe paths and remains optional for old posts', () => {
  for (const videoSrc of [undefined, null, '', {}, 'javascript:alert(1)', 'https://example.com/v.mp4',
    '/uploads/' + 'a'.repeat(32) + '.mp4', 'uploads/../private.mp4', 'uploads/a.mp4']) {
    const post = renderer().render({ title: 'Test', date: '2026-01-01', videoSrc });
    assert.equal(post.children.some(node => node.tag === 'video'), false);
  }
});

test('external video links still render alongside an uploaded MP4', () => {
  const post = renderer().render({ title: 'Test', date: '2026-01-01',
    videoSrc: `uploads/${'a'.repeat(32)}.mp4`, mediaUrl: 'https://example.com/video.mp4' });
  assert.equal(post.children.filter(node => node.tag === 'video').length, 2);
});

test('headings, emphasis, links, nested lists, quotes, tables and code', () => {
  const result = html('# Heading\n\n**Bold** *italic* ~~removed~~ [link](https://example.com)\n\n1. First\n   - Nested\n\n> Quote\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst x = 1;\n```');
  for (const tag of ['h1', 'strong', 'em', 's', 'a', 'ol', 'ul', 'blockquote', 'table', 'pre', 'code']) {
    assert.match(result, new RegExp(`<${tag}[ >]`), tag);
  }
});

test('all math delimiters preserve TeX and protect Markdown characters', () => {
  for (const [open, close, display] of [['\\(', '\\)', false], ['\\[', '\\]', true], ['$', '$', false], ['$$', '$$', true]]) {
    const tex = String.raw`\frac{a_b}{c_d} + x^{**2**}`;
    const result = html(`Before ${open}${tex}${close} after.`);
    assert.ok(result.includes(tex));
    assert.match(result, /class="tex-math"/);
    assert.ok(result.includes(display ? '\\[' : '\\('));
    assert.doesNotMatch(result, /<(em|strong)>/);
  }
});

test('display blocks preserve newlines, blank lines and aligned environments', () => {
  const result = html(String.raw`Introduction
\[
\begin{aligned}
a &= b \\

c &= d
\end{aligned}
\]
Next paragraph.`);
  assert.match(result, /<div class="tex-math">/);
  assert.match(result, /a &amp;= b/);
  assert.match(result, /\\end\{aligned\}/);
  assert.match(result, /<p>Next paragraph\.<\/p>/);
});

test('math in code and escaped delimiters stay literal', () => {
  const result = html(String.raw`Code: \`\(x\)\` and \`$x$\`.

\`\`\`tex
\[x\]
$$y$$
\`\`\`

Escaped: \$5 and \$10. Unmatched: \(x.`.replaceAll('\\`', '`'));
  assert.doesNotMatch(result, /class="tex-math"/);
  assert.match(result, /<code>\\\(x\\\)<\/code>/);
});

test('currency is not mistaken for math and adjacent equations work', () => {
  assert.doesNotMatch(html('Costs $5 and $10; also $ 20 and $ 30.'), /tex-math/);
  assert.equal((html('$a$ and $b$').match(/tex-math/g) || []).length, 2);
});

test('HTML and malicious URLs cannot become executable markup', () => {
  const result = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n![bad](data:text/html;base64,abc)\n\n\\(<img src=x onerror=alert(1)>\\)');
  assert.doesNotMatch(result, /<script|<img|href="javascript:|src="data:/);
  assert.match(result, /&lt;script&gt;/);
});

test('soft line breaks, hard breaks and horizontal rules follow Markdown', () => {
  const result = html('One\nline.  \nNew line.\n\n---');
  assert.match(result, /One\nline\.<br>/);
  assert.match(result, /<hr>/);
});

test('all mathematical environments support titles, Markdown and math', () => {
  for (const name of ['definition', 'proof', 'theorem', 'problem', 'lemma', 'corollary', 'conjecture', 'corolloary']) {
    const result = html(`\\begin{${name}}[A title]\n**Statement** with $x^2$.\n\n- First\n- Second\n\\end{${name}}`);
    const canonical = name === 'corolloary' ? 'corollary' : name;
    assert.match(result, new RegExp(`class="math-environment math-environment-${canonical}"`));
    assert.match(result, /\(A title\)\.<\/p>/);
    assert.match(result, /<strong>Statement<\/strong>/);
    assert.match(result, /class="tex-math"/);
    assert.match(result, /<ul>/);
    assert.equal(result.includes('End of proof'), name === 'proof');
  }
});

test('nested environments, display equations and following text render separately', () => {
  const result = html(String.raw`Before.
\begin{theorem}
Outer statement.
\begin{lemma}
\[
x = y
\]
\end{lemma}
\begin{proof}
An argument.
\end{proof}
\end{theorem}
After.`);
  assert.equal((result.match(/<section /g) || []).length, 3);
  assert.equal((result.match(/<\/section>/g) || []).length, 3);
  assert.match(result, /<div class="tex-math">/);
  assert.match(result, /<\/section>\s*<p>After\.<\/p>/);
});

test('environment delimiters in code stay literal and do not close blocks', () => {
  const block = '\\begin{lemma}\nText.\n\\end{lemma}';
  assert.doesNotMatch(html('```tex\n' + block + '\n```'), /math-environment/);
  assert.doesNotMatch(html('    ' + block.replaceAll('\n', '\n    ')), /math-environment/);
  const result = html('\\begin{proof}\n```tex\n\\end{proof}\n```\nStill proving.\n\\end{proof}');
  assert.match(result, /<code class="language-tex">\\end\{proof\}/);
  assert.match(result, /Still proving\.<\/p>\s*<div class="proof-end"/);
});

test('unclosed, mismatched and unknown environments do not create sections', () => {
  for (const input of ['\\begin{theorem}\nDraft.', '\\begin{lemma}\nText\n\\end{problem}', '\\begin{unknown}\nText\n\\end{unknown}']) {
    assert.doesNotMatch(html(input), /math-environment/);
  }
});

test('environment titles and content cannot inject HTML', () => {
  const result = html('\\begin{theorem}[<img src=x onerror=alert(1)> "title"]\n<script>alert(1)</script>\n\\end{theorem}');
  assert.doesNotMatch(result, /<img|<script/);
  assert.match(result, /&lt;img/);
  assert.match(result, /&quot;title&quot;/);
});

test('posts without math do not request MathJax', async () => {
  await renderer().typeset({ querySelectorAll() { return []; } });
});

test('MathJax loads once, typesets only math, and serializes multiple requests', async () => {
  let loads = 0, active = 0;
  const calls = [];
  const posts = renderer((window, document) => {
    document.head = { append(script) {
      loads++;
      assert.match(script.src, /mathjax@3\.2\.2/);
      assert.equal(window.MathJax.tex.inlineMath[0][0], '\\(');
      window.MathJax.startup.promise = Promise.resolve();
      window.MathJax.typesetPromise = async nodes => {
        assert.equal(active++, 0);
        calls.push([...nodes]);
        await Promise.resolve();
        active--;
      };
      script.onload();
    } };
  });
  const first = { isConnected: true }, second = { isConnected: true }, stale = { isConnected: false };
  await Promise.all([
    posts.typeset({ querySelectorAll: () => [first] }),
    posts.typeset({ querySelectorAll: () => [second, stale] })
  ]);
  assert.equal(loads, 1);
  assert.deepEqual(calls, [[first], [second]]);
});
