"use strict";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const { DEFAULT_MIRROR, normalizeMirrorTemplate } = globalThis.toFreediumMirror;

const elements = {
  statusBadge: document.getElementById("status-badge"),
  statusCopy: document.getElementById("status-copy"),
  toggleButton: document.getElementById("toggle-button"),
  mirrorInput: document.getElementById("mirror-url"),
  saveMirrorButton: document.getElementById("save-mirror-button"),
  presetList: document.getElementById("preset-list"),
  feedback: document.getElementById("feedback")
};

let appState = {
  settings: null,
  builtinPublications: [],
  grantedOrigins: []
};

function setControlsDisabled(disabled) {
  elements.toggleButton.disabled = disabled;
  elements.mirrorInput.disabled = disabled;
  elements.saveMirrorButton.disabled = disabled;
}

function setFeedback(message, kind = "") {
  elements.feedback.textContent = message || "";
  elements.feedback.className = "feedback";
  if (kind) {
    elements.feedback.classList.add(`is-${kind}`);
  }
}

function toOriginPattern(hostname) {
  return `*://${hostname}/*`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function originPatternToRegex(originPattern) {
  return new RegExp(`^${escapeRegex(originPattern).replace(/\\\*/g, ".*")}$`);
}

function originGranted(hostname) {
  const probe = `https://${hostname}/`;
  return (appState.grantedOrigins || []).some((origin) => originPatternToRegex(origin).test(probe));
}

function updateStatus() {
  const enabled = Boolean(appState.settings?.enabled);
  elements.statusBadge.textContent = enabled ? "Enabled" : "Disabled";
  elements.statusBadge.classList.toggle("is-on", enabled);
  elements.toggleButton.textContent = enabled ? "Turn off" : "Turn on";
  elements.statusCopy.textContent = enabled
    ? "Supported domains will redirect through the selected mirror."
    : "No redirect rules are active right now.";
}

function createPresetItem(publication) {
  const enabledDomains = new Set(appState.settings.enabledPresetDomains || []);
  const granted = originGranted(publication.host);
  const item = document.createElement("article");
  item.className = "preset-item";

  const main = document.createElement("div");
  main.className = "preset-main";

  const label = document.createElement("div");
  label.className = "preset-label";
  label.textContent = publication.label;

  const meta = document.createElement("div");
  meta.className = "domain-meta";
  meta.textContent = publication.host;

  main.append(label, meta);

  const button = document.createElement("button");
  button.className = "secondary-button";
  button.type = "button";
  button.textContent = enabledDomains.has(publication.host) ? "Disable" : granted ? "Enable" : "Grant + enable";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const currentlyEnabled = enabledDomains.has(publication.host);
      if (!currentlyEnabled && !granted) {
        const allowed = await browser.permissions.request({
          origins: [toOriginPattern(publication.host)]
        });
        if (!allowed) {
          setFeedback(`Permission denied for ${publication.host}.`, "error");
          return;
        }
      }

      const nextDomains = new Set(appState.settings.enabledPresetDomains || []);
      if (currentlyEnabled) {
        nextDomains.delete(publication.host);
      } else {
        nextDomains.add(publication.host);
      }

      await saveSettings({ enabledPresetDomains: Array.from(nextDomains).sort() });
      setFeedback(currentlyEnabled ? `Disabled ${publication.label}.` : `Enabled ${publication.label}.`, "success");
    } catch (error) {
      setFeedback(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  item.append(main, button);
  return item;
}

function render() {
  if (!appState.settings) {
    return;
  }

  setControlsDisabled(false);
  updateStatus();
  elements.mirrorInput.value = appState.settings.mirrorTemplate || DEFAULT_MIRROR;

  elements.presetList.replaceChildren(
    ...appState.builtinPublications.map((publication) => createPresetItem(publication))
  );
}

function renderStartupError(message) {
  setControlsDisabled(true);
  elements.statusBadge.textContent = "Unavailable";
  elements.statusBadge.classList.remove("is-on");
  elements.statusCopy.textContent = "The popup could not load extension state.";
  elements.presetList.replaceChildren();
  setFeedback(message, "error");
}

async function refreshState() {
  const state = await browser.runtime.sendMessage({ type: "get-state" });
  appState = state;
  render();
}

async function saveSettings(payload) {
  const response = await browser.runtime.sendMessage({ type: "save-settings", payload });
  if (!response?.ok) {
    throw new Error("Failed to save settings.");
  }
  await refreshState();
}

elements.toggleButton.addEventListener("click", async () => {
  try {
    await saveSettings({ enabled: !appState.settings.enabled });
    setFeedback(appState.settings.enabled ? "Redirect is enabled." : "Redirect is disabled.", "success");
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.saveMirrorButton.addEventListener("click", async () => {
  try {
    const mirrorTemplate = normalizeMirrorTemplate(elements.mirrorInput.value);
    await saveSettings({ mirrorTemplate });
    setFeedback("Mirror setting updated.", "success");
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

refreshState().catch((error) => {
  renderStartupError(error.message);
});