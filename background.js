"use strict";

if (typeof browser === "undefined") {
    globalThis.browser = chrome;
}

const STORAGE_KEY = "settings";
const BRIDGE_TOKEN_KEY = "bridgeToken";
const RULE_ID_BASE = 1000;
const {
    DEFAULT_MIRROR,
    buildCanonicalArticleUrl,
    buildMirrorUrl,
    canonicalHost,
    hostMatchesManagedSource,
    normalizeMirrorTemplate,
} = globalThis.toFreediumMirror;
const PUBLICATIONS_PATH = "data/publications.json";
const EXTENSION_BASE_URL = browser.runtime.getURL("");
const MENU_IDS = {
    openLink: "open-link-through-mirror",
    openPage: "open-page-through-mirror",
};
const FALLBACK_PUBLICATIONS = [
    { id: "towards-data-science", host: "towardsdatascience.com", label: "Towards Data Science" },
    { id: "better-programming", host: "betterprogramming.pub", label: "Better Programming" },
    { id: "ux-collective", host: "uxdesign.cc", label: "UX Collective" },
    { id: "level-up", host: "levelup.gitconnected.com", label: "Level Up Coding" },
    { id: "better-humans", host: "betterhumans.pub", label: "Better Humans" }
];
const DEFAULT_SETTINGS = {
    enabled: true,
    mirrorTemplate: DEFAULT_MIRROR,
    enabledPresetDomains: [],
};

const BRIDGE_TOKEN_REGEX = /^[0-9a-f]{32}$/;
const MEDIUM_HOST_REGEX = "(?:[a-z0-9-]+\\.)*medium\\.com";
const ARTICLE_PATH_REGEX = "([^?#]*?)([0-9a-f]{12})(?:[?#].*)?$";
let builtinPublicationsPromise;
let dynamicRuleSyncChain = Promise.resolve();

function createBridgeToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function getBridgeToken() {
    const stored = await browser.storage.local.get(BRIDGE_TOKEN_KEY);
    const token = String(stored[BRIDGE_TOKEN_KEY] || "").trim().toLowerCase();
    if (BRIDGE_TOKEN_REGEX.test(token)) {
        return token;
    }

    const nextToken = createBridgeToken();
    await browser.storage.local.set({ [BRIDGE_TOKEN_KEY]: nextToken });
    return nextToken;
}

