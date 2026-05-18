"use strict";

// Configuration for `web-ext build` and `web-ext lint`.
// Anything listed here is excluded from the produced .zip.
module.exports = {
    ignoreFiles: [
        "tests",
        "tests/**",
        "tools",
        "tools/**",
        ".github",
        ".github/**",
        ".gitignore",
        ".claude",
        ".claude/**",
        "node_modules",
        "node_modules/**",
        "web-ext-artifacts",
        "web-ext-artifacts/**",
        "web-ext-config.cjs",
        "package.json",
        "package-lock.json",
        "icons/icon-128.png",
        "CONTRIBUTING.md",
        "SECURITY.md",
        "AMO_SUBMISSION.md",
        "PRIVACY.md",
        "README.md",
    ],
};
