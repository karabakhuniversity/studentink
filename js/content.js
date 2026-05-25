'use strict';

const supabaseDb = window.supabaseClient;

const params = new URLSearchParams(window.location.search);
const URL_TYPE = params.get('type') || 'all';
const URL_QUERY = params.get('q') || '';

let activeType = URL_TYPE;
let searchQuery = URL_QUERY;
let allContent = [];

const grid = document.getElementById('contentGrid');
const emptyEl = document.getElementById('emptyState');
const pageTitle = document.getElementById('pageTitle');
const pageSub = document.getElementById('pageSub');
const searchInput = document.getElementById('contentSearch');
const resultHint = document.getElementById('resultHint');
const breadcrumb = document.getElementById('breadcrumbType');
const yearEl = document.getElementById('footerYear');

const CONTENT_TYPES = [
  { value: 'book', label: 'Books' },
  { value: 'journal', label: 'Journals' },
  { value: 'article', label: 'Articles' },
  { value: 'magazine', label: 'Magazines' },
  { value: 'essay', label: 'Essays' },
  { value: 'story', label: 'Stories' },
  { value: 'student-spotlight', label: 'Student Spotlight' }
];

const TYPE_META = {
  all: { label: 'All Content', desc: 'Browse the complete digital library' },
  book: { label: 'Books', desc: 'Academic textbooks and reference works' },
  journal: { label: 'Journals', desc: 'Academic journals and scholarly publications' },
  article: { label: 'Articles', desc: 'Research articles and written features' },
  magazine: { label: 'Magazines', desc: 'University and student magazine issues' },
  essay: { label: 'Essays', desc: 'Student and faculty essays' },
  story: { label: 'Stories', desc: 'Creative fiction and short stories' },
  'student-spotlight': { label: 'Student Spotlight', desc: 'Featured student profiles and achievements' }
};

function getMeta(type) {
  return TYPE_META[type] || TYPE_META.all;
}

function esc(s) {
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
    category: row.category || 'General',
    description: row.description || '',
    coverImage: row.cover_path || 'https://via.placeholder.com/400x560/1a3d2e/ffffff?text=No+Cover',
    fileUrl: row.file_path || '#',
    createdAt: row.created_at || '',
    studentName: row.student_name || '',
    department: row.department || '',
    achievement: row.achievement || ''
  };
}