function normalizeDomainEntry(value) {
    const input = canonicalHost(value);
    if (!input) {
        throw new Error("Domain cannot be empty.");
    }
    if (input.includes("*") || input.includes("/") || input.includes(":")) {
        throw new Error("Use a plain hostname without wildcards, path, or port.");
    }
    const testUrl = new URL(`https://${input}/`);
    const hostname = canonicalHost(testUrl.hostname);
    if (!hostname.includes(".")) {
        throw new Error("Domain must contain a dot.");
    }
    return hostname;
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

function validatePublicationEntry(entry) {
    if (!entry || typeof entry !== "object") {
        throw new Error("Publication entry must be an object.");
    }
    return {
        id: String(entry.id || "").trim(),
        host: normalizeDomainEntry(entry.host),
        label: String(entry.label || "").trim(),
    };
}

async function getBuiltinPublications() {
    if (!builtinPublicationsPromise) {
        builtinPublicationsPromise = fetch(browser.runtime.getURL(PUBLICATIONS_PATH))
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load ${PUBLICATIONS_PATH}.`);
                }
                const data = await response.json();
                if (!Array.isArray(data)) {
                    throw new Error("Publication data must be an array.");
                }
                return data.map(validatePublicationEntry);
            })
            .catch((error) => {
                console.warn("Failed to load publication data. Using built-in fallback list.", error);
                return FALLBACK_PUBLICATIONS.map(validatePublicationEntry);
            });
    }
    return builtinPublicationsPromise;
}

async function getGrantedOrigins() {
    if (!browser.permissions?.getAll) {
        return [];
    }
    try {
        const grantedPermissions = await browser.permissions.getAll();
        return grantedPermissions.origins || [];
    } catch (error) {
        console.warn("Failed to read granted origins.", error);
        return [];
    }
}

async function getBuiltinPublicationHosts() {
    const publications = await getBuiltinPublications();
    return publications.map((entry) => entry.host);
}

async function getManagedPublicationHosts() {
    return getBuiltinPublicationHosts();
}

async function getManagedMirrorHosts() {
    const publicationHosts = await getManagedPublicationHosts();
    return ["medium.com", ...publicationHosts];
}

async function getStoredSettings() {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const persisted = stored[STORAGE_KEY] || {};
    const blockedHosts = await getManagedMirrorHosts();
    let mirrorTemplate = DEFAULT_MIRROR;

    try {
        mirrorTemplate = normalizeMirrorTemplate(persisted.mirrorTemplate, { blockedHosts });
    } catch (error) {
        console.warn("Stored mirror template was invalid. Falling back to the default mirror.", error);
    }

    return {
        ...DEFAULT_SETTINGS,
        ...persisted,
        mirrorTemplate,
    };
}

async function saveSettings(settings) {
    const allowedPresetHosts = new Set(await getBuiltinPublicationHosts());
    const blockedHosts = await getManagedMirrorHosts();
    const sanitized = {
        enabled: Boolean(settings.enabled),
        mirrorTemplate: normalizeMirrorTemplate(settings.mirrorTemplate, { blockedHosts }),
        enabledPresetDomains: Array.from(new Set((settings.enabledPresetDomains || []).map(normalizeDomainEntry)))
            .filter((hostname) => allowedPresetHosts.has(hostname))
            .sort(),
    };
    await browser.storage.local.set({ [STORAGE_KEY]: sanitized });
    return sanitized;
}

function buildRedirectBridgeBase() {
    return browser.runtime.getURL("redirect.html");
}

function buildRuleRedirectTarget(mirrorTemplate, bridgeToken) {
    if (mirrorTemplate.includes("{url}")) {
        return `${buildRedirectBridgeBase()}#token=${bridgeToken}&scheme=\\1&host=\\2&prefix=\\3&id=\\4`;
    }
    if (mirrorTemplate.includes("{id}")) {
        return mirrorTemplate.replaceAll("{id}", "\\4");
    }
    return `${mirrorTemplate}\\4`;
}

function buildRuleForHostRegex(hostRegex, ruleId, mirrorTemplate, bridgeToken) {
    const redirectTarget = buildRuleRedirectTarget(mirrorTemplate, bridgeToken);
    return {
        id: ruleId,
        priority: 1,
        action: {
            type: "redirect",
            redirect: {
                regexSubstitution: redirectTarget
            }
        },
        condition: {
            regexFilter: `^(https?)://(${hostRegex})/${ARTICLE_PATH_REGEX}`,
            resourceTypes: ["main_frame"]
        }
    };
}

function buildRuleForExactHost(hostname, ruleId, mirrorTemplate, bridgeToken) {
    return buildRuleForHostRegex(escapeRegex(hostname), ruleId, mirrorTemplate, bridgeToken);
}

function getMenusApi() {
    return browser.menus || browser.contextMenus || null;
}

async function computeManagedHosts(settings) {
    const publicationHosts = await getBuiltinPublicationHosts();
    const hosts = new Set(["medium.com", ...publicationHosts.filter((host) => settings.enabledPresetDomains.includes(host))]);
    return Array.from(hosts).sort();
}

function hostAllowedForAutomaticRedirect(hostname, managedHosts) {
    return managedHosts.some((managedHost) => {
        if (managedHost === "medium.com") {
            return hostMatchesManagedSource(hostname, managedHost);
        }
        return hostname === managedHost;
    });
}

function isTrustedExtensionSender(sender) {
    if (!sender) {
        return false;
    }
    if (sender.id && sender.id !== browser.runtime.id) {
        return false;
    }
    if (!sender.url) {
        return true;
    }
    return sender.url.startsWith(EXTENSION_BASE_URL);
}

async function resolveRedirectBridge(payload) {
    const requestedToken = String(payload?.token || "").trim().toLowerCase();
    const currentToken = await getBridgeToken();

    if (!BRIDGE_TOKEN_REGEX.test(requestedToken) || requestedToken !== currentToken) {
        return {
            ok: false,
            message: "This redirect request is no longer valid.",
        };
    }

    let originalUrl;
    try {
        originalUrl = buildCanonicalArticleUrl({
            scheme: payload?.scheme,
            host: payload?.host,
            prefix: payload?.prefix,
            id: payload?.id,
        });
    } catch (error) {
        return {
            ok: false,
            message: error.message,
        };
    }

    const articleHost = canonicalHost(new URL(originalUrl).hostname);
    const settings = await getStoredSettings();
    const redirectableHosts = await computeManagedHosts(settings);

    if (!hostAllowedForAutomaticRedirect(articleHost, redirectableHosts)) {
        return {
            ok: false,
            message: "This redirect request is not allowed for the current domain.",
        };
    }

    if (!settings.enabled) {
        return {
            ok: false,
            message: "Automatic redirect is currently disabled.",
            originalUrl,
        };
    }

    try {
        const blockedHosts = await getManagedMirrorHosts();
        const destination = buildMirrorUrl(originalUrl, settings.mirrorTemplate, { blockedHosts });
        return {
            ok: true,
            destination,
            originalUrl,
        };
    } catch (error) {
        return {
            ok: false,
            message: error.message,
            originalUrl,
        };
    }
}

async function applyDynamicRules(settingsInput) {
    const settings = settingsInput || await getStoredSettings();
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map((rule) => rule.id);
    const addRules = [];

    if (settings.enabled) {
        const hosts = await computeManagedHosts(settings);
        const bridgeToken = settings.mirrorTemplate.includes("{url}") ? await getBridgeToken() : undefined;
        addRules.push(buildRuleForHostRegex(MEDIUM_HOST_REGEX, RULE_ID_BASE, settings.mirrorTemplate, bridgeToken));
        hosts
            .filter((host) => host !== "medium.com")
            .forEach((host, index) => {
                addRules.push(buildRuleForExactHost(host, RULE_ID_BASE + 1 + index, settings.mirrorTemplate, bridgeToken));
            });
    }

    await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules,
    });
}

