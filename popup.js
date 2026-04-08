const API_URL = "https://valdapi.3de-scs.tech";

// --- Cached DOM references ---
const dom = {};
function $(id) {
  if (!dom[id]) dom[id] = document.getElementById(id);
  return dom[id];
}

// --- Security: HTML escape to prevent XSS when inserting external data ---
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

// --- Security: validate URLs to prevent javascript: protocol injection ---
function sanitizeUrl(url) {
  const str = String(url || "");
  try {
    const parsed = new URL(str);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return str;
    }
  } catch { /* invalid URL */ }
  return "#";
}

// --- Data cache for tabs (avoid refetching on every tab click) ---
const dataCache = {
  history: { data: null, fetchedAt: 0 },
  clips: { data: null, fetchedAt: 0 },
};
const TAB_CACHE_TTL = 60_000; // 1 minute

// --- Tabs with animated indicator ---
const tabNav = $("tabNav");
const tabIndexMap = { status: 1, history: 2, clips: 3, socials: 4 };

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;

    // Update active tab button
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    // Animate the indicator bar
    if (tabNav) {
      tabNav.className = "tabs tab-" + tabIndexMap[tabName];
    }

    // Switch content with animation
    document.querySelectorAll(".tab-content").forEach((c) => {
      c.classList.remove("active");
      c.style.animation = "none";
    });

    const target = $(`tab-${tabName}`);
    if (target) {
      void target.offsetHeight; // Force reflow for animation restart
      target.style.animation = "";
      target.classList.add("active");
    }

    if (tabName === "history") loadHistory();
    if (tabName === "clips") loadClips();
  });
});

// --- Status tab ---
const stateNames = ["offline", "live", "error"];
function showState(name) {
  for (const s of stateNames) {
    const el = $(s);
    if (el) {
      if (s === name) {
        el.style.display = "block";
        el.style.animation = "none";
        void el.offsetHeight;
        el.style.animation = "tab-enter 0.3s ease forwards";
      } else {
        el.style.display = "none";
      }
    }
  }
}

