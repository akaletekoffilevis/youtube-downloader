let invoke, listen;
try {
  invoke = window.__TAURI__.core.invoke;
  listen = window.__TAURI__.event.listen;
} catch {
  invoke = () => Promise.reject('Tauri non disponible');
  listen = () => Promise.resolve(() => {});
}

let searchInput, searchBtn, resultsEl, folderPath, folderBtn;
let queueToggle, queueOverlay, queueClose, queueList, queueCount, queueBadge;
let toast, toastMsg, toastIcon;
let netStatus, netLabel;
let previewModal, previewClose, previewTitle, previewPlayer;
let viewToggle, isListView = false;
let formatSelect, sortSelect, sortWrap;
let paginationEl;
let globalProgressBar, globalProgressFill, globalProgressText;

const queue = new Map();
let activeDownloads = 0;
let maxConcurrent = parseInt(localStorage.getItem('ytdl-max-dl') || '2', 10);
let currentTheme = localStorage.getItem('ytdl-theme') || 'light';
let downloadDir = '';
let isOnline = false;
let progressUnlisten = null;
let speedLimit = localStorage.getItem('ytdl-speed-limit') || '0';
let autoUpdateYtdlp = localStorage.getItem('ytdl-auto-update-ytdlp') !== 'false';
let selectMode = false;
let selectedVideos = new Map();

let allResults = [];
let allResultsOriginal = [];
let currentResults = [];
let currentPage = 1;
const PER_PAGE = 32;
let currentPlaylistUrl = null;
let currentSort = 'relevance';
let currentQuery = '';