function syncDynamicRules(settingsInput) {
    dynamicRuleSyncChain = dynamicRuleSyncChain
        .catch(() => undefined)
        .then(() => applyDynamicRules(settingsInput));
    return dynamicRuleSyncChain;
}

async function ensureDefaults() {
    const settings = await getStoredSettings();
    const saved = await saveSettings(settings);
    await syncDynamicRules(saved);
    return saved;
}

async function pruneDomainsWithoutPermission(removedOrigins) {
    if (!removedOrigins?.length) {
        return;
    }

    const settings = await getStoredSettings();
    const shouldRemoveDomain = (hostname) => removedOrigins.includes(toOriginPattern(hostname));
    const manageablePublicationHosts = await getManagedPublicationHosts();

    const nextPresetDomains = settings.enabledPresetDomains.filter((hostname) => {
        if (!manageablePublicationHosts.includes(hostname)) {
            return true;
        }
        return !shouldRemoveDomain(hostname);
    });

    if (
        nextPresetDomains.length === settings.enabledPresetDomains.length
    ) {
        return;
    }

    const nextSettings = await saveSettings({
        ...settings,
        enabledPresetDomains: nextPresetDomains,
    });
    await syncDynamicRules(nextSettings);
}

async function openUrlThroughMirror(sourceUrl, options = {}) {
    const settings = await getStoredSettings();
    const blockedHosts = await getManagedMirrorHosts();
    const destination = buildMirrorUrl(sourceUrl, settings.mirrorTemplate, { blockedHosts });
    let targetTabId;

    if (options.openInNewTab || !Number.isInteger(options.tabId)) {
        const createdTab = await browser.tabs.create({ url: destination, active: true });
        targetTabId = createdTab?.id;
    } else {
        const updatedTab = await browser.tabs.update(options.tabId, { active: true, url: destination });
        targetTabId = updatedTab?.id;
    }

    if (Number.isInteger(options.closeTabId) && options.closeTabId !== targetTabId) {
        try {
            await browser.tabs.remove(options.closeTabId);
        } catch (error) {
            console.warn("Failed to close popup tab after manual open.", error);
        }
    }

    return destination;
}

