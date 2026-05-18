"use strict";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

importScripts("mirror-template.js");

const STORAGE_KEY = "settings";
const RULE_ID_BASE = 1000;
const { DEFAULT_MIRROR, canonicalHost, normalizeMirrorTemplate } = globalThis.toFreediumMirror;
const PUBLICATIONS_PATH = "data/publications.json";
const DEFAULT_SETTINGS = {
  enabled: true,
  mirrorTemplate: DEFAULT_MIRROR,
  enabledPresetDomains: [],
};

const MEDIUM_HOST_REGEX = "(?:[a-z0-9-]+\\.)*medium\\.com";
const ARTICLE_PATH_REGEX = "([^?#]*?)([0-9a-f]{12})(?:[?#].*)?$";
let builtinPublicationsPromise;

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
      });
  }
  return builtinPublicationsPromise;
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

function buildRuleForHostRegex(hostRegex, ruleId) {
  const redirectTarget = `${buildRedirectBridgeBase()}#scheme=\\1&host=\\2&prefix=\\3&id=\\4`;
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

function buildRuleForExactHost(hostname, ruleId) {
  return buildRuleForHostRegex(escapeRegex(hostname), ruleId);
}

async function computeManagedHosts(settings) {
  const publicationHosts = await getBuiltinPublicationHosts();
  const hosts = new Set(["medium.com", ...publicationHosts.filter((host) => settings.enabledPresetDomains.includes(host))]);
  return Array.from(hosts).sort();
}

async function syncDynamicRules(settingsInput) {
  const settings = settingsInput || await getStoredSettings();
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);
  const addRules = [];

  if (settings.enabled) {
    const hosts = await computeManagedHosts(settings);
    addRules.push(buildRuleForHostRegex(MEDIUM_HOST_REGEX, RULE_ID_BASE));
    hosts
      .filter((host) => host !== "medium.com")
      .forEach((host, index) => {
        addRules.push(buildRuleForExactHost(host, RULE_ID_BASE + 1 + index));
      });
  }

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
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

  await saveSettings({
    ...settings,
    enabledPresetDomains: nextPresetDomains,
  });
}

browser.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((error) => {
    console.error("Failed to initialize extension", error);
  });
});

browser.runtime.onStartup.addListener(() => {
  ensureDefaults().catch((error) => {
    console.error("Failed to restore extension state", error);
  });
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEY]) {
    return;
  }
  syncDynamicRules(changes[STORAGE_KEY].newValue).catch((error) => {
    console.error("Failed to update rules after storage change", error);
  });
});

browser.permissions.onRemoved.addListener((permissions) => {
  pruneDomainsWithoutPermission(permissions.origins || []).catch((error) => {
    console.error("Failed to prune revoked domains", error);
  });
});

browser.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  if (message.type === "get-state") {
    return (async () => {
      const settings = await getStoredSettings();
      const builtinPublications = await getBuiltinPublications();
      const grantedPermissions = await browser.permissions.getAll();
      return {
        settings,
        builtinPublications,
        grantedOrigins: grantedPermissions.origins || []
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

  return undefined;
});

ensureDefaults().catch((error) => {
  console.error("Failed to bootstrap extension", error);
});