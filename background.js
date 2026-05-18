"use strict";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const STORAGE_KEY = "settings";
const RULE_ID_BASE = 1000;
const DEFAULT_MIRROR = "https://freedium-mirror.cfd/";
const DEFAULT_SETTINGS = {
  enabled: true,
  mirrorBaseUrl: DEFAULT_MIRROR,
  customDomains: [],
  enabledPresetDomains: [],
};

const BUILTIN_PUBLICATIONS = [
  { id: "towards-data-science", host: "towardsdatascience.com", label: "Towards Data Science" },
  { id: "better-programming", host: "betterprogramming.pub", label: "Better Programming" },
  { id: "the-startup", host: "thestartup.medium.com", label: "The Startup" },
  { id: "ux-collective", host: "uxdesign.cc", label: "UX Collective" },
  { id: "level-up", host: "levelup.gitconnected.com", label: "Level Up Coding" },
  { id: "marker", host: "marker.medium.com", label: "Marker" },
  { id: "onezero", host: "onezero.medium.com", label: "OneZero" },
  { id: "human-parts", host: "humanparts.medium.com", label: "Human Parts" },
  { id: "forge", host: "forge.medium.com", label: "Forge" },
  { id: "zora", host: "zora.medium.com", label: "ZORA" }
];

const MEDIUM_HOST_REGEX = "(?:[a-z0-9-]+\\.)*medium\\.com";
const ARTICLE_ID_REGEX = "(?:[^?#]*?)([0-9a-f]{12})(?:\\?.*)?$";

function canonicalHost(hostname) {
  return String(hostname || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function normalizeMirrorBaseUrl(value) {
  const input = String(value || "").trim();
  const url = new URL(input || DEFAULT_MIRROR);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Mirror URL must use http or https.");
  }
  url.hash = "";
  return url.toString();
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

function isHostCoveredByOrigins(hostname, origins) {
  const probe = `https://${hostname}/`;
  return origins.some((origin) => originPatternToRegex(origin).test(probe));
}

function getBuiltinPublicationHosts() {
  return BUILTIN_PUBLICATIONS.map((entry) => entry.host);
}

async function getStoredSettings() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[STORAGE_KEY] || {}),
  };
}

async function saveSettings(settings) {
  const sanitized = {
    enabled: Boolean(settings.enabled),
    mirrorBaseUrl: normalizeMirrorBaseUrl(settings.mirrorBaseUrl),
    customDomains: Array.from(new Set((settings.customDomains || []).map(normalizeDomainEntry))).sort(),
    enabledPresetDomains: Array.from(new Set((settings.enabledPresetDomains || []).map(normalizeDomainEntry))).sort(),
  };
  await browser.storage.local.set({ [STORAGE_KEY]: sanitized });
  return sanitized;
}

function buildRedirectBaseUrl(mirrorBaseUrl) {
  const mirrorUrl = new URL(normalizeMirrorBaseUrl(mirrorBaseUrl));
  mirrorUrl.search = "";
  mirrorUrl.hash = "";
  return mirrorUrl.toString();
}

function buildRuleForHostRegex(hostRegex, ruleId, mirrorBaseUrl) {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        regexSubstitution: `${buildRedirectBaseUrl(mirrorBaseUrl)}\\1`
      }
    },
    condition: {
      regexFilter: `^https?://${hostRegex}/${ARTICLE_ID_REGEX}`,
      resourceTypes: ["main_frame"]
    }
  };
}

function buildRuleForExactHost(hostname, ruleId, mirrorBaseUrl) {
  return buildRuleForHostRegex(escapeRegex(hostname), ruleId, mirrorBaseUrl);
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
    addRules.push(buildRuleForHostRegex(MEDIUM_HOST_REGEX, RULE_ID_BASE, settings.mirrorBaseUrl));
    hosts
      .filter((host) => host !== "medium.com" && !host.endsWith(".medium.com"))
      .forEach((host, index) => {
        addRules.push(buildRuleForExactHost(host, RULE_ID_BASE + 1 + index, settings.mirrorBaseUrl));
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