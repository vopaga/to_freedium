"use strict";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const STORAGE_KEY = "settings";
const RULE_ID_BASE = 1000;
const DEFAULT_MIRROR = "https://freedium-mirror.cfd/";
const DEFAULT_SETTINGS = {
  enabled: true,
  mirrorTemplate: DEFAULT_MIRROR,
  customDomains: [],
  enabledPresetDomains: [],
};

const BUILTIN_PUBLICATIONS = [
  { id: "towards-data-science", host: "towardsdatascience.com", label: "Towards Data Science" },
  { id: "better-programming", host: "betterprogramming.pub", label: "Better Programming" },
  { id: "ux-collective", host: "uxdesign.cc", label: "UX Collective" },
  { id: "level-up", host: "levelup.gitconnected.com", label: "Level Up Coding" },
  { id: "better-humans", host: "betterhumans.pub", label: "Better Humans" }
];

const MEDIUM_HOST_REGEX = "(?:[a-z0-9-]+\\.)*medium\\.com";
const ARTICLE_PATH_REGEX = "([^?#]*?)([0-9a-f]{12})(?:[?#].*)?$";

function canonicalHost(hostname) {
  return String(hostname || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function normalizeMirrorTemplate(value) {
  const input = String(value || "").trim();
  const candidate = input || DEFAULT_MIRROR;
  const probe = candidate
    .replaceAll("{id}", "example-id")
    .replaceAll("{url}", "https%3A%2F%2Fmedium.com%2Fexample-id");
  const url = new URL(probe);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Mirror URL must use http or https.");
  }
  if (candidate.includes("{") || candidate.includes("}")) {
    const invalidToken = candidate.match(/\{(?!id\}|url\})[^}]*\}/);
    if (invalidToken) {
      throw new Error("Only {id} and {url} placeholders are supported.");
    }
  }
  return candidate;
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

function getBuiltinPublicationHosts() {
  return BUILTIN_PUBLICATIONS.map((entry) => entry.host);
}

function getOptionalPublicationHosts() {
  return getBuiltinPublicationHosts();
}

async function getStoredSettings() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[STORAGE_KEY] || {}),
  };
}

async function saveSettings(settings) {
  const allowedPresetHosts = new Set(getBuiltinPublicationHosts());
  const sanitized = {
    enabled: Boolean(settings.enabled),
    mirrorTemplate: normalizeMirrorTemplate(settings.mirrorTemplate || settings.mirrorBaseUrl),
    customDomains: Array.from(new Set((settings.customDomains || []).map(normalizeDomainEntry))).sort(),
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

function computeManagedHosts(settings) {
  const hosts = new Set(["medium.com", ...getBuiltinPublicationHosts().filter((host) => settings.enabledPresetDomains.includes(host))]);
  for (const customDomain of settings.customDomains) {
    hosts.add(customDomain);
  }
  return Array.from(hosts).sort();
}

async function syncDynamicRules(settingsInput) {
  const settings = settingsInput || await getStoredSettings();
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);
  const addRules = [];

  if (settings.enabled) {
    const hosts = computeManagedHosts(settings);
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

  const nextCustomDomains = settings.customDomains.filter((hostname) => !shouldRemoveDomain(hostname));
  const nextPresetDomains = settings.enabledPresetDomains.filter((hostname) => {
    if (!getOptionalPublicationHosts().includes(hostname)) {
      return true;
    }
    return !shouldRemoveDomain(hostname);
  });

  if (
    nextCustomDomains.length === settings.customDomains.length &&
    nextPresetDomains.length === settings.enabledPresetDomains.length
  ) {
    return;
  }

  await saveSettings({
    ...settings,
    customDomains: nextCustomDomains,
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
      const grantedPermissions = await browser.permissions.getAll();
      return {
        settings,
        builtinPublications: BUILTIN_PUBLICATIONS,
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