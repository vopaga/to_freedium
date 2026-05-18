"use strict";

// Configuration for `web-ext build` and `web-ext lint`.
// Anything listed here is excluded from the produced .zip.
module.exports = {
    ignoreFiles: [
        "tests",
        "tests/**",
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
        "CONTRIBUTING.md",
        "SECURITY.md",
        "AMO_SUBMISSION.md",
        "PRIVACY.md",
        "README.md",
    ],
};
