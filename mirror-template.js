"use strict";

(function bootstrapMirrorTemplate(globalScope) {
  const DEFAULT_MIRROR = "https://freedium-mirror.cfd/";

  function canonicalHost(value) {
    return String(value || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  }

  function hostMatchesManagedSource(hostname, managedHost) {
    return hostname === managedHost || hostname.endsWith(`.${managedHost}`);
  }

  function normalizeMirrorTemplate(value, options = {}) {
    const input = String(value || "").trim();
    const candidate = input || DEFAULT_MIRROR;
    const probe = candidate
      .replaceAll("{id}", "example-id")
      .replaceAll("{url}", "https%3A%2F%2Fmedium.com%2Fexample-id");
    const url = new URL(probe);
    const blockedHosts = (options.blockedHosts || []).map(canonicalHost).filter(Boolean);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("Mirror URL must use http or https.");
    }
    if (blockedHosts.some((managedHost) => hostMatchesManagedSource(canonicalHost(url.hostname), managedHost))) {
      throw new Error("Mirror URL cannot point to Medium or supported publication domains.");
    }
    if (candidate.includes("{") || candidate.includes("}")) {
      const invalidToken = candidate.match(/\{(?!id\}|url\})[^}]*\}/);
      if (invalidToken) {
        throw new Error("Only {id} and {url} placeholders are supported.");
      }
      return candidate;
    }
    return url.toString();
  }

  globalScope.toFreediumMirror = {
    DEFAULT_MIRROR,
    canonicalHost,
    normalizeMirrorTemplate,
  };
})(globalThis);
