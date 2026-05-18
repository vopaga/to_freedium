# Contributing

Thanks for taking the time to look at the project.

## Project layout

| Path | Purpose |
| ---- | ------- |
| `manifest.json` | Firefox MV3 manifest. |
| `background.js` | Background script: DNR rule sync, message handling, context menus. |
| `mirror-template.js` | Pure helpers for URL parsing and mirror template rendering. Shared by the background page and the popup. |
| `popup.html` / `popup.css` / `popup.js` | Toolbar popup UI. |
| `redirect.html` / `redirect.js` | Internal redirect bridge used when the mirror template needs the canonical article URL. |
| `data/publications.json` | Curated list of optional publication domains. |
| `rules/empty.json` | Empty static DNR ruleset used as a Firefox restart-stability workaround. |
| `icons/icon.svg` | Single SVG used for all icon sizes. |
| `tests/mirror-template.test.js` | Node unit tests for the URL / template helpers. |
| `tests/validate.ps1` | PowerShell script that checks manifest internal consistency and URL regex behavior. |
| `web-ext-config.cjs` | `web-ext` ignore list controlling what goes into the release zip. |
| `.github/workflows/ci.yml` | Runs Node tests, PowerShell validation, and `web-ext lint` on every push and PR. |
| `.github/workflows/release.yml` | Builds the zip and publishes a GitHub Release on tag push. |
| `LICENSE` | GPL-3.0. |

## Local development

The fastest loop is [`web-ext`](https://github.com/mozilla/web-ext):

```sh
npx web-ext run     # launches a clean Firefox profile with the extension loaded and auto-reloads on file changes
npx web-ext lint    # runs Mozilla's add-ons linter against the manifest
```

If you prefer to load the extension into your existing Firefox profile:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on** and pick `manifest.json` from this directory.
3. Open the popup, toggle redirect on, and visit any Medium article to confirm the redirect works.

Temporary add-ons unload on restart, which is fine for development.

## Manual testing checklist

Automated tests cannot cover real browser behavior (DNR application, permission prompts, popup flow on Android, etc.). Before opening a pull request please walk through this list on Firefox desktop:

- [ ] Toggle the redirect on and off from the popup.
- [ ] Visit `https://medium.com/p/<some-article-id>` and confirm the redirect points to the configured mirror.
- [ ] Visit a `*.medium.com` subdomain article and confirm the redirect works.
- [ ] Try a URL with a trailing slash and with `?source=...` to verify both still redirect.
- [ ] Change the mirror template to `https://mirror.example/read?url={url}` and confirm the bridge resolves to the encoded canonical URL.
- [ ] Set the mirror template to something invalid (empty, `medium.com`, backslash, unknown placeholder) and confirm the popup surfaces a readable error.
- [ ] Enable one preset publication, confirm Firefox prompts for host permission, and confirm the redirect works on that domain.
- [ ] Disable the same preset and confirm DNR rules are removed.
- [ ] Use **Open current page through mirror** and **Open pasted URL** in the popup.
- [ ] Use the desktop context-menu actions (page and link).

If you can, also smoke-test the popup on Firefox for Android, where context menus do not exist.

## Validation

From the repository root:

```sh
node --test                       # unit tests for mirror-template.js
pwsh -File tests/validate.ps1     # manifest consistency + URL regex sanity
npx web-ext lint                  # Mozilla's add-ons linter (catches AMO issues)
```

These same checks run on every push and pull request via `.github/workflows/ci.yml`.

PowerShell 7+ is available cross-platform via [the official installers](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell).

## Code style

- Plain JavaScript, no build step, no transpiler.
- Two-space indentation, double-quoted strings, semicolons, `"use strict";` at the top of each script.
- Prefer pure helpers in `mirror-template.js`; avoid touching `document` from there.
- DOM manipulation must go through `textContent` / `createElement`; never inject HTML strings.
- Do not add `eval`, `Function(...)`, or remote script loading.

## Pull requests

- Keep PRs focused; describe what changed in the redirect or permission model.
- Include the manual testing notes you performed.
- Update `README.md`, `PRIVACY.md`, `AMO_SUBMISSION.md`, and `data/publications.json` whenever your change affects user-visible behavior, permissions, or supported domains.

## Releasing

Releases are produced by `.github/workflows/release.yml`, which fires on any tag matching `v*` and can also be triggered manually with `workflow_dispatch`.

To cut a release:

1. Bump `manifest.json` `version` to the target version (e.g. `1.0.0`).
2. Commit the bump and push it to `main`.
3. Tag the commit and push the tag:

   ```sh
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. The release workflow will:
   - Re-run all tests and `web-ext lint`.
   - Refuse to publish if `manifest.json` version does not match the tag.
   - Build the extension with `web-ext build`.
   - Compute `SHA256SUMS` for the produced zip.
   - Create a GitHub Release with auto-generated notes and attach both files.

The same workflow can be triggered from the Actions tab on GitHub by selecting **Release** and supplying an existing tag.

## Security

If you think you have found a vulnerability, do not open a public issue. See [SECURITY.md](SECURITY.md) instead.
