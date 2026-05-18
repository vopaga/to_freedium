# To Freedium

Firefox extension that redirects Medium links to a Freedium-compatible mirror.

## Features

- Works in Firefox on desktop and Android.
- Redirects top-level navigation from `medium.com` and `*.medium.com` by extracting the Medium article ID and opening the same article through the selected mirror.
- Lets the user switch the redirect on and off from the popup.
- Lets the user set either a custom mirror URL or a mirror template with `{id}` and `{url}` placeholders.
- Lets the user enable a curated list of built-in publication domains one by one.
- Requests access to each extra publication domain only when the user explicitly enables it.

## Permissions model

- `declarativeNetRequestWithHostAccess`: used to register redirect rules without the broader install warning shown by `declarativeNetRequest`.
- `storage`: used to persist the enabled state, custom mirror setting, and enabled publication presets.
- `host_permissions` for `medium.com` and `*.medium.com`: needed for the built-in redirect behavior.
- `optional_host_permissions` for runtime domain grants: used for the curated publication list.

The extension does not inject content scripts, does not use `webRequest`, and does not read page content.

## Redirect behavior

- The redirect rule is limited to top-level navigations.
- For Medium-style article URLs, the extension extracts the article ID and reconstructs the original article URL through an internal redirect bridge page.
- If the configured mirror setting is a plain base URL, the extension redirects to `<mirror-base-url><article-id>`.
- If the configured mirror setting contains `{id}` and/or `{url}`, those placeholders are filled before the final redirect.
- Mirror settings that point back to `medium.com` or the supported publication domains are rejected to prevent redirect loops.
- If redirect preparation fails, the bridge page now shows an error and a fallback link to the original article instead of silently hanging.

## Development

1. Open `about:debugging#/runtime/this-firefox` in Firefox desktop.
2. Choose `Load Temporary Add-on`.
3. Select `manifest.json` from this repository.
4. Open the extension popup and test the toggle, custom mirror URL, and curated publication domains.

## Android notes

- The popup is exposed through the Firefox Android Add-ons menu.
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

- Run `pwsh -File tests/validate.ps1` from the repository root to validate URL extraction and mirror template behavior.
