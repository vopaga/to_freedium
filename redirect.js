"use strict";

if (typeof browser === "undefined") {
  globalThis.browser = chrome;
}

const STORAGE_KEY = "settings";
const { DEFAULT_MIRROR, normalizeMirrorTemplate } = globalThis.toFreediumMirror;

const elements = {
  title: document.getElementById("title"),
  message: document.getElementById("message"),
  error: document.getElementById("error"),
  fallback: document.getElementById("fallback"),
  originalLink: document.getElementById("original-link")
};

function fillTemplate(template, values) {
  return template
    .replaceAll("{id}", values.id)
    .replaceAll("{url}", encodeURIComponent(values.url));
}

async function getMirrorTemplate() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const settings = stored[STORAGE_KEY] || {};
  return normalizeMirrorTemplate(settings.mirrorTemplate || DEFAULT_MIRROR);
}

function showFailure(message, originalUrl) {
  elements.title.textContent = "Redirect failed";
  elements.message.textContent = "The extension could not build a valid mirror redirect for this page.";
  elements.error.textContent = message;
  elements.error.classList.remove("hidden");
  if (originalUrl) {
    elements.originalLink.href = originalUrl;
    elements.fallback.classList.remove("hidden");
  }
}

async function redirect() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const scheme = params.get("scheme") || "https";
  const host = params.get("host") || "medium.com";
  const prefix = params.get("prefix") || "";
  const id = params.get("id") || "";

  const originalUrl = `${scheme}://${host}/${prefix}${id}`;

  if (!id) {
    showFailure("The article identifier could not be extracted from the URL.", originalUrl);
    return;
  }

  const mirrorTemplate = await getMirrorTemplate();
  const destination = mirrorTemplate.includes("{id}") || mirrorTemplate.includes("{url}")
    ? fillTemplate(mirrorTemplate, { id, url: originalUrl })
    : `${mirrorTemplate}${id}`;

  window.location.replace(destination);
}

redirect().catch((error) => {
  console.error("Redirect bridge failed", error);
  const params = new URLSearchParams(window.location.hash.slice(1));
  const scheme = params.get("scheme") || "https";
  const host = params.get("host") || "medium.com";
  const prefix = params.get("prefix") || "";
  const id = params.get("id") || "";
  const originalUrl = id ? `${scheme}://${host}/${prefix}${id}` : null;
  showFailure(error.message, originalUrl);
});