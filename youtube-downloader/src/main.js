let invoke, listen;
try {
  invoke = window.__TAURI__.core.invoke;
  listen = window.__TAURI__.event.listen;
} catch {
  invoke = () => Promise.reject('Tauri non disponible');
  listen = () => Promise.resolve(() => {});
}

let searchInput, searchBtn, resultsEl, folderPath, folderBtn;
let themeBtn, queueToggle, queueOverlay, queueClose, queueList, queueCount, queueBadge;
let toast, toastMsg, toastIcon;
let netStatus, netLabel;
let previewModal, previewClose, previewTitle, previewPlayer;
let viewToggle, isListView = false;

const queue = new Map();
let activeDownloads = 0;
const MAX_CONCURRENT = 2;
let currentTheme = localStorage.getItem('ytdl-theme') || 'mocha';
let downloadDir = '';
let isOnline = false;
let progressUnlisten = null;

function $(sel) { return document.querySelector(sel); }

window.addEventListener('DOMContentLoaded', async () => {
  searchInput = $('#search-input');
  searchBtn = $('#search-btn');
  resultsEl = $('#results');
  folderPath = $('#folder-path');
  folderBtn = $('#folder-btn');
  themeBtn = $('#theme-btn');
  queueToggle = $('#queue-toggle');
  queueOverlay = $('#queue-overlay');
  queueClose = $('#queue-close');
  queueList = $('#queue-list');
  queueCount = $('#queue-count');
  queueBadge = $('#queue-badge');
  toast = $('#toast');
  toastMsg = $('#toast-msg');
  toastIcon = $('#toast-icon');
  netStatus = $('#net-status');
  netLabel = $('#net-label');
  previewModal = $('#preview-modal');
  previewClose = $('#preview-close');
  previewTitle = $('#preview-title');
  previewPlayer = $('#preview-player');
  const previewOpenBrowser = $('#preview-openbrowser');
  previewOpenBrowser.addEventListener('click', () => {
    const vid = previewPlayer.dataset?.vid;
    if (vid) invoke('open_in_browser', { url: `https://www.youtube.com/watch?v=${vid}` });
  });
  viewToggle = $('#view-toggle');

  if (currentTheme === 'nord') document.body.classList.add('theme-nord');

  try { downloadDir = localStorage.getItem('ytdl-dir') || await invoke('get_download_dir'); }
  catch { downloadDir = ''; }
  folderPath.textContent = downloadDir || '~/Downloads/YoutubeDownloader';

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
  viewToggle.addEventListener('click', toggleView);
  themeBtn.addEventListener('click', toggleTheme);
  queueToggle.addEventListener('click', () => openQueue());
  queueClose.addEventListener('click', closeQueue);
  queueOverlay.addEventListener('click', e => { if (e.target === queueOverlay) closeQueue(); });
  folderBtn.addEventListener('click', pickFolder);
  previewClose.addEventListener('click', closePreview);
  previewModal.addEventListener('click', e => { if (e.target === previewModal) closePreview(); });

  try { progressUnlisten = await listen('download-progress', onProgress); }
  catch {}
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeQueue(); closePreview(); }
    if (e.key === 'F5') { window.location.reload(); }
  });

  checkConnectivity();
  setInterval(checkConnectivity, 30000);
  showEmpty();
});

async function checkConnectivity() {
  try { isOnline = await invoke('check_network'); }
  catch { isOnline = false; }
  netStatus.className = 'net-status ' + (isOnline ? 'online' : 'offline');
  netLabel.textContent = isOnline ? 'Connecté' : 'Hors-ligne';
}

function toggleTheme() {
  currentTheme = currentTheme === 'mocha' ? 'nord' : 'mocha';
  document.body.classList.toggle('theme-nord', currentTheme === 'nord');
  localStorage.setItem('ytdl-theme', currentTheme);
}