// ===== HISTORY =====
function getHistory() {
  try { return JSON.parse(localStorage.getItem('ytdl-history') || '[]'); } catch { return []; }
}
function saveHistory(item) {
  const h = getHistory();
  h.unshift({ title: item.title, url: item.url, author: item.author, date: new Date().toISOString(), filesize: item.filesize || '' });
  if (h.length > 100) h.length = 100;
  localStorage.setItem('ytdl-history', JSON.stringify(h));
}
function clearHistory() {
  localStorage.removeItem('ytdl-history');
  renderHistory();
}
function removeFromHistory(url) {
  const h = getHistory().filter(i => i.url !== url);
  localStorage.setItem('ytdl-history', JSON.stringify(h));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const h = getHistory();
  const searchVal = document.getElementById('history-search') ? document.getElementById('history-search').value.trim().toLowerCase() : '';
  const filtered = searchVal ? h.filter(item => (item.title || '').toLowerCase().includes(searchVal) || (item.author || '').toLowerCase().includes(searchVal)) : h;
  if (!filtered.length) {
    list.innerHTML = `<div class="history-empty"><i class="fas fa-clock-rotate-left"></i><p>${searchVal ? t('no_results') : t('history_empty')}</p><p class="sub">${searchVal ? t('no_results_sub') : t('history_empty_sub')}</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(item => {
    const d = new Date(item.date);
    const dateStr = d.toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    const sizeHtml = item.filesize ? ` <span class="history-size">· ${escHtml(item.filesize)}</span>` : '';
    return `<div class="history-item">
      <div class="history-icon"><i class="fas fa-circle-play"></i></div>
      <div class="history-info">
        <div class="history-title">${escHtml(item.title || 'Video')}</div>
        <div class="history-meta">${escHtml(item.author || '')} · ${dateStr}${sizeHtml}</div>
      </div>
      <button class="history-delete" data-url="${item.url}" title="${t('remove')}"><i class="fas fa-xmark"></i></button>
    </div>`;
  }).join('');

  list.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', () => removeFromHistory(btn.dataset.url));
  });
}

function toggleHistory() {
  const panel = document.getElementById('history-panel');
  if (!panel) return;
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) {
    panel.classList.add('hidden');
  } else {
    renderHistory();
    panel.classList.remove('hidden');
  }
}

// ===== SETTINGS =====
function getSettings() {
  return {
    theme: localStorage.getItem('ytdl-theme') || 'light',
    lang: localStorage.getItem('ytdl-lang') || 'fr',
    maxConcurrent: parseInt(localStorage.getItem('ytdl-max-dl') || '2', 10),
    folder: localStorage.getItem('ytdl-dir') || ''
  };
}

function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  const s = getSettings();
  document.getElementById('settings-theme').value = s.theme;
  document.getElementById('settings-lang').value = s.lang;
  document.getElementById('settings-concurrency').value = s.maxConcurrent;
  document.getElementById('settings-folder-display').textContent = s.folder || downloadDir || '~/Downloads/YoutubeDownloader';
  const speedLimitEl = document.getElementById('settings-speed-limit');
  if (speedLimitEl) speedLimitEl.value = localStorage.getItem('ytdl-speed-limit') || '0';
  const autoUpdateEl = document.getElementById('settings-auto-update');
  if (autoUpdateEl) autoUpdateEl.checked = localStorage.getItem('ytdl-auto-update-ytdlp') !== 'false';
  const defaultFormatEl = document.getElementById('settings-default-format');
  if (defaultFormatEl) defaultFormatEl.value = localStorage.getItem('ytdl-default-format') || 'best';
  modal.classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
  const theme = document.getElementById('settings-theme').value;
  const lang = document.getElementById('settings-lang').value;
  const concurrency = parseInt(document.getElementById('settings-concurrency').value, 10);
  const speedLimitVal = document.getElementById('settings-speed-limit') ? document.getElementById('settings-speed-limit').value : '0';
  const autoUpdateVal = document.getElementById('settings-auto-update') ? document.getElementById('settings-auto-update').checked : true;
  const defaultFormatVal = document.getElementById('settings-default-format') ? document.getElementById('settings-default-format').value : 'best';

  currentTheme = theme;
  document.body.classList.toggle('theme-dark', theme === 'dark');
  localStorage.setItem('ytdl-theme', theme);

  currentLang = lang;
  setLang(lang);
  applyLang();

  maxConcurrent = concurrency;
  localStorage.setItem('ytdl-max-dl', concurrency);

  speedLimit = speedLimitVal;
  localStorage.setItem('ytdl-speed-limit', speedLimitVal);

  autoUpdateYtdlp = autoUpdateVal;
  localStorage.setItem('ytdl-auto-update-ytdlp', autoUpdateVal);

  localStorage.setItem('ytdl-default-format', defaultFormatVal);
  if (formatSelect) formatSelect.value = defaultFormatVal;

  closeSettings();
  showToast(currentLang === 'fr' ? 'Paramètres sauvegardés' : 'Settings saved', 'success');
}

function $(sel) { return document.querySelector(sel); }

window.addEventListener('DOMContentLoaded', async () => {
  searchInput = $('#search-input');
  searchBtn = $('#search-btn');
  resultsEl = $('#results');
  folderPath = $('#folder-path');
  folderBtn = $('#folder-btn');
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
  formatSelect = $('#format-select');
  sortSelect = $('#sort-select');
  sortWrap = $('#sort-wrap');
  paginationEl = $('#pagination');

  if (currentTheme === 'dark') document.body.classList.add('theme-dark');

  setLang(currentLang);
  applyLang();

  if (formatSelect) {
    const savedFormat = localStorage.getItem('ytdl-default-format') || 'best';
    formatSelect.value = savedFormat;
  }

  try {
    const savedDir = localStorage.getItem('ytdl-dir');
    if (savedDir) {
      const exists = await invoke('check_dir_exists', { path: savedDir });
      downloadDir = exists ? savedDir : await invoke('get_download_dir');
    } else {
      downloadDir = await invoke('get_download_dir');
    }
  } catch { downloadDir = ''; }
  folderPath.textContent = downloadDir || '~/Downloads/YoutubeDownloader';

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
  viewToggle.addEventListener('click', toggleView);
  queueToggle.addEventListener('click', () => openQueue());
  queueClose.addEventListener('click', closeQueue);
  queueOverlay.addEventListener('click', e => { if (e.target === queueOverlay) closeQueue(); });
  folderBtn.addEventListener('click', pickFolder);
  previewClose.addEventListener('click', closePreview);
  previewModal.addEventListener('click', e => { if (e.target === previewModal && !isInteracting) closePreview(); });

  // Contact
  const contactBtn = $('#contact-btn');
  const contactModal = $('#contact-modal');
  const contactClose = $('#contact-close');
  const contactCancel = $('#contact-cancel');
  const contactSend = $('#contact-send');
  contactBtn.addEventListener('click', openContact);
  contactClose.addEventListener('click', closeContact);
  contactCancel.addEventListener('click', closeContact);
  contactSend.addEventListener('click', sendContact);
  contactModal.addEventListener('click', e => { if (e.target === contactModal) closeContact(); });

  // History
  const historyBtn = $('#history-btn');
  const historyClose = $('#history-close');
  const historyClear = $('#history-clear');
  const historyPanel = $('#history-panel');
  historyBtn.addEventListener('click', toggleHistory);
  historyClose.addEventListener('click', () => document.getElementById('history-panel').classList.add('hidden'));
  historyClear.addEventListener('click', clearHistory);
  historyPanel.addEventListener('click', e => { if (e.target === historyPanel) historyPanel.classList.add('hidden'); });

  // Settings
  const settingsBtn = $('#settings-btn');
  const settingsModal = $('#settings-modal');
  const settingsClose = $('#settings-close');
  const settingsSave = $('#settings-save');
  const settingsCancel = $('#settings-cancel');
  if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
  if (settingsClose) settingsClose.addEventListener('click', closeSettings);
  if (settingsCancel) settingsCancel.addEventListener('click', closeSettings);
  if (settingsSave) settingsSave.addEventListener('click', saveSettings);
  if (settingsModal) settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

  // Multi-select
  const selectModeBtn = $('#select-mode-btn');
  const bulkDownloadBtn = $('#bulk-download-btn');
  const selectCancelBtn = $('#select-cancel-btn');
  if (selectModeBtn) selectModeBtn.addEventListener('click', toggleSelectMode);
  if (bulkDownloadBtn) bulkDownloadBtn.addEventListener('click', downloadSelected);
  if (selectCancelBtn) selectCancelBtn.addEventListener('click', () => { selectMode = false; selectedVideos.clear(); document.getElementById('select-toolbar')?.classList.add('hidden'); updateBulkBtn(); renderCards(currentResults); });

  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    applySort();
    renderPage(1);
  });

  try { progressUnlisten = await listen('download-progress', onProgress); }
  catch {}

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeQueue();
      closePreview();
      closeContact();
      closeSettings();
      const hp = document.getElementById('history-panel');
      if (hp) hp.classList.add('hidden');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // Drag & Drop
  setupDragDrop();

  // Clipboard paste detection on search focus
  searchInput.addEventListener('focus', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.match(/(?:youtube\.com|youtu\.be)/i) && !searchInput.value.trim()) {
        searchInput.value = text.trim();
        showToast(currentLang === 'fr' ? 'Lien collé depuis le presse-papiers' : 'Link pasted from clipboard', 'success');
      }
    } catch {}
  });

  // History search
  const historySearch = document.getElementById('history-search');
  if (historySearch) historySearch.addEventListener('input', () => renderHistory());

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Auto-update yt-dlp on startup
  if (autoUpdateYtdlp) {
    invoke('update_ytdlp').then(res => {
      if (res !== 'already_up_to_date') showToast(currentLang === 'fr' ? 'yt-dlp mis à jour' : 'yt-dlp updated', 'success');
    }).catch(() => {});
  }

  // Check for app updates (Tauri updater plugin)
  try {
    if (window.__TAURI__ && window.__TAURI__.updater) {
      const update = await window.__TAURI__.updater.check();
      if (update && update.available) {
        const msg = currentLang === 'fr'
          ? `Mise à jour disponible: v${update.version}`
          : `Update available: v${update.version}`;
        if (confirm(msg + '\n' + (currentLang === 'fr' ? 'Installer maintenant ?' : 'Install now?'))) {
          await update.downloadAndInstall();
          if (window.__TAURI__ && window.__TAURI__.process) {
            window.__TAURI__.process.restart();
          } else {
            window.location.reload();
          }
        }
      }
    }
  } catch {}

  checkConnectivity();
  setInterval(checkConnectivity, 30000);
  showEmpty();

  // Modal drag-to-resize
  const modalPanel = document.getElementById('modal-panel');
  const modalResize = document.getElementById('modal-resize');
  const modalHeader = document.getElementById('modal-header');
  let isDragging = false, isMoving = false, isInteracting = false, startX, startY, startW, startH, startLeft, startTop;

  if (modalResize && modalPanel) {
    modalResize.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      isInteracting = true;
      startX = e.clientX; startY = e.clientY;
      startW = modalPanel.offsetWidth; startH = modalPanel.offsetHeight;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
    });
  }

  if (modalHeader && modalPanel) {
    modalHeader.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      e.stopPropagation();
      isMoving = true;
      isInteracting = true;
      startX = e.clientX; startY = e.clientY;
      const rect = modalPanel.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      document.body.style.cursor = 'move';
      document.body.style.userSelect = 'none';
    });
  }

  document.addEventListener('mousemove', e => {
    if (isDragging) {
      const w = Math.max(400, Math.min(window.innerWidth * 0.95, startW + (e.clientX - startX)));
      const h = Math.max(300, Math.min(window.innerHeight * 0.9, startH + (e.clientY - startY)));
      modalPanel.style.width = w + 'px';
      modalPanel.style.height = h + 'px';
    }
    if (isMoving) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      modalPanel.style.position = 'fixed';
      modalPanel.style.left = Math.max(0, Math.min(window.innerWidth - modalPanel.offsetWidth, startLeft + dx)) + 'px';
      modalPanel.style.top = Math.max(0, Math.min(window.innerHeight - 60, startTop + dy)) + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    isMoving = false;
    if (isInteracting) {
      setTimeout(() => { isInteracting = false; }, 50);
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // Splash screen
  setTimeout(() => {
    const splash = document.getElementById('splash');
    const app = document.getElementById('app');
    if (splash) splash.classList.add('fade-out');
    if (app) app.classList.add('app-visible');
    setTimeout(() => { if (splash) splash.remove(); }, 600);
  }, 1500);
});

// ===== DRAG & DROP =====
function setupDragDrop() {
  const overlay = document.getElementById('drop-overlay');
  if (!overlay) return;
  let dragCounter = 0;

  document.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    overlay.classList.remove('hidden');
  });

  document.addEventListener('dragleave', e => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.add('hidden');
    }
  });

  document.addEventListener('dragover', e => {
    e.preventDefault();
  });

  document.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.add('hidden');

    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (text) {
      const url = text.trim();
      if (url.match(/(?:youtube\.com|youtu\.be)/i) || url.match(/^[a-zA-Z0-9_-]{11}$/)) {
        searchInput.value = url;
        handleSearch();
        showToast(currentLang === 'fr' ? 'Lien détecté — recherche en cours...' : 'Link detected — searching...', 'success');
      } else {
        showToast(currentLang === 'fr' ? 'Lien non reconnu' : 'Unrecognized link', 'error');
      }
    }
  });

  // Paste support
  searchInput.addEventListener('paste', e => {
    setTimeout(() => {
      const val = searchInput.value.trim();
      if (val.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/i)) {
        handleSearch();
      }
    }, 50);
  });
}

function applyLang() {
  const netText = isOnline ? t('connected') : t('offline');
  if (netLabel) netLabel.textContent = netText;
  const contactBtn = $('#contact-btn');
  if (contactBtn) contactBtn.title = t('contact_support');
  if (queueToggle) queueToggle.title = t('toggle_queue');

  if (searchInput) searchInput.placeholder = t('search_placeholder');
  if (searchBtn && !searchBtn.disabled) searchBtn.innerHTML = `<i class="fas fa-magnifying-glass"></i> ${t('search_btn')}`;
  if (viewToggle) viewToggle.title = isListView ? t('view_grid') : t('view_list');

  const folderBtnEl = $('#folder-btn');
  if (folderBtnEl) folderBtnEl.innerHTML = `<i class="fas fa-folder-plus"></i> ${t('change_folder')}`;

  const sortOpts = sortSelect ? sortSelect.options : [];
  if (sortOpts.length >= 4) {
    sortOpts[0].text = t('sort_relevance');
    sortOpts[1].text = t('sort_title');
    sortOpts[2].text = t('sort_duration');
    sortOpts[3].text = t('sort_filesize');
  }

  const fmtOpts = formatSelect ? formatSelect.options : [];
  if (fmtOpts.length >= 6) {
    fmtOpts[0].text = t('best_quality');
    fmtOpts[5].text = t('audio_only');
  }

  const contactTitle = $('.modal-header .modal-title');
  if (contactTitle) contactTitle.innerHTML = `<i class="fas fa-envelope"></i> ${t('contact_title')}`;
  const cLabels = { 'contact-name': 'contact_name', 'contact-email': 'contact_email', 'contact-subject': 'contact_subject', 'contact-message': 'contact_message' };
  for (const [id, key] of Object.entries(cLabels)) {
    const label = $(`label[for="${id}"]`);
    if (label) label.textContent = t(key);
  }
  const nameInput = $('#contact-name');
  if (nameInput) nameInput.placeholder = t('contact_name_ph');
  const emailInput = $('#contact-email');
  if (emailInput) emailInput.placeholder = t('contact_email_ph');
  const msgTextarea = $('#contact-message');
  if (msgTextarea) msgTextarea.placeholder = t('contact_message_ph');
  const subjOpts = $('#contact-subject') ? $('#contact-subject').options : [];
  if (subjOpts.length >= 4) {
    subjOpts[0].text = t('contact_subject_bug');
    subjOpts[1].text = t('contact_subject_suggestion');
    subjOpts[2].text = t('contact_subject_feature');
    subjOpts[3].text = t('contact_subject_other');
  }
  const contactCancelBtn = $('#contact-cancel');
  if (contactCancelBtn) contactCancelBtn.textContent = t('contact_cancel');
  const contactSendBtn = $('#contact-send');
  if (contactSendBtn) contactSendBtn.innerHTML = `<i class="fas fa-paper-plane"></i> ${t('contact_send')}`;

  const queueHeaderLeft = $('.queue-header-left');
  if (queueHeaderLeft) queueHeaderLeft.innerHTML = `<i class="fas fa-list-ol"></i> ${t('queue_title')} <span id="queue-count" class="queue-badge">${queue.size}</span>`;

  const footer = $('.app-footer');
  if (footer) {
    footer.innerHTML = `<span class="version">v0.2.1</span> <span>|</span> <span>YT Downloader</span> <span>|</span> <a href="#" id="github-link" class="footer-link" target="_blank" rel="noopener"><i class="fab fa-github"></i> GitHub</a> <span>|</span> <span>&copy; 2026 Koffi Levis Akalete</span> <span>|</span> <span>${t('all_rights')}</span>`;
  }

  if (allResults.length > 0) renderPage(currentPage);
  else if (resultsEl.querySelector('.empty-state') || resultsEl.querySelector('.offline-state')) {
    if (!isOnline && queue.size === 0) showOffline();
    else showEmpty();
  }
  if (queue.size > 0) updateQueueUI();
}

async function checkConnectivity() {
  try { isOnline = await invoke('check_network'); }
  catch { isOnline = false; }
  netStatus.className = 'net-status ' + (isOnline ? 'online' : 'offline');
  netLabel.textContent = isOnline ? t('connected') : t('offline');
  if (!isOnline && queue.size === 0) showOffline();
  else if (isOnline && queue.size === 0 && resultsEl.querySelector('.offline-state')) showEmpty();
}

// ===== CONTACT =====
function openContact() { $('#contact-modal').classList.remove('hidden'); }
function closeContact() { $('#contact-modal').classList.add('hidden'); }
async function sendContact() {
  const name = $('#contact-name').value.trim();
  const email = $('#contact-email').value.trim();
  const subject = $('#contact-subject').value;
  const message = $('#contact-message').value.trim();
  if (!name || !email || !message) {
    showToast(t('contact_fill_all'), 'error');
    return;
  }
  const subjectLabels = { bug: t('contact_subject_bug'), suggestion: t('contact_subject_suggestion'), feature: t('contact_subject_feature'), other: t('contact_subject_other') };
  const sendBtn = $('#contact-send');
  const origHTML = sendBtn.innerHTML;
  sendBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ...`;
  sendBtn.disabled = true;

  try {
    const response = await fetch('https://yt-downloader-docs.vercel.app/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject: subjectLabels[subject] || subject, message })
    });
    const data = await response.json();

    if (response.ok) {
      showToast(t('contact_mail_opened'), 'success');
      closeContact();
      $('#contact-name').value = '';
      $('#contact-email').value = '';
      $('#contact-message').value = '';
    } else {
      showToast(data.message || t('err_generic'), 'error');
    }
  } catch (err) {
    showToast(t('err_generic'), 'error');
  } finally {
    sendBtn.innerHTML = origHTML;
    sendBtn.disabled = false;
  }
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
      showToast(t('cannot_play'), 'error');
      return;
    }
    previewTitle.textContent = title || t('preview_title');
    previewPlayer.dataset.vid = vid;
    previewPlayer.innerHTML = `
      <div class="player-spinner" id="preview-spinner">
        <div class="spinner-ring"></div>
        <p>${t('loading_video')}</p>
      </div>`;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0&modestbranding=1`;
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:none';
    iframe.onload = () => {
      const sp = document.getElementById('preview-spinner');
      if (sp) sp.remove();
      iframe.style.display = '';
    };
    previewPlayer.appendChild(iframe);
    const panel = document.getElementById('modal-panel');
    if (panel) {
      panel.style.width = '860px';
      panel.style.height = '540px';
      panel.style.maxWidth = '95vw';
      panel.style.maxHeight = '85vh';
      panel.style.position = '';
      panel.style.left = '';
      panel.style.top = '';
    }
    previewModal.classList.remove('hidden');
  } catch { showToast(t('open_error'), 'error'); }
}

function closePreview() {
  previewModal.classList.add('hidden');
  previewPlayer.innerHTML = `
    <div class="player-placeholder">
      <i class="fas fa-film"></i>
      <p>${t('loading_player')}</p>
    </div>`;
}

function renderSkeletons() {
  resultsEl.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner">
        <div class="ld-ring"></div>
        <div class="ld-ring"></div>
        <div class="ld-ring"></div>
      </div>
      <p class="loading-text">${t('loading_search')}</p>
      <p class="loading-sub">${t('loading_sub')}</p>
    </div>`;
}

