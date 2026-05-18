"use strict";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const DEFAULT_MIRROR = "https://freedium-mirror.cfd/";

const elements = {
  statusBadge: document.getElementById("status-badge"),
  statusCopy: document.getElementById("status-copy"),
  toggleButton: document.getElementById("toggle-button"),
  mirrorInput: document.getElementById("mirror-url"),
  saveMirrorButton: document.getElementById("save-mirror-button"),
  presetList: document.getElementById("preset-list"),
  customDomainInput: document.getElementById("custom-domain-input"),
  addDomainButton: document.getElementById("add-domain-button"),
  customDomainList: document.getElementById("custom-domain-list"),
  feedback: document.getElementById("feedback")
};

let appState = {
  settings: null,
  builtinPublications: [],
  grantedOrigins: []
};

function setFeedback(message, kind = "") {
  elements.feedback.textContent = message || "";
  elements.feedback.className = "feedback";
  if (kind) {
    elements.feedback.classList.add(`is-${kind}`);
  }
}

function canonicalHost(value) {
  return String(value || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function normalizeDomainEntry(value) {
  const input = canonicalHost(value);
  if (!input || input.includes("*") || input.includes("/") || input.includes(":")) {
    throw new Error("Enter an exact hostname without path, port, or wildcard.");
  }
  const hostname = new URL(`https://${input}/`).hostname.toLowerCase();
  if (!hostname.includes(".")) {
    throw new Error("Hostname must include a dot.");
  }
  return hostname;
}

function normalizeMirrorBaseUrl(value) {
  const url = new URL(String(value || "").trim() || DEFAULT_MIRROR);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Mirror URL must use http or https.");
  }
  url.hash = "";
  return url.toString();
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

function createCustomDomainItem(hostname) {
  const item = document.createElement("article");
  item.className = "domain-item";

  const main = document.createElement("div");
  main.className = "domain-main";

  const label = document.createElement("div");
  label.className = "domain-label";
  label.textContent = hostname;

  const meta = document.createElement("div");
  meta.className = "domain-meta";
  meta.textContent = originGranted(hostname) ? "Permission granted" : "Missing permission";

  main.append(label, meta);

  const button = document.createElement("button");
  button.className = "remove-button";
  button.type = "button";
  button.textContent = "Remove";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const nextDomains = (appState.settings.customDomains || []).filter((domain) => domain !== hostname);
      await saveSettings({ customDomains: nextDomains });
        if ((appState.grantedOrigins || []).includes(toOriginPattern(hostname))) {
          await browser.permissions.remove({ origins: [toOriginPattern(hostname)] });
      }
      setFeedback(`Removed ${hostname}.`, "success");
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

  updateStatus();
  elements.mirrorInput.value = appState.settings.mirrorBaseUrl || DEFAULT_MIRROR;

  elements.presetList.replaceChildren(
    ...appState.builtinPublications.map((publication) => createPresetItem(publication))
  );

  const customDomains = appState.settings.customDomains || [];
  if (!customDomains.length) {
    const empty = document.createElement("p");
    empty.className = "domain-meta";
    empty.textContent = "No custom domains yet.";
    elements.customDomainList.replaceChildren(empty);
  } else {
    elements.customDomainList.replaceChildren(
      ...customDomains.map((hostname) => createCustomDomainItem(hostname))
    );
  }
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
    const mirrorBaseUrl = normalizeMirrorBaseUrl(elements.mirrorInput.value);
    await saveSettings({ mirrorBaseUrl });
    setFeedback("Mirror URL updated.", "success");
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

elements.addDomainButton.addEventListener("click", async () => {
  try {
    const hostname = normalizeDomainEntry(elements.customDomainInput.value);
    const allDomains = new Set([
      ...(appState.settings.customDomains || []),
      ...(appState.settings.enabledPresetDomains || []),
      "medium.com"
    ]);
    if (allDomains.has(hostname)) {
      throw new Error("That domain is already enabled or built in.");
    }

    if (!originGranted(hostname)) {
      const allowed = await browser.permissions.request({
        origins: [toOriginPattern(hostname)]
      });
      if (!allowed) {
        throw new Error(`Permission denied for ${hostname}.`);
      }
    }

    const customDomains = Array.from(new Set([...(appState.settings.customDomains || []), hostname])).sort();
    await saveSettings({ customDomains });
    elements.customDomainInput.value = "";
    setFeedback(`Added ${hostname}.`, "success");
  } catch (error) {
    setFeedback(error.message, "error");
  }
});

refreshState().catch((error) => {
  setFeedback(error.message, "error");
});