const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the real Studio handlers without requiring browser dependencies.
function studio() {
  function node() {
    return {
      value: '', children: [], listeners: {}, classList: { toggle() {} }, pause() {},
      addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute(name, value) { this[name] = value; },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; }
    };
  }
  const nodes = Object.fromEntries(['editor', 'status', 'save-state', 'images', 'video-attachment',
    'preview', 'write', 'preview-button', 'media-help', 'category-label', 'drafts', 'published',
    'new', 'save', 'publish', 'retry', 'delete', 'photos', 'video'].map(id => [id, node()]));
  const fields = ['category', 'title', 'summary', 'body', 'mediaUrl'];
  nodes.editor.elements = Object.fromEntries(fields.map(key => [key, node()]));
  nodes.editor.reset = () => fields.forEach(key => nodes.editor.elements[key].value = '');
  const requests = [], rendered = [];
  let failure = false;
  const context = vm.createContext({
    document: {
      querySelector: selector => nodes[selector.slice(1)],
      querySelectorAll: () => Object.values(nodes),
      getElementById: id => nodes[id], createElement: node
    },
    window: { addEventListener() {} }, structuredClone, confirm: () => true,
    Posts: { render(post) { rendered.push(post); return node(); }, typeset() {} },
    async fetch(path, options) {
      if (path === '/api/session') return { ok: true, json: async () => ({ token: 'session-token', drafts: [], posts: [] }) };
      requests.push({ path, options });
      if (path === '/api/upload-video') return { ok: !failure, json: async () => failure ? { error: 'Invalid MP4' } : { src: `uploads/${'a'.repeat(32)}.mp4` } };
      const post = JSON.parse(options.body);
      return { ok: true, json: async () => ({ post: { ...post, id: 'saved' }, message: 'Saved' }) };
    }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../studio/studio.js'), 'utf8'), context);
  return { nodes, requests, rendered, load(post) { context.loadedPost = post; vm.runInContext('load(loadedPost)', context); }, failUpload() { failure = true; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
async function upload(app, file = { name: 'clip.mp4', size: 1024 }) {
  app.nodes.video.listeners.change({ target: { files: [file], value: 'clip.mp4' } });
  await settle();
}

test('Studio uploads a binary MP4, previews, saves, reloads and removes it', async () => {
  const app = studio(); await settle();
  app.nodes.editor.elements.title.value = 'Performance';
  await upload(app);
  const request = app.requests[0];
  assert.equal(request.path, '/api/upload-video');
  assert.equal(request.options.body.name, 'clip.mp4');
  assert.equal(request.options.headers['X-Studio-Token'], 'session-token');
  assert.equal(app.nodes['video-attachment'].children[0].controls, true);
  assert.match(app.nodes['save-state'].textContent, /Unsaved/);
  app.nodes['preview-button'].onclick();
  assert.equal(app.rendered[0].videoSrc, `uploads/${'a'.repeat(32)}.mp4`);
  await app.nodes.save.onclick();
  const saved = JSON.parse(app.requests.at(-1).options.body);
  assert.equal(saved.videoSrc, app.rendered[0].videoSrc);
  app.nodes.new.onclick();
  assert.equal(app.nodes['video-attachment'].children.length, 0);
  app.load(saved);
  assert.equal(app.nodes['video-attachment'].children[0].src, '/' + saved.videoSrc);
  app.nodes['video-attachment'].children[1].onclick();
  assert.equal(app.nodes['video-attachment'].children.length, 0);
  await app.nodes.save.onclick();
  assert.equal(JSON.parse(app.requests.at(-1).options.body).videoSrc, '');
});

test('Studio retains the previous attachment on upload failure and publishes it', async () => {
  const app = studio(); await settle(); await upload(app);
  app.failUpload(); await upload(app);
  assert.equal(app.nodes.status.textContent, 'Invalid MP4');
  assert.equal(app.nodes['video-attachment'].children.length, 2);
  app.nodes.publish.onclick(); await settle();
  assert.equal(app.requests.at(-1).path, '/api/publish');
  assert.match(JSON.parse(app.requests.at(-1).options.body).videoSrc, /\.mp4$/);
  app.nodes.new.onclick();
  assert.equal(app.nodes['video-attachment'].children.length, 0);
});

test('Studio rejects invalid, empty and oversized files before uploading', async () => {
  const app = studio(); await settle();
  for (const file of [{ name: 'clip.mov', size: 100 }, { name: 'clip.mp4', size: 0 },
    { name: 'clip.mp4', size: 50 * 1024 * 1024 + 1 }]) {
    await upload(app, file);
    assert.equal(app.requests.length, 0);
  }
  await upload(app, { name: 'clip.MP4', size: 50 * 1024 * 1024 });
  assert.equal(app.requests.length, 1);
});
