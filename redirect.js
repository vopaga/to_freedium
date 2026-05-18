"use strict";

if (typeof browser === "undefined") {
    globalThis.browser = chrome;
}

const elements = {
    title: document.getElementById("title"),
    message: document.getElementById("message"),
    error: document.getElementById("error"),
    fallback: document.getElementById("fallback"),
    originalLink: document.getElementById("original-link")
};

function showFailure(message, originalUrl) {
    elements.title.textContent = "Redirect failed";
    elements.message.textContent = "The extension could not build a valid mirror redirect for this page.";
    elements.error.textContent = message;
    elements.error.classList.remove("hidden");
    if (originalUrl) {
        elements.originalLink.href = originalUrl;
        elements.originalLink.rel = "noreferrer noopener";
        elements.fallback.classList.remove("hidden");
    }
}

async function resolveRedirectRequest() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return browser.runtime.sendMessage({
        type: "resolve-redirect-bridge",
        payload: {
            token: params.get("token") || "",
            scheme: params.get("scheme") || "",
            host: params.get("host") || "",
            prefix: params.get("prefix") || "",
            id: params.get("id") || "",
        }
    });
}

async function redirect() {
    const response = await resolveRedirectRequest();
    if (!response?.ok) {
        showFailure(response?.message || "The redirect request is no longer valid.", response?.originalUrl || "");
        return;
    }

    window.location.replace(response.destination);
}

redirect().catch((error) => {
    console.error("Redirect bridge failed", error);
    showFailure(error.message);
});
