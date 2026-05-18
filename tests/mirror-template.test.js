"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

require("../mirror-template.js");
const {
    DEFAULT_MIRROR,
    buildCanonicalArticleUrl,
    buildMirrorUrl,
    canonicalHost,
    extractArticleInfo,
    hostMatchesManagedSource,
    normalizeMirrorTemplate,
} = globalThis.toFreediumMirror;

test("canonicalHost lowercases, trims, and strips edge dots", () => {
    assert.equal(canonicalHost("  Medium.COM. "), "medium.com");
    assert.equal(canonicalHost(".sub.medium.com."), "sub.medium.com");
    assert.equal(canonicalHost(undefined), "");
    assert.equal(canonicalHost(null), "");
});

test("hostMatchesManagedSource matches host and any subdomain", () => {
    assert.equal(hostMatchesManagedSource("medium.com", "medium.com"), true);
    assert.equal(hostMatchesManagedSource("sub.medium.com", "medium.com"), true);
    assert.equal(hostMatchesManagedSource("evil-medium.com", "medium.com"), false);
    assert.equal(hostMatchesManagedSource("medium.com.attacker.test", "medium.com"), false);
});

test("extractArticleInfo parses a canonical Medium URL", () => {
    const info = extractArticleInfo("https://medium.com/@user/title-1234567890ab");
    assert.deepEqual(info, {
        scheme: "https",
        host: "medium.com",
        prefix: "@user/title-",
        id: "1234567890ab",
        url: "https://medium.com/@user/title-1234567890ab",
    });
});

test("extractArticleInfo strips query and fragment", () => {
    const info = extractArticleInfo("https://medium.com/p/1234567890ab?source=email#top");
    assert.equal(info.url, "https://medium.com/p/1234567890ab");
});

test("extractArticleInfo accepts a trailing slash after the article id", () => {
    const info = extractArticleInfo("https://medium.com/p/1234567890ab/");
    assert.equal(info.id, "1234567890ab");
    assert.equal(info.url, "https://medium.com/p/1234567890ab");
});

test("extractArticleInfo accepts a trailing path segment after the article id", () => {
    const info = extractArticleInfo("https://medium.com/p/1234567890ab/comments");
    assert.equal(info.id, "1234567890ab");
});

test("extractArticleInfo rejects URLs without a Medium-style id", () => {
    assert.throws(() => extractArticleInfo("https://medium.com/no-id-here"));
    assert.throws(() => extractArticleInfo("https://medium.com/"));
});

test("extractArticleInfo rejects non-http(s) schemes", () => {
    assert.throws(() => extractArticleInfo("javascript:alert(1)/1234567890ab"));
    assert.throws(() => extractArticleInfo("data:text/html,1234567890ab"));
});

test("extractArticleInfo rejects prefixes containing & or =", () => {
    // & and = in the path could smuggle parameters through the redirect bridge hash.
    assert.throws(() => extractArticleInfo("https://medium.com/anything&host=evil-1234567890ab"));
    assert.throws(() => extractArticleInfo("https://medium.com/foo=bar-1234567890ab"));
});

test("buildCanonicalArticleUrl rebuilds the canonical form", () => {
    const url = buildCanonicalArticleUrl({
        scheme: "https",
        host: "MEDIUM.com",
        prefix: "/@user/title-",
        id: "1234567890AB",
    });
    assert.equal(url, "https://medium.com/@user/title-1234567890ab");
});

test("buildCanonicalArticleUrl rejects malformed parts", () => {
    assert.throws(() => buildCanonicalArticleUrl({ scheme: "ftp", host: "medium.com", prefix: "", id: "1234567890ab" }));
    assert.throws(() => buildCanonicalArticleUrl({ scheme: "https", host: "", prefix: "", id: "1234567890ab" }));
    assert.throws(() => buildCanonicalArticleUrl({ scheme: "https", host: "medium.com", prefix: "", id: "not-an-id" }));
});

test("normalizeMirrorTemplate returns the default when input is empty", () => {
    assert.equal(normalizeMirrorTemplate(""), DEFAULT_MIRROR);
    assert.equal(normalizeMirrorTemplate(null), DEFAULT_MIRROR);
});

test("normalizeMirrorTemplate accepts {id} and {url} templates", () => {
    assert.equal(
        normalizeMirrorTemplate("https://mirror.example/{id}"),
        "https://mirror.example/{id}"
    );
    assert.equal(
        normalizeMirrorTemplate("https://mirror.example/read?url={url}"),
        "https://mirror.example/read?url={url}"
    );
});

test("normalizeMirrorTemplate rejects backslashes that could become DNR backreferences", () => {
    assert.throws(() => normalizeMirrorTemplate("https://mirror.example/\\1/{id}"));
});

test("normalizeMirrorTemplate rejects unknown placeholders", () => {
    assert.throws(() => normalizeMirrorTemplate("https://mirror.example/{foo}"));
    assert.throws(() => normalizeMirrorTemplate("https://mirror.example/{id}/{url}/{extra}"));
});

test("normalizeMirrorTemplate rejects non-http(s) schemes", () => {
    assert.throws(() => normalizeMirrorTemplate("javascript:alert(1)"));
    assert.throws(() => normalizeMirrorTemplate("ftp://mirror.example/"));
});

test("normalizeMirrorTemplate rejects mirrors that point at Medium or curated sources", () => {
    const blockedHosts = ["medium.com", "towardsdatascience.com"];
    assert.throws(() => normalizeMirrorTemplate("https://medium.com/", { blockedHosts }));
    assert.throws(() => normalizeMirrorTemplate("https://sub.medium.com/{id}", { blockedHosts }));
    assert.throws(() => normalizeMirrorTemplate("https://towardsdatascience.com/{id}", { blockedHosts }));
});

test("buildMirrorUrl appends the article id to a plain base URL", () => {
    const result = buildMirrorUrl(
        "https://medium.com/p/1234567890ab",
        "https://freedium-mirror.cfd/"
    );
    assert.equal(result, "https://freedium-mirror.cfd/1234567890ab");
});

test("buildMirrorUrl fills the {id} placeholder", () => {
    const result = buildMirrorUrl(
        "https://medium.com/p/1234567890ab",
        "https://mirror.example/{id}"
    );
    assert.equal(result, "https://mirror.example/1234567890ab");
});

test("buildMirrorUrl URL-encodes the {url} placeholder", () => {
    const result = buildMirrorUrl(
        "https://medium.com/p/1234567890ab",
        "https://mirror.example/read?url={url}"
    );
    assert.equal(
        result,
        "https://mirror.example/read?url=https%3A%2F%2Fmedium.com%2Fp%2F1234567890ab"
    );
});

test("buildMirrorUrl strips query and fragment from the source before mirroring", () => {
    const result = buildMirrorUrl(
        "https://medium.com/p/1234567890ab?source=email#top",
        "https://mirror.example/read?url={url}"
    );
    assert.equal(
        result,
        "https://mirror.example/read?url=https%3A%2F%2Fmedium.com%2Fp%2F1234567890ab"
    );
});
