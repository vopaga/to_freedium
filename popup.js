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
    resetMirrorButton: document.getElementById("reset-mirror-button"),
    articleUrlInput: document.getElementById("article-url"),
    openCurrentButton: document.getElementById("open-current-button"),
    openUrlButton: document.getElementById("open-url-button"),
    presetList: document.getElementById("preset-list"),
    feedback: document.getElementById("feedback")
};

let appState = {
    settings: null,
    builtinPublications: [],
    grantedOrigins: []
};

const EXTENSION_BASE_URL = browser.runtime.getURL("");

function getManagedMirrorHosts() {
    return ["medium.com", ...(appState.builtinPublications || []).map((publication) => publication.host)];
}

function setControlsDisabled(disabled) {
    elements.toggleButton.disabled = disabled;
    elements.mirrorInput.disabled = disabled;
    elements.saveMirrorButton.disabled = disabled;
    elements.resetMirrorButton.disabled = disabled;
    elements.articleUrlInput.disabled = disabled;
    elements.openCurrentButton.disabled = disabled;
    elements.openUrlButton.disabled = disabled;
}

function setFeedback(message, kind = "") {
    elements.feedback.textContent = message || "";
    elements.feedback.className = "feedback";
    if (kind) {
        elements.feedback.classList.add(`is-${kind}`);
    }
}

function closePopupSoon() {
    window.setTimeout(() => {
        try {
            window.close();
        } catch {
            // Ignore platforms that refuse to close the popup view.
        }
    }, 30);
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
                if (!browser.permissions?.request) {
                    throw new Error("Runtime host permission requests are not available in this Firefox build.");
                }
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

async function openUrlThroughMirror(sourceUrl, options = {}) {
    const response = await browser.runtime.sendMessage({
        type: "open-url-through-mirror",
        sourceUrl,
        closeTabId: options.closeTabId,
        currentTabId: options.currentTabId,
        openInNewTab: Boolean(options.openInNewTab)
    });
    if (!response?.ok) {
        throw new Error("Failed to open article through the mirror.");
    }
    return response;
}

function isExtensionUrl(url) {
    return String(url || "").startsWith(EXTENSION_BASE_URL);
}

async function getPopupTab() {
    if (!browser.tabs?.getCurrent) {
        return null;
    }

    try {
        const currentTab = await browser.tabs.getCurrent();
        return currentTab?.id ? currentTab : null;
    } catch {
        return null;
    }
}

async function getManualOpenContext() {
    const popupTab = await getPopupTab();
    if (popupTab?.id && isExtensionUrl(popupTab.url)) {
        if (Number.isInteger(popupTab.openerTabId)) {
            return {
                popupTabId: popupTab.id,
                sourceTabId: popupTab.openerTabId,
            };
        }

        const tabs = await browser.tabs.query({ currentWindow: true });
        const fallbackTab = tabs
            .filter((tab) => tab.id !== popupTab.id && !isExtensionUrl(tab.url))
            .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0))[0];

        if (fallbackTab?.id) {
            return {
                popupTabId: popupTab.id,
                sourceTabId: fallbackTab.id,
            };
        }

        return { popupTabId: popupTab.id };
    }

    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
        return {};
    }

    return {
        popupTabId: popupTab?.id,
        sourceTabId: activeTab.id,
    };
}

async function readTabUrl(tabId) {
    if (!Number.isInteger(tabId)) {
        throw new Error("No source tab is available.");
    }
    if (!browser.scripting?.executeScript) {
        throw new Error("Current-page opening is not available in this Firefox build.");
    }

    const result = await browser.scripting.executeScript({
        target: { tabId },
        func: () => window.location.href,
    });
    const sourceUrl = result?.[0]?.result;
    if (!sourceUrl) {
        throw new Error("Could not read the current page URL.");
    }
    if (isExtensionUrl(sourceUrl)) {
        throw new Error("The current page is the extension view, not the article tab.");
    }

    return sourceUrl;
}

async function getCurrentPageContext() {
    const context = await getManualOpenContext();
    const sourceUrl = await readTabUrl(context.sourceTabId);

    return {
        sourceUrl,
        popupTabId: context.popupTabId,
        tabId: context.sourceTabId,
        targetTabId: context.popupTabId || context.sourceTabId,
    };
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
        const mirrorTemplate = normalizeMirrorTemplate(elements.mirrorInput.value, {
            blockedHosts: getManagedMirrorHosts()
        });
        await saveSettings({ mirrorTemplate });
        setFeedback("Mirror setting updated.", "success");
    } catch (error) {
        setFeedback(error.message, "error");
    }
});

elements.resetMirrorButton.addEventListener("click", async () => {
    try {
        await saveSettings({ mirrorTemplate: DEFAULT_MIRROR });
        elements.mirrorInput.value = DEFAULT_MIRROR;
        setFeedback("Mirror reset to default.", "success");
    } catch (error) {
        setFeedback(error.message, "error");
    }
});

elements.openCurrentButton.addEventListener("click", async () => {
    try {
        const context = await getCurrentPageContext();
        await openUrlThroughMirror(context.sourceUrl, {
            currentTabId: context.targetTabId,
        });
        setFeedback("Opening current page through the mirror.", "success");
        closePopupSoon();
    } catch (error) {
        setFeedback(error.message, "error");
    }
});

elements.openUrlButton.addEventListener("click", async () => {
    try {
        const sourceUrl = String(elements.articleUrlInput.value || "").trim();
        if (!sourceUrl) {
            throw new Error("Paste a Medium-style article URL first.");
        }
        const context = await getManualOpenContext();
        await openUrlThroughMirror(sourceUrl, {
            openInNewTab: !context.popupTabId,
            currentTabId: context.popupTabId || context.sourceTabId,
        });
        setFeedback("Opening pasted URL through the mirror.", "success");
        closePopupSoon();
    } catch (error) {
        setFeedback(error.message, "error");
    }
});

refreshState().catch((error) => {
    renderStartupError(error.message);
});
