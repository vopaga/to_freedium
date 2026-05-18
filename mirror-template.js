"use strict";

(function bootstrapMirrorTemplate(globalScope) {
    const DEFAULT_MIRROR = "https://freedium-mirror.cfd/";
    const ARTICLE_ID_REGEX = /^([^?#]*?)([0-9a-f]{12})(?:[?#].*)?$/i;

    function canonicalHost(value) {
        return String(value || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
    }

    function hostMatchesManagedSource(hostname, managedHost) {
        return hostname === managedHost || hostname.endsWith(`.${managedHost}`);
    }

    function extractArticleInfo(value) {
        const input = String(value || "").trim();
        if (!input) {
            throw new Error("Article URL cannot be empty.");
        }

        const url = new URL(input);
        if (!["https:", "http:"].includes(url.protocol)) {
            throw new Error("Only http and https article URLs are supported.");
        }

        const articlePath = `${url.pathname.replace(/^\//, "")}${url.search}${url.hash}`;
        const match = articlePath.match(ARTICLE_ID_REGEX);
        if (!match) {
            throw new Error("URL does not look like a Medium-style article.");
        }

        return {
            host: canonicalHost(url.hostname),
            id: match[2].toLowerCase(),
            prefix: match[1],
            url: url.toString(),
        };
    }

    function fillMirrorTemplate(template, values) {
        return template
            .replaceAll("{id}", values.id)
            .replaceAll("{url}", encodeURIComponent(values.url));
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

    function buildMirrorUrl(sourceUrl, mirrorTemplate, options = {}) {
        const article = extractArticleInfo(sourceUrl);
        const normalizedTemplate = normalizeMirrorTemplate(mirrorTemplate, options);
        if (normalizedTemplate.includes("{id}") || normalizedTemplate.includes("{url}")) {
            return fillMirrorTemplate(normalizedTemplate, article);
        }
        return `${normalizedTemplate}${article.id}`;
    }

    globalScope.toFreediumMirror = {
        DEFAULT_MIRROR,
        buildMirrorUrl,
        canonicalHost,
        extractArticleInfo,
        fillMirrorTemplate,
        normalizeMirrorTemplate,
    };
})(globalThis);
