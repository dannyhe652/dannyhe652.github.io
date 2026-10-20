// Static GitHub Pages site — no build step or external JavaScript dependencies.
const artworks = [...document.querySelectorAll('.artwork')];
const seriesButtons = [...document.querySelectorAll('[data-series]')].filter(element => element.tagName === 'BUTTON');
const counter = document.querySelector('#counter');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const descriptions = {
  chain: 'Chain · Three oil paintings · 2023',
  light: 'Light and Shadows · Suzhou gardens · 2024',
  order: 'Between Order and Chaos · Digital painting · 2025'
};
let activeSeries = 'chain';
let current = 0;

function showArtwork(index) {
  const collection = artworks.filter(artwork => artwork.dataset.series === activeSeries);
  current = ((index % collection.length) + collection.length) % collection.length;
  artworks.forEach(artwork => { artwork.hidden = artwork !== collection[current]; });
  counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(collection.length).padStart(2, '0')}`;
  previous.disabled = next.disabled = collection.length < 2;
  document.querySelector('#series-description').textContent = descriptions[activeSeries];
  // Make the selected image load immediately, then preload the following work.
  collection[current].querySelector('img').loading = 'eager';
  collection[(current + 1) % collection.length].querySelector('img').loading = 'eager';
}

function selectSeries(series) {
  activeSeries = series;
  seriesButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.series === series)));
  showArtwork(0);
}

const pages = [...document.querySelectorAll('main > section')];
const links = [...document.querySelectorAll('nav a')];

function showPage() {
  // A series URL such as #art/light can be bookmarked or shared.
  const [requested, series] = location.hash.slice(1).split('/');
  const page = pages.find(section => section.id === requested) || pages[0];
  if (page.id === 'art' && Object.hasOwn(descriptions, series)) selectSeries(series);
  pages.forEach(section => { section.hidden = section !== page; });
  links.forEach(link => {
    if (link.hash === `#${page.id}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const label = links.find(link => link.hash === `#${page.id}`).textContent;
  document.title = `Yiyang He — ${label}`;
}

previous.addEventListener('click', () => showArtwork(current - 1));
next.addEventListener('click', () => showArtwork(current + 1));
seriesButtons.forEach(button => button.addEventListener('click', () => {
  // Replace rather than append history for each collection selection.
  const hash = `#art/${button.dataset.series}`;
  try { history.replaceState(null, '', hash); }
  catch { location.hash = hash; } // Also works when opened directly as a local file.
  selectSeries(button.dataset.series);
}));
window.addEventListener('hashchange', showPage);
document.addEventListener('keydown', event => {
  if (document.querySelector('#art').hidden || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    showArtwork(current + (event.key === 'ArrowRight' ? 1 : -1));
  }
});

showArtwork(0);
showPage();
document.body.classList.add('js-gallery', 'js-page');
document.querySelector('.series-picker').hidden = false;
document.querySelector('.gallery-controls').hidden = false;
document.querySelector('#year').textContent = new Date().getFullYear();