// ===== SORT =====
function parseDuration(dur) {
  if (!dur || dur === 'Live') return Infinity;
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function parseFilesize(sizeStr) {
  if (!sizeStr) return 0;
  const m = sizeStr.match(/([\d.,]+)\s*(o|Ko|Mo|Go)/i);
  if (!m) return 0;
  const val = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  if (unit === 'go') return val * 1024 * 1024 * 1024;
  if (unit === 'mo') return val * 1024 * 1024;
  if (unit === 'ko') return val * 1024;
  return val;
}

function applySort() {
  allResults = [...allResultsOriginal];
  if (currentSort === 'title') {
    allResults.sort((a, b) => (a.title || '').localeCompare(b.title || '', currentLang === 'fr' ? 'fr' : 'en'));
  } else if (currentSort === 'duration') {
    allResults.sort((a, b) => parseDuration(a.duration) - parseDuration(b.duration));
  } else if (currentSort === 'filesize') {
    allResults.sort((a, b) => parseFilesize(b.filesize) - parseFilesize(a.filesize));
  }
}

// ===== SEARCH =====
async function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) return;

  searchBtn.disabled = true;
  searchBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('searching')}`;
  currentPage = 1;
  allResults = [];
  allResultsOriginal = [];
  currentPlaylistUrl = null;
  currentQuery = q;
  paginationEl.innerHTML = '';
  renderSkeletons();

  try {
    if (q.startsWith('http://') || q.startsWith('https://')) {
      const info = await invoke('get_video_info', { url: q });
      if (info.duration && info.duration.includes('vidéos')) {
        currentPlaylistUrl = q;
        const videos = await invoke('get_playlist', { url: q });
        allResultsOriginal = videos;
        currentSort = 'relevance';
        sortSelect.value = 'relevance';
        sortWrap.style.display = '';
        applySort();
        resultsEl.innerHTML = '';
        const hdr = document.createElement('div');
        hdr.className = 'empty-state';
        hdr.style.cssText = 'text-align:left;padding:0 0 8px 0';
        hdr.innerHTML = `<p><i class="fas fa-list" style="display:inline;font-size:13px;margin-right:6px;color:var(--primary)"></i> ${escHtml(info.title)} — ${videos.length} ${t('playlist_header')}</p>`;
        resultsEl.appendChild(hdr);
        renderPage(currentPage);
      } else {
        allResultsOriginal = [info];
        allResults = [info];
        sortWrap.style.display = 'none';
        resultsEl.innerHTML = '';
        renderCards([info]);
        paginationEl.innerHTML = '';
      }
    } else {
      const results = await invoke('search_videos', { query: q });
      allResultsOriginal = results;
      sortSelect.value = 'relevance';
      currentSort = 'relevance';
      sortWrap.style.display = results.length > 1 ? '' : 'none';
      applySort();
      if (!results.length) {
        resultsEl.innerHTML = `<div class="empty-state"><i class="fas fa-video-slash"></i><p>${t('no_results')}</p><p class="sub">${t('no_results_sub')}</p></div>`;
        paginationEl.innerHTML = '';
        sortWrap.style.display = 'none';
      } else {
        resultsEl.innerHTML = '';
        renderPage(currentPage);
      }
    }
  } catch (err) {
    const msg = typeof err === 'string' ? err : t('err_generic');
    resultsEl.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>${t('error_title')}</p><p class="sub">${escHtml(msg)}</p></div>`;
    paginationEl.innerHTML = '';
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = `<i class="fas fa-magnifying-glass"></i> ${t('search_btn')}`;
  }
}

