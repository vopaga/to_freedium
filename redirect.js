"use strict";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const STORAGE_KEY = "settings";
const DEFAULT_MIRROR = "https://freedium-mirror.cfd/";

function fillTemplate(template, values) {
  return template
    .replaceAll("{id}", values.id)
    .replaceAll("{url}", encodeURIComponent(values.url));
}

function normalizeMirrorTemplate(value) {
  const input = String(value || "").trim() || DEFAULT_MIRROR;
  const probe = input
    .replaceAll("{id}", "example-id")
    .replaceAll("{url}", "https%3A%2F%2Fmedium.com%2Fexample-id");
  const url = new URL(probe);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Invalid mirror template protocol.");
  }
  return input;
}

async function getMirrorTemplate() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const settings = stored[STORAGE_KEY] || {};
  return normalizeMirrorTemplate(settings.mirrorTemplate || settings.mirrorBaseUrl || DEFAULT_MIRROR);
}

async function redirect() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const scheme = params.get("scheme") || "https";
  const host = params.get("host") || "medium.com";
  const prefix = params.get("prefix") || "";
  const id = params.get("id") || "";

  if (!id) {
    return;
  }

  const originalUrl = `${scheme}://${host}/${prefix}${id}`;
  const mirrorTemplate = await getMirrorTemplate();
  const destination = mirrorTemplate.includes("{id}") || mirrorTemplate.includes("{url}")
    ? fillTemplate(mirrorTemplate, { id, url: originalUrl })
    : `${mirrorTemplate}${id}`;

  window.location.replace(destination);
}

redirect().catch((error) => {
  console.error("Redirect bridge failed", error);
});