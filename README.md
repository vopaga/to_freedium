# To Freedium

Firefox extension that redirects Medium links to a Freedium-compatible mirror.

## Features

- Works in Firefox on desktop and Android.
- Redirects top-level navigation from `medium.com` and `*.medium.com` by extracting the Medium article ID and opening the same article through the selected mirror.
- Lets the user switch the redirect on and off from the popup.
- Lets the user set a custom mirror base URL instead of the default `https://freedium-mirror.cfd/`.
- Lets the user enable built-in publication presets and add exact custom hostnames.
- Requests access to extra domains only when the user explicitly enables them.

## Permissions model

- `declarativeNetRequestWithHostAccess`: used to register redirect rules without the broader install warning shown by `declarativeNetRequest`.
- `storage`: used to persist the enabled state, custom mirror URL, and extra domains.
- `host_permissions` for `medium.com` and `*.medium.com`: needed for the built-in redirect behavior.
- `optional_host_permissions` and `optional_permissions` for runtime domain grants: used for custom publication domains.

The extension does not inject content scripts, does not use `webRequest`, and does not read page content.

## Redirect behavior

- The redirect rule is limited to top-level navigations.
- For Medium-style article URLs, the extension extracts the article ID from the URL and redirects to `<mirror-base-url><article-id>`.
- This matches the public URL format currently exposed by Freedium-compatible mirrors.

## Development

1. Open `about:debugging#/runtime/this-firefox` in Firefox desktop.
2. Choose `Load Temporary Add-on`.
3. Select `manifest.json` from this repository.
4. Open the extension popup and test the toggle, custom mirror URL, and additional domains.

## Android notes

- The popup is exposed through the Firefox Android Add-ons menu.
- Additional domain permission prompts should be tested on-device because the runtime flow differs from desktop UX.

## Packaging and AMO

- Package the extension as a `.zip` or `.xpi` containing the repository files.
- Submit it through the Firefox Add-ons Developer Hub as a listed add-on if you want official catalog distribution.
- In reviewer notes, explain that the extension only redirects top-level navigations, stores settings locally, and requests additional domain access only on user action.
- The manifest includes a minimal static DNR ruleset file as a compatibility workaround for Firefox versions where dynamic rules may not restore reliably after restart.
- Use [AMO_SUBMISSION.md](AMO_SUBMISSION.md) for listing text and reviewer notes.
- Use [PRIVACY.md](PRIVACY.md) as a starting point if you decide to publish a privacy statement with the add-on.