function renderPage(page) {
  currentPage = page;
  const total = allResults.length;
  const totalPages = Math.ceil(total / PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PER_PAGE;
  const slice = allResults.slice(start, start + PER_PAGE);
  currentResults = slice;

  resultsEl.innerHTML = '';
  renderCards(slice);
  renderPagination();
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPagination() {
  const total = allResults.length;
  const totalPages = Math.ceil(total / PER_PAGE);
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="pg-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button class="pg-btn pg-num" data-page="1">1</button>`;
    if (startPage > 2) html += `<span class="pg-ellipsis">…</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pg-btn pg-num ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="pg-ellipsis">…</span>`;
    html += `<button class="pg-btn pg-num" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `<button class="pg-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  html += `<span class="pg-info">${allResults.length} ${t('results_count')}</span>`;

  paginationEl.innerHTML = html;

  paginationEl.querySelectorAll('.pg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pg = parseInt(btn.dataset.page);
      if (!isNaN(pg)) renderPage(pg);
    });
  });
}

function renderCards(items) {
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.url = item.url;
    const isLive = item.duration === 'Live';
    const badgeHtml = isLive
      ? `<span class="badge"><i class="fas fa-circle" style="color:var(--error)"></i> ${t('live_badge')}</span>`
      : `<span class="badge">${item.duration}</span>`;
    const sizeHtml = item.filesize
      ? `<span class="meta-size"><i class="fas fa-hard-drive"></i> ${escHtml(item.filesize)}</span>`
      : '';

    const selectHtml = selectMode
      ? `<div class="card-select"><input type="checkbox" class="card-checkbox" data-url="${item.url}" data-title="${escHtml(item.title)}" ${selectedVideos.has(item.url) ? 'checked' : ''}></div>`
      : '';

    card.innerHTML = `
      <div class="thumb">
        ${selectHtml}
        <img src="${item.thumbnail}" alt="${item.title}" loading="lazy" onerror="this.remove()">
        <i class="fas fa-film fallback"></i>
        <div class="play-hover"><i class="fas fa-circle-play"></i></div>
        ${badgeHtml}
        <div class="card-progress hidden" data-card-progress="${item.url}">
          <div class="card-progress-bar"><div class="card-progress-fill"></div></div>
          <span class="card-progress-text">0%</span>
        </div>
      </div>
      <div class="info">
        <div class="title">${escHtml(item.title)}</div>
        <div class="meta-row">
          <i class="fas fa-user"></i> ${escHtml(item.author)}
          ${sizeHtml}
        </div>
        <div class="actions">
          <button class="dl-btn" data-url="${item.url}" data-title="${escHtml(item.title)}">
            <i class="fas fa-circle-down"></i> ${t('download')}
          </button>
        </div>
      </div>`;

    card.querySelector('.play-hover').addEventListener('click', () => openPreview(item.url, item.title));
    card.querySelector('.dl-btn').addEventListener('click', e => addToQueue(item.url, item.title, e.currentTarget));

    const checkbox = card.querySelector('.card-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', e => {
        if (e.target.checked) selectedVideos.set(item.url, item.title);
        else selectedVideos.delete(item.url);
        updateBulkBtn();
      });
    }

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
      <p>${t('app_name')}</p>
      <p class="sub">${t('empty_hint')}</p>
    </div>`;
}

function showOffline() {
  resultsEl.innerHTML = `
    <div class="offline-state">
      <i class="fas fa-wifi-slash"></i>
      <p>${t('offline_title')}</p>
      <p class="sub">${t('offline_sub')}</p>
    </div>`;
}

function toggleView() {
  isListView = !isListView;
  resultsEl.classList.toggle('list-view', isListView);
  viewToggle.classList.toggle('active', isListView);
  viewToggle.innerHTML = isListView ? '<i class="fas fa-th-large"></i>' : '<i class="fas fa-list"></i>';
  viewToggle.title = isListView ? t('view_grid') : t('view_list');
  if (allResults.length) renderPage(currentPage);
}

// ===== QUEUE =====
function openQueue() { queueOverlay.classList.remove('hidden'); }
function closeQueue() { queueOverlay.classList.add('hidden'); }

function addToQueue(url, title, btn) {
  if (queue.has(url)) { showToast(t('already_in_queue'), 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-check"></i> ${t('finished')}`;

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const item = { id, url, title, status: 'waiting', percent: 0 };
  queue.set(url, item);

  saveHistory({ title, url, author: '' });

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
    let statusText = t('paused');
    let actions = '';

    if (isDownloading) {
      icon = 'fa-spinner fa-spin';
      statusText = `${Math.round(item.percent)}% · ${t('downloading')}`;
      actions = `
        <button class="q-action-btn" data-action="pause" data-url="${item.url}" title="${t('paused')}"><i class="fas fa-pause"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="${t('cancel')}"><i class="fas fa-ban"></i></button>`;
    } else if (isWaiting) {
      icon = 'fa-hourglass-half';
      statusText = t('waiting');
      actions = `
        <button class="q-action-btn success" data-action="resume" data-url="${item.url}" title="${t('start')}"><i class="fas fa-play"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="${t('cancel')}"><i class="fas fa-ban"></i></button>`;
    } else if (isPaused) {
      icon = 'fa-pause';
      statusText = t('paused');
      actions = `
        <button class="q-action-btn success" data-action="resume" data-url="${item.url}" title="${t('start')}"><i class="fas fa-play"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="${t('remove')}"><i class="fas fa-trash"></i></button>`;
    } else if (isFinished) {
      icon = 'fa-circle-check';
      statusText = t('finished');
      actions = `<button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="${t('remove')}"><i class="fas fa-trash"></i></button>`;
    } else if (isError) {
      icon = 'fa-circle-xmark';
      statusText = t('error_label');
      actions = `
        <button class="q-action-btn success" data-action="resume" data-url="${item.url}" title="${t('retry')}"><i class="fas fa-rotate"></i></button>
        <button class="q-action-btn danger" data-action="cancel" data-url="${item.url}" title="${t('remove')}"><i class="fas fa-trash"></i></button>`;
    }

    html += `
      <div class="q-item ${statusClass}" data-qitem="${item.url}">
        <div class="q-title"><i class="fas ${icon}" style="color:${isDownloading ? 'var(--primary)' : isFinished ? 'var(--success)' : isError ? 'var(--error)' : 'var(--text-secondary)'}"></i>${escHtml(item.title || 'Video')}</div>
        <div class="q-bar"><div class="q-fill" style="width:${item.percent}%"></div></div>
        <div class="q-footer">
          <span class="q-meta">${statusText}</span>
          <div class="q-qactions">${actions}</div>
        </div>
      </div>`;
  }

  if (!queue.size) {
    html = `<div style="text-align:center;padding:40px 0;color:var(--text-secondary);font-size:13px">${t('queue_empty')}</div>`;
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

function updateQueueItemProgress(url, percent, status, speed, eta) {
  const qItem = queueList.querySelector(`[data-qitem="${CSS.escape(url)}"]`);
  if (!qItem) return;
  const fill = qItem.querySelector('.q-fill');
  const meta = qItem.querySelector('.q-meta');
  if (fill) fill.style.width = percent + '%';
  if (meta) {
    let text = `${Math.round(percent)}% · ${t('downloading')}`;
    if (speed) text += ` · ${speed}`;
    if (eta) text += ` · ETA ${eta}`;
    meta.textContent = text;
  }
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
  const slots = maxConcurrent - activeDownloads;

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
    const format = formatSelect ? formatSelect.value : 'best';
    await invoke('download_video', { id: item.id, url: item.url, outputDir: downloadDir, format, speedLimit: speedLimit === '0' ? null : speedLimit });
  } catch (err) {
    item.status = 'error';
    updateQueueUI();
    showToast(`${t('error_title')}: ${err}`, 'error');
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
      if (data.speed) item.speed = data.speed;
      if (data.eta) item.eta = data.eta;

      updateCardProgress(item.url, item.percent, data.status, data.speed);

      if (data.status === 'downloading') {
        updateQueueItemProgress(item.url, item.percent, data.status, data.speed, data.eta);
        updateGlobalProgress();
      } else if (data.status === 'finished') {
        showToast(`${item.title || 'Video'} ${t('dl_complete')}`, 'success');
        updateCardProgress(item.url, 100, 'finished');
        try { if ('Notification' in window && Notification.permission === 'granted') new Notification('YT Downloader', { body: `${item.title || 'Video'} ${t('dl_complete')}`, icon: 'assets/logo.svg' }); } catch {}
        setTimeout(() => {
          queue.delete(item.url);
          updateQueueBadge();
          updateQueueUI();
          updateGlobalProgress();
        }, 2000);
      } else if (data.status === 'error') {
        showToast(`${data.error || item.title}`, 'error');
        updateCardProgress(item.url, 0, 'error');
        updateGlobalProgress();
      }
      break;
    }
  }
}

