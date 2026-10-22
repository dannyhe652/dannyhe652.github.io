const form = document.querySelector('#editor');
const status = document.querySelector('#status');
let token, currentId = null, images = [], dirty = false, busy = false;
const fields = ['category', 'title', 'summary', 'body', 'mediaUrl'];
const names = { art: 'Art', music: 'Music', yoyo: 'Yoyo & Card Magic', math: 'Math' };
function message(text, error = false) { status.textContent = text; status.classList.toggle('error', error); }
function changed() { dirty = true; document.querySelector('#save-state').textContent = 'Unsaved changes'; }
function value() { return Object.fromEntries(fields.map(key => [key, form.elements[key].value])) ; }
async function api(path, data) {
  const response = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': token }, body: JSON.stringify(data) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Request failed'); return result;
}
async function task(fn) {
  if (busy) return;
  busy = true; document.querySelectorAll('button, input, textarea, select').forEach(node => node.disabled = true);
  try { await fn(); } catch (error) { message(error.message, true); }
  finally { busy = false; document.querySelectorAll('button, input, textarea, select').forEach(node => node.disabled = false); }
}
function photoList() {
  const list = document.querySelector('#images'); list.replaceChildren();
  images.forEach((image, index) => {
    const row = document.createElement('div'); row.className = 'photo-row';
    const img = document.createElement('img'); img.src = '/' + image.src; img.alt = image.alt;
    const label = document.createElement('label'); label.textContent = 'Photo description';
    const input = document.createElement('input'); input.value = image.alt; input.required = true; input.placeholder = 'Describe the artwork or scene…';
    input.addEventListener('input', () => { image.alt = input.value; changed(); }); label.append(input);
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
    remove.onclick = () => { images.splice(index, 1); photoList(); changed(); }; row.append(img, label, remove); list.append(row);
  });
}
function preview(show) {
  document.querySelector('#preview').hidden = !show; form.hidden = show;
  document.querySelector('#write').setAttribute('aria-pressed', String(!show)); document.querySelector('#preview-button').setAttribute('aria-pressed', String(show));
  if (show) {
    const node = document.querySelector('#preview'); node.replaceChildren(Posts.render({ ...value(), id: currentId || 'preview', date: new Date().toISOString(), images })); Posts.typeset(node);
  }
}
function load(post) {
  if (busy || (dirty && !confirm('Leave this post without saving your latest changes?'))) return;
  currentId = post?.id || null; images = structuredClone(post?.images || []);
  fields.forEach(key => form.elements[key].value = post?.[key] || (key === 'category' ? 'art' : ''));
  photoList(); dirty = false; preview(false); category();
  document.querySelector('#save-state').textContent = post ? 'Saved version loaded' : 'New draft · Not saved';
  message('Drafts stay on this computer. Publish sends your post and photos to your public GitHub repository.');
}
function category() {
  const category = form.elements.category.value; document.querySelector('#category-label').textContent = names[category];
  document.querySelector('#media-help').textContent = { art: 'Add artwork or photographs. Your original proportions are preserved.', music: 'Write about your music and add a recording link below.', yoyo: 'Share a trick or performance with a YouTube or Vimeo link.', math: 'Write your exploration with TeX notation and supporting images.' }[category];
}
async function library() {
  const response = await fetch('/api/session'); if (!response.ok) throw new Error('Cannot connect to the local studio.');
  const session = await response.json(); token = session.token;
  for (const [id, entries] of [['drafts', session.drafts], ['published', session.posts]]) {
    const list = document.getElementById(id); list.replaceChildren();
    if (!entries.length) { const p = document.createElement('p'); p.textContent = id === 'drafts' ? 'No saved drafts yet.' : 'Nothing published yet.'; list.append(p); }
    [...entries].reverse().forEach(post => { const button = document.createElement('button'); button.textContent = post.title; button.onclick = () => load(post); list.append(button); });
  }
}
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', changed); form.elements.category.addEventListener('change', category);
document.querySelector('#new').onclick = () => load(null);
document.querySelector('#write').onclick = () => preview(false);
document.querySelector('#preview-button').onclick = () => preview(true);
document.querySelector('#save').onclick = () => task(async () => {
  const result = await api('save', { ...value(), id: currentId, images }); currentId = result.post.id; dirty = false;
  document.querySelector('#save-state').textContent = 'Saved on this computer'; message(result.message); await library();
});
document.querySelector('#publish').onclick = () => {
  if (!confirm('Publish this post and its photos to your public website? This commits and pushes to GitHub.')) return;
  task(async () => {
    message('Saving and publishing… Keep this window open.');
    const result = await api('publish', { ...value(), id: currentId, images }); currentId = result.post.id; dirty = false;
    document.querySelector('#save-state').textContent = result.pending ? 'Committed · Push pending' : 'Published';
    document.querySelector('#retry').hidden = !result.pending; message(result.message); await library();
  });
};
document.querySelector('#retry').onclick = () => task(async () => { const result = await api('push', {}); message(result.message); document.querySelector('#retry').hidden = true; });
document.querySelector('#delete').onclick = () => {
  if (!confirm('Discard this local draft? Any published version will stay on the website.')) return;
  task(async () => { if (currentId) await api('delete', { id: currentId }); dirty = false; currentId = null; images = []; form.reset(); photoList(); category(); preview(false); message('Local draft discarded.'); document.querySelector('#save-state').textContent = 'New draft · Not saved'; await library(); });
};
document.querySelector('#photos').addEventListener('change', event => {
  const files = [...event.target.files];
  task(async () => {
    if (images.length + files.length > 30) throw new Error('Use at most 30 photos per post.');
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds 10 MB.`);
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const result = await api('upload', { data }); images.push({ src: result.src, alt: '' }); changed(); photoList();
    }
    message('Photos added. Add a description for each, then save your draft.');
  }); event.target.value = '';
});
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
library().catch(error => message('Start this app with python3 studio/server.py. ' + error.message, true));
