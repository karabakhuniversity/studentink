'use strict';

const heroSearch = document.getElementById('heroSearch');
const featuredGrid = document.getElementById('featuredGrid');
const statTotal = document.getElementById('statTotal');
const yearEl = document.getElementById('footerYear');
const supabaseDb = window.supabaseClient;

const CONTENT_TYPES = [
  { value: 'book', label: 'Book' },
  { value: 'journal', label: 'Journal' },
  { value: 'article', label: 'Article' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'essay', label: 'Essay' },
  { value: 'story', label: 'Story' },
  { value: 'student-spotlight', label: 'Student Spotlight' }
];

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function typeLabel(type) {
  return CONTENT_TYPES.find((t) => t.value === type)?.label || type;
}

function mapRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title || 'Untitled',
    author: row.author || 'Unknown',
    coverImage: row.cover_path || 'https://via.placeholder.com/400x560/1a3d2e/ffffff?text=No+Cover',
    fileUrl: row.file_path || '#',
    createdAt: row.created_at || ''
  };
}

function buildCard(item, delay = 0) {
  const hasPdf = item.fileUrl && item.fileUrl !== '#';

  const readBtn = hasPdf
    ? `<a href="${escHtml(item.fileUrl)}" target="_blank" rel="noopener" class="btn btn--primary btn--sm">Read</a>`
    : `<span class="btn btn--unavailable btn--sm">PDF Unavailable</span>`;

  return `
    <article class="card" style="animation-delay:${delay}ms">
      <div class="card__cover-wrap">
        <img class="card__cover js-enlarge-image"
             src="${escHtml(item.coverImage)}"
             alt="Cover: ${escHtml(item.title)}"
             loading="lazy"
             data-fullsrc="${escHtml(item.coverImage)}"
             data-title="${escHtml(item.title)}"
             onerror="this.src='https://via.placeholder.com/400x560/1a3d2e/ffffff?text=No+Cover'"/>
        <span class="card__badge card__badge--${escHtml(item.type)}">${escHtml(typeLabel(item.type))}</span>
      </div>
      <div class="card__body">
        <h3 class="card__title">${escHtml(item.title)}</h3>
        <p class="card__author">${escHtml(item.author)}</p>
        <div class="card__divider" aria-hidden="true"></div>
        <div class="card__actions">${readBtn}</div>
      </div>
    </article>
  `;
}

async function loadHomepageContent() {
  if (!supabaseDb) {
    throw new Error('Supabase is not connected.');
  }

  const { data, error } = await supabaseDb
    .from('content_items')
    .select('*')
    .in('type', CONTENT_TYPES.map((item) => item.value))
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const items = (data || []).map(mapRow);
  const latestItems = items.slice(0, 4);

  return {
    total: items.length,
    featured: latestItems
  };
}

function renderFeatured(items) {
  if (!featuredGrid) return;

  featuredGrid.innerHTML = items.length
    ? items.map((item, index) => buildCard(item, index * 60)).join('')
    : `<div class="empty"><div class="empty__icon">📚</div><p class="empty__title">No content yet.</p></div>`;
}

function initHeroSearch() {
  if (!heroSearch) return;

  heroSearch.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    const q = heroSearch.value.trim();
    if (q) {
      window.location.href = `content.html?q=${encodeURIComponent(q)}`;
      return;
    }

    document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' });
  });
}

function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function ensureImageLightbox() {
  if (document.getElementById('imageLightbox')) return;

  const style = document.createElement('style');
  style.textContent = `
    .js-enlarge-image { cursor: zoom-in; }
    .image-lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.82);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 9999;
    }
    .image-lightbox.open { display: flex; }
    .image-lightbox__dialog {
      position: relative;
      max-width: min(92vw, 980px);
      max-height: 92vh;
      width: fit-content;
    }
    .image-lightbox__img {
      display: block;
      max-width: 100%;
      max-height: calc(92vh - 56px);
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
    }
    .image-lightbox__caption {
      margin-top: 12px;
      text-align: center;
      color: #fff;
      font: 500 14px/1.4 'DM Sans', sans-serif;
    }
    .image-lightbox__close {
      position: absolute;
      top: -14px;
      right: -14px;
      width: 38px;
      height: 38px;
      border: 0;
      border-radius: 999px;
      background: #fff;
      color: #111;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  const lightbox = document.createElement('div');
  lightbox.id = 'imageLightbox';
  lightbox.className = 'image-lightbox';
  lightbox.innerHTML = `
    <div class="image-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" class="image-lightbox__close" aria-label="Close preview">×</button>
      <img class="image-lightbox__img" alt="Expanded cover image"/>
      <p class="image-lightbox__caption"></p>
    </div>
  `;
  document.body.appendChild(lightbox);

  const closeBtn = lightbox.querySelector('.image-lightbox__close');
  const img = lightbox.querySelector('.image-lightbox__img');
  const caption = lightbox.querySelector('.image-lightbox__caption');

  function closeLightbox() {
    lightbox.classList.remove('open');
    img.src = '';
    caption.textContent = '';
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('.js-enlarge-image');
    if (!trigger) return;
    img.src = trigger.dataset.fullsrc || trigger.getAttribute('src') || '';
    caption.textContent = trigger.dataset.title || trigger.getAttribute('alt') || '';
    lightbox.classList.add('open');
  });

  closeBtn?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('open')) closeLightbox();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initHeroSearch();
  initMobileNav();
  ensureImageLightbox();

  try {
    const { total, featured } = await loadHomepageContent();

    if (statTotal) statTotal.textContent = total;
    renderFeatured(featured);
  } catch (error) {
    if (featuredGrid) {
      featuredGrid.innerHTML = `<div class="empty"><div class="empty__icon">⚠️</div><p class="empty__title">Failed to load content.</p></div>`;
    }
    console.error(error);
  }
});