function showToast(msg, type = 'success') {
  toastMsg.textContent = msg;
  toastIcon.className = 'fas ' + (type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark');
  toast.className = 'toast ' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

async function pickFolder() {
  try {
    const dir = await invoke('pick_folder');
    if (dir) { downloadDir = dir; folderPath.textContent = dir; localStorage.setItem('ytdl-dir', dir); }
  } catch {}
}

// ===== EXTRACT YOUTUBE ID =====
function extractYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function openPreview(url, title) {
  try {
    const vid = extractYoutubeId(url);
    if (!vid) {
      showToast('Impossible de lire cette vidéo', 'error');
      return;
    }
    previewTitle.textContent = title || 'Aperçu vidéo';
    previewPlayer.dataset.vid = vid;
    previewPlayer.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none"></iframe>`;
    previewModal.classList.remove('hidden');
  } catch { showToast('Erreur lors de l\'ouverture', 'error'); }
}

function closePreview() {
  previewModal.classList.add('hidden');
  previewPlayer.innerHTML = `
    <div class="player-placeholder">
      <i class="fas fa-film"></i>
      <p>Chargement du lecteur...</p>
    </div>`;
}

// ===== SEARCH =====
async function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  searchBtn.disabled = true;
  searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recherche...';
  resultsEl.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-spin"></i><p>Recherche en cours...</p></div>';

  try {
    if (q.startsWith('http://') || q.startsWith('https://')) {
      const info = await invoke('get_video_info', { url: q });
      if (info.duration && info.duration.includes('vidéos')) {
        const videos = await invoke('get_playlist', { url: q });
        resultsEl.innerHTML = '';
        const hdr = document.createElement('div');
        hdr.className = 'empty-state';
        hdr.style.cssText = 'text-align:left;padding:0 0 8px 0';
        hdr.innerHTML = `<p><i class="fas fa-list" style="display:inline;font-size:13px;margin-right:6px;color:var(--primary)"></i> ${escHtml(info.title)}</p>`;
        resultsEl.appendChild(hdr);
        renderCards(videos);
      } else {
        renderCards([info]);
      }
    } else {
      const results = await invoke('search_videos', { query: q });
      if (!results.length) {
        resultsEl.innerHTML = '<div class="empty-state"><i class="fas fa-video-slash"></i><p>Aucun résultat</p><p class="sub">Essaie une autre recherche</p></div>';
      } else {
        resultsEl.innerHTML = '';
        renderCards(results);
      }
    }
  } catch (err) {
    const msg = typeof err === 'string' ? err : 'Une erreur est survenue';
    resultsEl.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Erreur</p><p class="sub">${escHtml(msg)}</p></div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<i class="fas fa-magnifying-glass"></i> Rechercher';
  }
}

function renderCards(items) {
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card';
    const isLive = item.duration === 'Live';
    const badgeHtml = isLive
      ? `<span class="badge"><i class="fas fa-circle" style="color:#ff4444"></i> LIVE</span>`
      : `<span class="badge">${item.duration}</span>`;

    card.innerHTML = `
      <div class="thumb">
        <img src="${item.thumbnail}" alt="${item.title}" loading="lazy" onerror="this.remove()">
        <i class="fas fa-film fallback"></i>
        <div class="play-hover"><i class="fas fa-circle-play"></i></div>
        ${badgeHtml}
      </div>
      <div class="info">
        <div class="title">${escHtml(item.title)}</div>
        <div class="meta-row"><i class="fas fa-user"></i> ${escHtml(item.author)}</div>
        <div class="actions">
          <button class="dl-btn" data-url="${item.url}" data-title="${escHtml(item.title)}">
            <i class="fas fa-circle-down"></i> Télécharger
          </button>
          <button class="preview-btn" data-url="${item.url}" data-title="${escHtml(item.title)}" title="Aperçu">
            <i class="fas fa-play"></i>
          </button>
        </div>
      </div>`;

    card.querySelector('.play-hover').addEventListener('click', () => openPreview(item.url, item.title));
    card.querySelector('.preview-btn').addEventListener('click', () => openPreview(item.url, item.title));
    card.querySelector('.dl-btn').addEventListener('click', e => addToQueue(item.url, item.title, e.currentTarget));

    resultsEl.appendChild(card);
  }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showEmpty() {
  resultsEl.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-download"></i>
      <p>YouTube Downloader</p>
      <p class="sub">Recherchez une vidéo ou collez une URL pour commencer</p>
    </div>`;
}

function showOffline() {
  resultsEl.innerHTML = `
    <div class="offline-state">
      <i class="fas fa-wifi-slash"></i>
      <p>Aucune connexion internet</p>
      <p class="sub">Connectez-vous à internet pour rechercher et télécharger des vidéos</p>
    </div>`;
}

function toggleView() {
  isListView = !isListView;
  resultsEl.classList.toggle('list-view', isListView);
  viewToggle.classList.toggle('active', isListView);
  viewToggle.innerHTML = isListView ? '<i class="fas fa-th-large"></i>' : '<i class="fas fa-list"></i>';
  viewToggle.title = isListView ? 'Vue carte' : 'Vue liste';
}

// ===== QUEUE =====
function openQueue() { queueOverlay.classList.remove('hidden'); }
function closeQueue() { queueOverlay.classList.add('hidden'); }

function addToQueue(url, title, btn) {
  if (queue.has(url)) { showToast('Déjà dans la file', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-check"></i> Ajouté';

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const item = { id, url, title, status: 'waiting', percent: 0 };
  queue.set(url, item);
  updateQueueBadge();
  openQueue();
  updateQueueUI();
  processQueue();
}

function updateQueueBadge() {
  const total = queue.size;
  queueCount.textContent = total;
  queueBadge.classList.toggle('hidden', total === 0);
  queueBadge.textContent = total;
}

function updateQueueUI() {
  let html = '';
  for (const [, item] of queue) {
    const isPaused = item.status === 'paused';
    const isWaiting = item.status === 'waiting';
    const isDownloading = item.status === 'downloading' || item.status === 'starting';
    const isFinished = item.status === 'finished';
    const isError = item.status === 'error';

    let statusClass = '';
    if (isFinished) statusClass = 'finished';
    else if (isError) statusClass = 'error';
    else if (isPaused) statusClass = 'paused';

    let icon = 'fa-pause';
    let statusText = 'En pause';
    let actions = '';

    if (isDownloading) {
      icon = 'fa-spinner fa-spin';
      statusText = `${Math.round(item.percent)}% · en cours`;
      actions = `
        <button class="q-action-btn" data-action="pause" data-url="${item.url}" title="Mettre en pause"><i class="fas fa-pause"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="Annuler"><i class="fas fa-ban"></i></button>`;
    } else if (isWaiting) {
      icon = 'fa-hourglass-half';
      statusText = 'En attente';
      actions = `
        <button class="q-action-btn success" data-action="resume" data-url="${item.url}" title="Démarrer"><i class="fas fa-play"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="Annuler"><i class="fas fa-ban"></i></button>`;
    } else if (isPaused) {
      icon = 'fa-pause';
      statusText = 'En pause';
      actions = `
        <button class="q-action-btn success" data-action="resume" data-url="${item.url}" title="Démarrer"><i class="fas fa-play"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="Supprimer"><i class="fas fa-trash"></i></button>`;
    } else if (isFinished) {
      icon = 'fa-circle-check';
      statusText = 'Terminé';
      actions = `<button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="Supprimer"><i class="fas fa-trash"></i></button>`;
    } else if (isError) {
      icon = 'fa-circle-xmark';
      statusText = 'Erreur';
      actions = `
        <button class="q-action-btn success" data-action="resume" data-url="${item.url}" title="Réessayer"><i class="fas fa-rotate"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="Supprimer"><i class="fas fa-trash"></i></button>`;
    }

    html += `
      <div class="q-item ${statusClass}">
        <div class="q-title"><i class="fas ${icon}" style="color:${isDownloading ? 'var(--primary)' : isFinished ? 'var(--success)' : isError ? 'var(--error)' : 'var(--text-secondary)'}"></i>${escHtml(item.title || 'Vidéo')}</div>
        <div class="q-bar"><div class="q-fill" style="width:${item.percent}%"></div></div>
        <div class="q-footer">
          <span class="q-meta">${statusText}</span>
          <div class="q-qactions">${actions}</div>
        </div>
      </div>`;
  }

  if (!queue.size) {
    html = '<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:13px">File d\'attente vide</div>';
  }

  queueList.innerHTML = html;

  queueList.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const url = btn.dataset.url;
      if (action === 'cancel') removeFromQueue(url);
      else if (action === 'resume') resumeItem(url);
      else if (action === 'pause') pauseItem(url);
    });
  });
}

function removeFromQueue(url) {
  const item = queue.get(url);
  if (!item) return;
  if (item.status === 'downloading' || item.status === 'starting') {
    invoke('cancel_download', { id: item.id }).catch(() => {});
  }
  queue.delete(url);
  updateQueueBadge();
  updateQueueUI();
}

function resumeItem(url) {
  const item = queue.get(url);
  if (!item) return;
  if (item.status === 'finished') {
    queue.delete(url);
    updateQueueBadge();
    updateQueueUI();
    return;
  }
  item.status = 'waiting';
  item.percent = 0;
  updateQueueUI();
  processQueue();
}

function pauseItem(url) {
  const item = queue.get(url);
  if (!item) return;
  if (item.status === 'downloading' || item.status === 'starting') {
    invoke('pause_download', { id: item.id }).catch(() => {});
    activeDownloads--;
  }
  item.status = 'paused';
  updateQueueUI();
  processQueue();
}

function processQueue() {
  const waiting = [...queue.values()].filter(i => i.status === 'waiting');
  const slots = MAX_CONCURRENT - activeDownloads;

  for (let i = 0; i < Math.min(slots, waiting.length); i++) {
    startDownload(waiting[i]);
  }
  updateQueueUI();
}

async function startDownload(item) {
  activeDownloads++;
  item.status = 'starting';
  item.percent = 0;
  updateQueueUI();

  try {
    await invoke('download_video', { id: item.id, url: item.url, outputDir: downloadDir });
  } catch (err) {
    item.status = 'error';
    updateQueueUI();
    showToast(`Erreur: ${err}`, 'error');
  }

  activeDownloads--;
  processQueue();
}

function onProgress(event) {
  const data = event.payload;
  for (const [, item] of queue) {
    if (item.id === data.id) {
      item.status = data.status;
      if (data.percent > 0) item.percent = data.percent;

      if (data.status === 'finished') {
        showToast(`✅ ${item.title || 'Vidéo'} téléchargée`, 'success');
        setTimeout(() => {
          queue.delete(item.url);
          updateQueueBadge();
          updateQueueUI();
        }, 2000);
      } else if (data.status === 'error') {
        showToast(`❌ ${data.error || item.title}`, 'error');
      }
      updateQueueUI();
      break;
    }
  }
}