function getFilteredContent() {
  const q = searchQuery.trim().toLowerCase();
  return allContent.filter((item) => {
    const matchesAllowedType = CONTENT_TYPES.some((type) => type.value === item.type);
    const matchesType = activeType === 'all' || item.type === activeType;
    const matchesQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.studentName && item.studentName.toLowerCase().includes(q)) ||
      (item.department && item.department.toLowerCase().includes(q));
    return matchesAllowedType && matchesType && matchesQuery;
  });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function loadApprovedComments(contentId) {
  if (!supabaseDb) return [];
  const { data, error } = await supabaseDb
    .from('comments')
    .select('id, author_name, body, created_at')
    .eq('content_id', contentId)
    .eq('approved', true)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

async function submitComment(contentId, authorName, body) {
  if (!supabaseDb) throw new Error('Supabase not connected.');
  const { error } = await supabaseDb
    .from('comments')
    .insert([{ content_id: contentId, author_name: authorName, body, approved: false }]);
  if (error) throw error;
}

function renderCommentList(contentId, comments) {
  const list = document.getElementById(`clist-${contentId}`);
  const countEl = document.getElementById(`ccount-${contentId}`);
  if (!list) return;

  if (countEl) countEl.textContent = comments.length > 0 ? `(${comments.length})` : '';

  if (comments.length === 0) {
    list.innerHTML = `<p class="comments-empty">There are no comments yet. Be the first to comment!</p>`;
    return;
  }

  list.innerHTML = comments.map((c) => `
    <div class="comment-item">
      <div class="comment-item__header">
        <span class="comment-item__author">${esc(c.author_name)}</span>
        <span class="comment-item__date">${formatDate(c.created_at)}</span>
      </div>
      <p class="comment-item__body">${esc(c.body)}</p>
    </div>
  `).join('');
}

function buildCommentSection(itemId) {
  return `
    <div class="comments-section">
      <button class="comments-toggle" data-id="${esc(itemId)}" aria-expanded="false">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M1 2.5h11M1 6.5h7M1 10.5h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Comments
        <span class="comments-toggle__count" id="ccount-${esc(itemId)}"></span>
      </button>

      <div class="comments-body" id="cbody-${esc(itemId)}" hidden>
        <div class="comments-list" id="clist-${esc(itemId)}">
          <p class="comments-loading">Loading...</p>
        </div>

        <form class="comment-form" id="cform-${esc(itemId)}" novalidate>
          <p class="comment-form__title">Write a comment</p>
          <input
            type="text"
            class="comment-form__input"
            placeholder="Name..."
            maxlength="80"
            required
            aria-label="Ad"
          />
          <textarea
            class="comment-form__textarea"
            placeholder="Your comment..."
            rows="3"
            maxlength="1000"
            required
            aria-label="Comment"
          ></textarea>
          <div class="comment-form__footer">
            <span class="comment-form__note">It will appear after admin approval.</span>
            <button type="submit" class="btn btn--primary btn--sm">Submit</button>
          </div>
          <p class="comment-form__success" hidden>Your comment has been submitted, awaiting approval.</p>
        </form>
      </div>
    </div>
  `;
}

function initCommentSection(itemId) {
  const toggleBtn = document.querySelector(`.comments-toggle[data-id="${itemId}"]`);
  const body = document.getElementById(`cbody-${itemId}`);
  const form = document.getElementById(`cform-${itemId}`);
  if (!toggleBtn || !body || !form) return;

  let loaded = false;

  toggleBtn.addEventListener('click', async () => {
    const opening = body.hidden;
    body.hidden = !opening;
    toggleBtn.setAttribute('aria-expanded', String(opening));

    if (opening && !loaded) {
      loaded = true;
      const comments = await loadApprovedComments(itemId);
      renderCommentList(itemId, comments);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = form.querySelector('input');
    const textInput = form.querySelector('textarea');
    const successMsg = form.querySelector('.comment-form__success');
    const submitBtn = form.querySelector('button[type="submit"]');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    if (!text) { textInput.focus(); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      await submitComment(itemId, name, text);
      nameInput.value = '';
      textInput.value = '';
      if (successMsg) successMsg.hidden = false;
      setTimeout(() => { if (successMsg) successMsg.hidden = true; }, 4000);
    } catch (err) {
      alert('An error occurred. Please try again.');
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  });
}

function buildCard(item, delay) {
  if (item.type === 'student-spotlight') return buildSpotlightCard(item, delay);

  const hasPdf = item.fileUrl && item.fileUrl !== '#';
  const readBtn = hasPdf
    ? `<a href="${esc(item.fileUrl)}" target="_blank" rel="noopener" class="btn btn--primary btn--sm">Read</a>`
    : `<span class="btn btn--unavailable btn--sm">PDF Unavailable</span>`;

  return `
    <article class="card" style="animation-delay:${delay}ms" data-id="${esc(item.id)}">
      <div class="card__cover-wrap">
        <img class="card__cover js-enlarge-image"
             src="${esc(item.coverImage)}"
             alt="Cover: ${esc(item.title)}"
             loading="lazy"
             data-fullsrc="${esc(item.coverImage)}"
             data-title="${esc(item.title)}"
             onerror="this.src='https://via.placeholder.com/400x560/1a3d2e/ffffff?text=No+Cover'"/>
        <span class="card__badge card__badge--${esc(item.type)}">${esc(typeLabel(item.type))}</span>
      </div>
      <div class="card__body">
        <h3 class="card__title">${esc(item.title)}</h3>
        <p class="card__author">${esc(item.author)}</p>
        <div class="card__divider" aria-hidden="true"></div>
        <div class="card__actions">${readBtn}</div>
      </div>
      ${buildCommentSection(item.id)}
    </article>
  `;
}

function buildSpotlightCard(item, delay) {
  const hasPdf = item.fileUrl && item.fileUrl !== '#';
  const readBtn = hasPdf
    ? `<a href="${esc(item.fileUrl)}" target="_blank" rel="noopener" class="btn btn--primary btn--sm">Read More</a>`
    : '';

  const department = item.department
    ? `<p class="card__meta-line"><span class="card__meta-icon">🎓</span>${esc(item.department)}</p>`
    : '';

  const achievement = item.achievement
    ? `<p class="card__meta-line"><span class="card__meta-icon">🏆</span>${esc(item.achievement)}</p>`
    : '';

  return `
    <article class="card card--spotlight" style="animation-delay:${delay}ms" data-id="${esc(item.id)}">
      <div class="card__cover-wrap">
        <img class="card__cover card__cover--portrait js-enlarge-image"
             src="${esc(item.coverImage)}"
             alt="Photo of ${esc(item.title)}"
             loading="lazy"
             data-fullsrc="${esc(item.coverImage)}"
             data-title="${esc(item.title)}"
             onerror="this.src='https://via.placeholder.com/400x400/1a3d2e/ffffff?text=Student'"/>
        <span class="card__badge card__badge--student-spotlight">Student Spotlight</span>
      </div>
      <div class="card__body">
        <h3 class="card__title">${esc(item.title)}</h3>
        <p class="card__author">${esc(item.author)}</p>
        ${department}
        ${achievement}
        <div class="card__divider" aria-hidden="true"></div>
        <div class="card__actions">${readBtn}</div>
      </div>
      ${buildCommentSection(item.id)}
    </article>
  `;
}

async function loadContent() {
  if (!supabaseDb) throw new Error('Supabase is not connected.');
  const { data, error } = await supabaseDb
    .from('content_items')
    .select('*')
    .in('type', CONTENT_TYPES.map((type) => type.value))
    .order('created_at', { ascending: false });
  if (error) throw error;
  allContent = (data || []).map(mapRow);
}

function render() {
  const results = getFilteredContent();
  const meta = getMeta(activeType);

  if (pageTitle) pageTitle.textContent = meta.label;
  if (pageSub) pageSub.textContent = meta.desc;
  if (breadcrumb) breadcrumb.textContent = meta.label;

  if (resultHint) {
    const q = searchQuery.trim();
    resultHint.textContent = q
      ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${q}"`
      : `${results.length} item${results.length !== 1 ? 's' : ''}`;
  }

  if (!grid) return;

  if (results.length > 0) {
    grid.innerHTML = results.map((item, i) => buildCard(item, Math.min(i * 55, 440))).join('');
    if (emptyEl) { emptyEl.hidden = true; emptyEl.style.display = 'none'; }
    results.forEach((item) => initCommentSection(item.id));
    return;
  }

  grid.innerHTML = '';
  if (emptyEl) { emptyEl.hidden = false; emptyEl.style.display = 'flex'; }
}

function initSearch() {
  if (!searchInput) return;
  searchInput.value = searchQuery;
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    const url = new URL(window.location);
    searchQuery ? url.searchParams.set('q', searchQuery) : url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
    render();
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

function markActiveNav() {
  document.querySelectorAll('.header__nav-link[data-type]').forEach((link) => {
    link.classList.toggle('active', link.dataset.type === activeType);
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
  if (emptyEl) { emptyEl.hidden = true; emptyEl.style.display = 'none'; }

  initSearch();
  initMobileNav();
  ensureImageLightbox();

  try {
    await loadContent();
    markActiveNav();
    render();
  } catch (error) {
    if (grid) grid.innerHTML = '';
    if (emptyEl) { emptyEl.hidden = false; emptyEl.style.display = 'flex'; }
    if (resultHint) resultHint.textContent = 'Failed to load content.';
    console.error(error);
  }
});