function formatUptime(startedAt) {
  const diff = Date.now() - new Date(startedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `En live depuis ${hours}h${String(minutes).padStart(2, "0")}`;
  return `En live depuis ${minutes}min`;
}

function formatViewers(count) {
  if (count >= 1000) return (count / 1000).toFixed(1) + "K viewers";
  return count + " viewers";
}

function formatLastCheck(timestamp) {
  if (!timestamp) return "";
  const diff = Math.floor((Date.now() - timestamp) / 60000);
  if (diff < 1) return "Verifie a l'instant";
  return `Verifie il y a ${diff}min`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diff = end - start;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}`;
  return `${minutes}min`;
}

function formatRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

// Track last rendered state to skip no-op renders
let lastRenderedStatus = null;
let lastRenderedCheck = null;

async function renderStatus() {
  const data = await chrome.storage.local.get([
    "lastKnownStatus",
    "streamData",
    "lastCheck",
    "lastError",
  ]);

  if (data.lastError) {
    showState("error");
    $("errorText").textContent = data.lastError;
    lastRenderedStatus = null;
    return;
  }

  if (data.lastKnownStatus === "live" && data.streamData) {
    const s = data.streamData;

    // Skip full re-render if nothing changed
    if (
      lastRenderedStatus === "live" &&
      lastRenderedCheck === data.lastCheck
    ) {
      // Only update the uptime text (it changes with wall clock)
      $("streamUptime").textContent = formatUptime(s.startedAt);
      return;
    }

    showState("live");
    $("streamThumbnail").src = s.thumbnail;
    $("streamTitle").textContent = s.title;
    $("streamGame").textContent = s.gameName || "";
    $("viewerCount").textContent = formatViewers(s.viewerCount);
    $("streamUptime").textContent = formatUptime(s.startedAt);
    lastRenderedStatus = "live";
    lastRenderedCheck = data.lastCheck;
  } else {
    if (lastRenderedStatus === "offline" && lastRenderedCheck === data.lastCheck) {
      return;
    }
    showState("offline");
    $("offlineLastCheck").textContent = formatLastCheck(data.lastCheck);
    lastRenderedStatus = "offline";
    lastRenderedCheck = data.lastCheck;
  }
}

// --- Helper: create loading spinner ---
function createLoadingSpinner() {
  const wrapper = document.createElement("div");
  wrapper.className = "loading-spinner";
  const ring = document.createElement("div");
  ring.className = "spinner-ring";
  wrapper.appendChild(ring);
  const text = document.createElement("span");
  text.textContent = "Chargement...";
  wrapper.appendChild(text);
  return wrapper;
}

// --- Helper: create empty state ---
function createEmptyState(svgMarkup, message, hint) {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";

  const artDiv = document.createElement("div");
  artDiv.innerHTML = svgMarkup;
  wrapper.appendChild(artDiv.firstElementChild);

  const p = document.createElement("p");
  p.textContent = message;
  wrapper.appendChild(p);

  if (hint) {
    const hintEl = document.createElement("span");
    hintEl.className = "empty-hint";
    hintEl.textContent = hint;
    wrapper.appendChild(hintEl);
  }

  return wrapper;
}

// --- Helper: create error state ---
function createErrorState(message, hint) {
  const svgMarkup = '<svg class="empty-state-art" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="20" stroke="#ef4444" stroke-width="1.5" fill="none" opacity="0.3"/><line x1="20" y1="20" x2="36" y2="36" stroke="#ef4444" stroke-width="1.5" opacity="0.4"/><line x1="36" y1="20" x2="20" y2="36" stroke="#ef4444" stroke-width="1.5" opacity="0.4"/></svg>';
  const wrapper = createEmptyState(svgMarkup, message, hint);
  wrapper.querySelector("p").style.color = "var(--red-glow)";
  return wrapper;
}

// --- History tab ---
async function loadHistory(forceRefresh = false) {
  const cache = dataCache.history;
  const list = $("historyList");

  // Use cache if fresh
  if (!forceRefresh && cache.data !== null && Date.now() - cache.fetchedAt < TAB_CACHE_TTL) {
    return;
  }

  list.innerHTML = "";
  list.appendChild(createLoadingSpinner());

  try {
    const res = await fetch(`${API_URL}/api/history`);
    const history = await res.json();
    cache.data = history;
    cache.fetchedAt = Date.now();

    list.innerHTML = "";

    if (history.length === 0) {
      const emptySvg = '<svg class="empty-state-art" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="6" width="40" height="44" rx="4" stroke="#3a3a3a" stroke-width="1.5" fill="none" opacity="0.5"/><line x1="16" y1="16" x2="40" y2="16" stroke="#2a2a2a" stroke-width="1.5" opacity="0.4"/><line x1="16" y1="24" x2="36" y2="24" stroke="#2a2a2a" stroke-width="1.5" opacity="0.3"/><line x1="16" y1="32" x2="32" y2="32" stroke="#2a2a2a" stroke-width="1.5" opacity="0.2"/></svg>';
      list.appendChild(createEmptyState(emptySvg, "Aucun stream enregistre pour le moment.", "L'historique apparaitra ici apres le premier live."));
      return;
    }

    for (let i = 0; i < history.length; i++) {
      const s = history[i];
      const isLive = s.endedAt === null;
      const item = document.createElement("div");
      item.className = "history-item" + (isLive ? " is-live" : "");
      item.style.animation = `tab-enter 0.3s ease ${i * 0.04}s both`;

      const header = document.createElement("div");
      header.className = "history-header";

      const dateSpan = document.createElement("span");
      dateSpan.className = "history-date";
      dateSpan.textContent = formatDate(s.startedAt);
      header.appendChild(dateSpan);

      if (isLive) {
        const badge = document.createElement("span");
        badge.className = "live-badge-small";
        badge.textContent = "EN COURS";
        header.appendChild(badge);
      } else {
        const dur = document.createElement("span");
        dur.className = "history-duration";
        dur.textContent = formatDuration(s.startedAt, s.endedAt);
        header.appendChild(dur);
      }
      item.appendChild(header);

      const title = document.createElement("div");
      title.className = "history-title";
      title.textContent = s.title;
      item.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "history-meta";

      // Show games list if multiple games were played
      if (s.games && s.games.length > 1) {
        const gameSpan = document.createElement("span");
        gameSpan.textContent = s.games.join(", ");
        meta.appendChild(gameSpan);
      } else if (s.gameName) {
        const gameSpan = document.createElement("span");
        gameSpan.textContent = s.gameName;
        meta.appendChild(gameSpan);
      }

      // Show live viewer count for current stream
      if (isLive && s.viewerCount) {
        const liveViewerSpan = document.createElement("span");
        liveViewerSpan.className = "history-live-viewers";
        liveViewerSpan.textContent = formatViewers(s.viewerCount);
        meta.appendChild(liveViewerSpan);
      }

      if (s.peakViewers) {
        const peakSpan = document.createElement("span");
        peakSpan.textContent = "Peak: " + formatViewers(s.peakViewers);
        meta.appendChild(peakSpan);
      }

      if (s.avgViewers) {
        const avgSpan = document.createElement("span");
        avgSpan.textContent = "Moy: " + formatViewers(s.avgViewers);
        meta.appendChild(avgSpan);
      }

      if (s.vodViews) {
        const vodSpan = document.createElement("span");
        vodSpan.textContent = formatViewers(s.vodViews).replace("viewers", "vues VOD");
        meta.appendChild(vodSpan);
      }

      item.appendChild(meta);
      list.appendChild(item);
    }
  } catch (e) {
    list.innerHTML = "";
    list.appendChild(createErrorState("Impossible de charger l'historique", "Verifie ta connexion et reessaie."));
  }
}

// --- Clips tab ---
async function loadClips(forceRefresh = false) {
  const cache = dataCache.clips;
  const list = $("clipsList");

  // Use cache if fresh
  if (!forceRefresh && cache.data !== null && Date.now() - cache.fetchedAt < TAB_CACHE_TTL) {
    return;
  }

  list.innerHTML = "";
  list.appendChild(createLoadingSpinner());

  try {
    const res = await fetch(`${API_URL}/api/clips`);
    const clips = await res.json();
    cache.data = clips;
    cache.fetchedAt = Date.now();

    list.innerHTML = "";

    if (clips.length === 0) {
      const emptySvg = '<svg class="empty-state-art" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="12" width="48" height="32" rx="4" stroke="#3a3a3a" stroke-width="1.5" fill="none" opacity="0.5"/><polygon points="22,22 22,38 36,30" stroke="#991b1b" stroke-width="1.5" fill="none" opacity="0.3"/></svg>';
      list.appendChild(createEmptyState(emptySvg, "Aucun clip trouve.", "Les clips apparaitront ici quand ils seront disponibles."));
      return;
    }

    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const link = document.createElement("a");
      link.href = sanitizeUrl(c.url);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "clip-item";
      link.style.animation = `tab-enter 0.3s ease ${i * 0.04}s both`;

      const thumbWrap = document.createElement("div");
      thumbWrap.className = "clip-thumb-wrap";

      const img = document.createElement("img");
      img.src = sanitizeUrl(c.thumbnail);
      img.className = "clip-thumb";
      img.alt = "";
      img.loading = "lazy";
      thumbWrap.appendChild(img);

      // Play overlay
      const playOverlay = document.createElement("div");
      playOverlay.className = "clip-play-overlay";
      const playIcon = document.createElement("div");
      playIcon.className = "clip-play-icon";
      playIcon.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19"/></svg>';
      playOverlay.appendChild(playIcon);
      thumbWrap.appendChild(playOverlay);

      const durSpan = document.createElement("span");
      durSpan.className = "clip-duration";
      durSpan.textContent = Math.round(c.duration) + "s";
      thumbWrap.appendChild(durSpan);
      link.appendChild(thumbWrap);

      const info = document.createElement("div");
      info.className = "clip-info";

      const clipTitle = document.createElement("div");
      clipTitle.className = "clip-title";
      clipTitle.textContent = c.title;
      info.appendChild(clipTitle);

      const clipMeta = document.createElement("div");
      clipMeta.className = "clip-meta";
      const creatorSpan = document.createElement("span");
      creatorSpan.textContent = "Par " + c.creatorName;
      clipMeta.appendChild(creatorSpan);
      const viewSpan = document.createElement("span");
      viewSpan.textContent = formatViewers(c.viewCount);
      clipMeta.appendChild(viewSpan);
      info.appendChild(clipMeta);

      const clipDate = document.createElement("div");
      clipDate.className = "clip-date";
      clipDate.textContent = formatRelativeTime(c.createdAt);
      clipDate.title = formatDate(c.createdAt); // full date on hover
      info.appendChild(clipDate);

      // Show game name if available
      if (c.gameName) {
        const clipGame = document.createElement("div");
        clipGame.className = "clip-game";
        clipGame.textContent = c.gameName;
        info.appendChild(clipGame);
      }

      link.appendChild(info);
      list.appendChild(link);
    }
  } catch (e) {
    list.innerHTML = "";
    list.appendChild(createErrorState("Impossible de charger les clips", "Verifie ta connexion et reessaie."));
  }
}

// --- Buttons ---
$("refreshBtn").addEventListener("click", function () {
  const icon = $("refreshIcon");
  const btn = this;
  icon.classList.add("spinning");
  btn.classList.add("ripple");

  // Invalidate tab caches on manual refresh
  dataCache.history.fetchedAt = 0;
  dataCache.clips.fetchedAt = 0;

  chrome.runtime.sendMessage({ type: "checkNow" }, () => {
    setTimeout(() => {
      icon.classList.remove("spinning");
      btn.classList.remove("ripple");
      renderStatus();
    }, 1000);
  });
});

$("settingsBtn").addEventListener("click", function () {
  this.classList.add("ripple");
  setTimeout(() => this.classList.remove("ripple"), 400);
  chrome.runtime.openOptionsPage();
});

$("retryBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "checkNow" }, () => {
    setTimeout(renderStatus, 1000);
  });
});

// Only re-render when relevant storage keys change
chrome.storage.onChanged.addListener((changes) => {
  const relevant = ["lastKnownStatus", "streamData", "lastCheck", "lastError"];
  if (relevant.some((key) => key in changes)) {
    lastRenderedStatus = null; // force full re-render
    renderStatus();
  }
});

// Auto-refresh history tab every 30s if it's visible (for live viewer count updates)
let historyRefreshInterval = null;
function startHistoryAutoRefresh() {
  if (historyRefreshInterval) return;
  historyRefreshInterval = setInterval(() => {
    const historyTab = $("tab-history");
    if (historyTab && historyTab.classList.contains("active")) {
      dataCache.history.fetchedAt = 0; // force refresh
      loadHistory(true);
    }
  }, 30_000);
}
startHistoryAutoRefresh();

// Init - just render from storage, the alarm handles periodic checks
renderStatus();
