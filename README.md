# To Freedium

Firefox extension that redirects Medium links to a Freedium-compatible mirror.

## Default mirror

The default mirror is `https://freedium-mirror.cfd/`, a community-run
Freedium-compatible service. The historical `freedium.cfd` is no longer
reachable at the time of this release, and this project is not affiliated
with either service. You can replace the default with any other mirror,
including a self-hosted one, from the popup at any time.

## Features

- Works in Firefox on desktop and Android.
- Redirects top-level navigation from `medium.com` and `*.medium.com` by extracting the Medium article ID and opening the same article through the selected mirror.
- Lets the user switch the redirect on and off from the popup.
- Lets the user set either a custom mirror URL or a mirror template with `{id}` and `{url}` placeholders.
- Lets the user enable a curated list of built-in publication domains one by one.
- Lets the user manually open unsupported Medium-style article URLs through the mirror from the popup.
- Adds a desktop context-menu action for opening the current page or a clicked link through the mirror.
- Requests access to each extra publication domain only when the user explicitly enables it.

## Permissions model

- `declarativeNetRequestWithHostAccess`: used to register redirect rules without the broader install warning shown by `declarativeNetRequest`.
- `activeTab`: used only when the user explicitly asks the extension to open the current page through the mirror.
- `scripting`: used with `activeTab` to read the current tab URL after explicit user action.
- `menus`: used to add desktop context-menu actions for manual opening.
- `storage`: used to persist the enabled state, custom mirror setting, and enabled publication presets.
- `host_permissions` for `medium.com` and `*.medium.com`: needed for the built-in redirect behavior.
- `optional_host_permissions` for runtime domain grants: used for the curated publication list.

The extension does not inject content scripts, does not use `webRequest`, and does not read page content.

## Redirect behavior

- The redirect rule is limited to top-level navigations.
- For automatic redirects, the extension only watches `medium.com`, `*.medium.com`, and explicitly enabled curated publication domains.
- For Medium-style article URLs, the extension extracts the article ID and reconstructs a canonical article URL through an internal redirect bridge page when needed.
- If the configured mirror setting is a plain base URL, the extension redirects to `<mirror-base-url><article-id>`.
- If the configured mirror setting contains `{id}` and/or `{url}`, those placeholders are filled before the final redirect.
- `{url}` receives the canonical article URL without extra query-string or fragment noise, so automatic and manual opening behave the same way.
- Mirror settings that point back to `medium.com` or the supported publication domains are rejected to prevent redirect loops.
- If redirect preparation fails, the bridge page now shows an error and a fallback link to the original article instead of silently hanging.
- The redirect bridge is exposed only to supported source domains and validates an internal token before it can send the tab to the configured mirror.
- Unsupported standalone domains such as `generativeai.pub` are not auto-captured, but they can be opened manually through the popup on desktop and Android, and through the desktop context menu.

## Development

1. Open `about:debugging#/runtime/this-firefox` in Firefox desktop.
2. Choose `Load Temporary Add-on`.
3. Select `manifest.json` from this repository.
4. Open the extension popup and test the toggle, custom mirror URL, curated publication domains, and manual-open actions.

## Android notes

- The popup is exposed through the Firefox Android Add-ons menu.
- Firefox for Android does not support extension context menus, so the popup is the manual-open entry point there.
- After a successful manual-open action, the popup closes so Firefox can reveal the destination page.
- Publication permission prompts should be tested on-device because the runtime flow differs from desktop UX.

## Packaging and AMO

- Package the extension as a `.zip` or `.xpi` containing the repository files.
- Submit it through the Firefox Add-ons Developer Hub as a listed add-on if you want official catalog distribution.
- In reviewer notes, explain that the extension only redirects top-level navigations, stores settings locally, and requests curated publication-domain access only on user action.
- The manifest includes a minimal static DNR ruleset file as a compatibility workaround for Firefox versions where dynamic rules may not restore reliably after restart.
- Use [AMO_SUBMISSION.md](AMO_SUBMISSION.md) for listing text and reviewer notes.
- Use [PRIVACY.md](PRIVACY.md) as a starting point if you decide to publish a privacy statement with the add-on.
- The repository license is available in [LICENSE](LICENSE).

## Validation

- Run `pwsh -File tests/validate.ps1` from the repository root to validate URL extraction and mirror template behavior. PowerShell 7+ is available cross-platform via [the official installers](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell).
- Run `npx web-ext lint` to validate the manifest against Mozilla's add-ons linter.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and the manual testing checklist. Security issues should follow [SECURITY.md](SECURITY.md).