async function rebuildMenus() {
    const menusApi = getMenusApi();
    if (!menusApi?.create || !menusApi?.removeAll) {
        return;
    }

    try {
        await menusApi.removeAll();
        menusApi.create({
            id: MENU_IDS.openLink,
            title: "Open link through mirror",
            contexts: ["link"],
        });
        menusApi.create({
            id: MENU_IDS.openPage,
            title: "Open page through mirror",
            contexts: ["page"],
        });
    } catch (error) {
        console.warn("Failed to rebuild menus.", error);
    }
}

function handleMenuClick(info, tab) {
    if (!info || !Object.values(MENU_IDS).includes(info.menuItemId)) {
        return;
    }

    const sourceUrl = info.menuItemId === MENU_IDS.openLink ? info.linkUrl : (info.pageUrl || tab?.url);
    if (!sourceUrl) {
        return;
    }

    const options = info.menuItemId === MENU_IDS.openLink
        ? { openInNewTab: true }
        : { tabId: tab?.id };

    openUrlThroughMirror(sourceUrl, options).catch((error) => {
        console.error("Failed to open URL through mirror.", error);
    });
}

const menusApi = getMenusApi();
if (menusApi?.onClicked?.addListener) {
    menusApi.onClicked.addListener(handleMenuClick);
}

rebuildMenus().catch((error) => {
    console.warn("Failed to initialize menus.", error);
});

browser.runtime.onInstalled.addListener(() => {
    ensureDefaults().catch((error) => {
        console.error("Failed to initialize extension", error);
    });
    rebuildMenus().catch((error) => {
        console.warn("Failed to rebuild menus after install.", error);
    });
});

browser.runtime.onStartup.addListener(() => {
    ensureDefaults().catch((error) => {
        console.error("Failed to restore extension state", error);
    });
    rebuildMenus().catch((error) => {
        console.warn("Failed to rebuild menus on startup.", error);
    });
});

if (browser.permissions?.onRemoved?.addListener) {
    browser.permissions.onRemoved.addListener((permissions) => {
        pruneDomainsWithoutPermission(permissions.origins || []).catch((error) => {
            console.error("Failed to prune revoked domains", error);
        });
    });
}

browser.runtime.onMessage.addListener((message, sender) => {
    if (!message || typeof message !== "object") {
        return undefined;
    }
    if (!isTrustedExtensionSender(sender)) {
        return undefined;
    }

    if (message.type === "get-state") {
        return (async () => {
            const settings = await getStoredSettings();
            const builtinPublications = await getBuiltinPublications();
            return {
                settings,
                builtinPublications,
                grantedOrigins: await getGrantedOrigins(),
                managedMirrorHosts: await getManagedMirrorHosts(),
            };
        })();
    }

    if (message.type === "save-settings") {
        return (async () => {
            const current = await getStoredSettings();
            const next = await saveSettings({ ...current, ...message.payload });
            await syncDynamicRules(next);
            return { ok: true, settings: next };
        })();
    }

    if (message.type === "open-url-through-mirror") {
        return (async () => {
            const destination = await openUrlThroughMirror(message.sourceUrl, {
                closeTabId: Number.isInteger(message.closeTabId) ? message.closeTabId : undefined,
                openInNewTab: Boolean(message.openInNewTab),
                tabId: Number.isInteger(message.currentTabId) ? message.currentTabId : undefined,
            });
            return { ok: true, destination };
        })();
    }

    if (message.type === "resolve-redirect-bridge") {
        return resolveRedirectBridge(message.payload);
    }

    return undefined;
});