function updateCardProgress(url, percent, status, speed) {
  const el = document.querySelector(`[data-card-progress="${CSS.escape(url)}"]`);
  if (!el) return;
  const fill = el.querySelector('.card-progress-fill');
  const text = el.querySelector('.card-progress-text');
  if (status === 'downloading' || status === 'starting') {
    el.classList.remove('hidden');
    fill.style.width = percent + '%';
    text.textContent = speed ? `${Math.round(percent)}% · ${speed}` : Math.round(percent) + '%';
  } else if (status === 'finished') {
    el.classList.remove('hidden');
    el.classList.add('finished');
    fill.style.width = '100%';
    text.textContent = '\u2713 ' + t('finished');
    setTimeout(() => el.classList.add('hidden'), 2500);
  } else if (status === 'error') {
    el.classList.remove('hidden');
    el.classList.add('error');
    fill.style.width = '0%';
    text.textContent = '\u2717 ' + t('error_label');
    setTimeout(() => { el.classList.add('hidden'); el.classList.remove('error'); }, 3000);
  }
}

function updateGlobalProgress() {
  const globalBar = document.getElementById('global-progress');
  const globalFill = document.getElementById('global-progress-fill');
  const globalText = document.getElementById('global-progress-text');
  if (!globalBar || !globalFill || !globalText) return;

  let active = 0, total = 0, totalPercent = 0;
  for (const [, item] of queue) {
    total++;
    if (item.status === 'downloading' || item.status === 'starting') {
      active++;
      totalPercent += item.percent;
    } else if (item.status === 'finished') {
      totalPercent += 100;
    }
  }

  if (total === 0) {
    globalBar.classList.add('hidden');
    return;
  }

  globalBar.classList.remove('hidden');
  const avg = totalPercent / total;
  globalFill.style.width = avg + '%';

  let text = `${Math.round(avg)}%`;
  if (active > 0) text += ` · ${active} en cours`;
  let speeds = [];
  for (const [, item] of queue) {
    if (item.speed && (item.status === 'downloading' || item.status === 'starting')) speeds.push(item.speed);
  }
  if (speeds.length) text += ` · ${speeds.join(' + ')}`;
  globalText.textContent = text;
}

function toggleSelectMode() {
  selectMode = !selectMode;
  if (!selectMode) selectedVideos.clear();
  const toolbar = document.getElementById('select-toolbar');
  if (toolbar) toolbar.classList.toggle('hidden', !selectMode);
  updateBulkBtn();
  renderCards(currentResults);
}

function updateBulkBtn() {
  const bulkBtn = document.getElementById('bulk-download-btn');
  if (bulkBtn) bulkBtn.disabled = selectedVideos.size === 0;
  const countEl = document.getElementById('select-count');
  if (countEl) countEl.textContent = selectedVideos.size;
}

function downloadSelected() {
  if (selectedVideos.size === 0) return;
  for (const [url, title] of selectedVideos) {
    addToQueue(url, title);
  }
  selectedVideos.clear();
  selectMode = false;
  const toolbar = document.getElementById('select-toolbar');
  if (toolbar) toolbar.classList.add('hidden');
  updateBulkBtn();
  renderCards(currentResults);
}
