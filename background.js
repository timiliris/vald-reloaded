const CHECK_ALARM = "checkValdStream";
const API_URL = "https://valdapi.3de-scs.tech";
const CHECK_INTERVAL = 2; // minutes

// --- Stream check ---
async function checkStream() {
  try {
    const res = await fetch(`${API_URL}/api/status`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const stream = await res.json();

    // Single storage read: get everything we need at once
    const stored = await chrome.storage.local.get([
      "lastKnownStatus",
      "streamData",
      "notificationsEnabled",
      "soundEnabled",
      "persistentNotif",
    ]);

    if (stream.live) {
      // Notify only on transition offline -> live
      if (stored.lastKnownStatus !== "live") {
        if (stored.notificationsEnabled !== false) {
          chrome.notifications.create("valdLive", {
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "VALD EST EN LIVE !",
            message: stream.title || "Vald est en live sur Twitch",
            contextMessage: stream.gameName
              ? `Joue a ${stream.gameName}`
              : "En live sur Twitch",
            requireInteraction: stored.persistentNotif !== false,
            silent: stored.soundEnabled === false,
          });
        }
      }

      // Single storage write with all fields
      await chrome.storage.local.set({
        lastKnownStatus: "live",
        streamData: stream,
        lastCheck: Date.now(),
        lastError: null,
      });

      // Badge: viewer count
      const viewers =
        stream.viewerCount >= 1000
          ? (stream.viewerCount / 1000).toFixed(1) + "K"
          : String(stream.viewerCount);
      chrome.action.setBadgeText({ text: viewers });
      chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
    } else {
      // Stream just ended - show summary notification
      if (stored.lastKnownStatus === "live") {
        if (stored.streamData && stored.notificationsEnabled !== false) {
          const s = stored.streamData;
          const durationMs = Date.now() - new Date(s.startedAt).getTime();
          const hours = Math.floor(durationMs / 3600000);
          const minutes = Math.floor((durationMs % 3600000) / 60000);
          const durationStr = hours > 0
            ? `${hours}h${String(minutes).padStart(2, "0")}`
            : `${minutes}min`;
          chrome.notifications.create("valdEnded", {
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: "Stream termine",
            message: s.title || "Le stream de Vald est termine",
            contextMessage: `Duree: ${durationStr} | Peak: ${s.viewerCount} viewers`,
            requireInteraction: false,
            silent: stored.soundEnabled === false,
          });
        }
      }

      await chrome.storage.local.set({
        lastKnownStatus: "offline",
        streamData: null,
        lastCheck: Date.now(),
        lastError: null,
      });
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (e) {
    console.error("Stream check failed:", e);
    await chrome.storage.local.set({ lastError: e.message });
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
  }
}

// --- Ensure alarm exists (idempotent) ---
async function ensureAlarm() {
  const existing = await chrome.alarms.get(CHECK_ALARM);
  if (!existing) {
    chrome.alarms.create(CHECK_ALARM, { periodInMinutes: CHECK_INTERVAL });
  }
}

// --- Event listeners ---
chrome.runtime.onInstalled.addListener(async () => {
  // Only set defaults on install, don't overwrite existing prefs
  const existing = await chrome.storage.local.get(["lastKnownStatus"]);
  if (existing.lastKnownStatus === undefined) {
    await chrome.storage.local.set({
      lastKnownStatus: "offline",
      streamData: null,
      lastCheck: null,
      lastError: null,
    });
  }
  await ensureAlarm();
  checkStream();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  checkStream();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECK_ALARM) {
    checkStream();
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId === "valdLive" || notifId === "valdEnded") {
    chrome.tabs.create({ url: "https://twitch.tv/vald" });
    chrome.notifications.clear(notifId);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "checkNow") {
    checkStream().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "testNotification") {
    chrome.storage.local.get(["soundEnabled", "persistentNotif"], (prefs) => {
      chrome.notifications.create("valdTest", {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "VALD EST EN LIVE !",
        message: "Ceci est une notification de test",
        contextMessage: "Joue a Just Chatting",
        requireInteraction: prefs.persistentNotif !== false,
        silent: prefs.soundEnabled === false,
      });
    });
  }
});
