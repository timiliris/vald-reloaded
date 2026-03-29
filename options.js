const $ = (id) => document.getElementById(id);

// Load settings
chrome.storage.local.get(
  ["notificationsEnabled", "soundEnabled", "persistentNotif"],
  (data) => {
    $("notificationsEnabled").checked = data.notificationsEnabled !== false;
    $("soundEnabled").checked = data.soundEnabled !== false;
    $("persistentNotif").checked = data.persistentNotif !== false;
  }
);

// Save with feedback animation
$("settingsForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const saveBtn = $("saveBtn");

  chrome.storage.local.set(
    {
      notificationsEnabled: $("notificationsEnabled").checked,
      soundEnabled: $("soundEnabled").checked,
      persistentNotif: $("persistentNotif").checked,
    },
    () => {
      // Button feedback
      saveBtn.classList.add("saved");

      // Status message
      const el = $("status");
      el.textContent = "Sauvegarde !";
      el.classList.add("visible");

      setTimeout(() => {
        el.classList.remove("visible");
        saveBtn.classList.remove("saved");
      }, 2000);
    }
  );
});

// Test notification with button feedback
$("testNotifBtn").addEventListener("click", function () {
  this.classList.add("sent");
  chrome.runtime.sendMessage({ type: "testNotification" });

  setTimeout(() => {
    this.classList.remove("sent");
  }, 1500);
});
