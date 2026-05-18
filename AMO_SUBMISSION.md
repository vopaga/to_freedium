# AMO Submission Pack

This file contains ready-to-adapt text for a Firefox Add-ons submission.

## Listing references

- Public page: https://addons.mozilla.org/firefox/addon/to-freedium/
- Slug: `to-freedium`
- Add-on GUID (also in `manifest.json`): `{3f1bbfd0-9fe5-4d80-9c4f-19c89f6ee7b2}`
- Developer Hub: https://addons.mozilla.org/developers/addon/to-freedium/

## Suggested Add-on Name

To Freedium

## Suggested Summary

Open Medium articles through a Freedium-compatible mirror with one tap.

## Suggested Description

To Freedium redirects supported Medium article links to a Freedium-compatible mirror.

What it does:

- redirects top-level navigation on `medium.com` and supported Medium publication domains
- lets the user manually open unsupported Medium-style article URLs through the popup on desktop and Android
- adds desktop context-menu actions to open the current page or a clicked link through the mirror
- lets the user turn redirects on or off from the popup
- lets the user choose a custom mirror URL or mirror template
- lets the user enable extra publication domains from a curated list, one by one
- stores settings locally on the device

What it does not do:

- it does not inject content scripts
- it does not inspect page content
- it does not use `webRequest`
- it does not collect analytics or telemetry

Permission model:

- `activeTab` and `scripting` are used only after explicit user action to open the current page through the mirror
- `menus` is used only to add desktop context-menu actions for manual opening
- base host access is limited to `medium.com` and `*.medium.com`
- curated publication domains are requested only when the user explicitly enables them from the popup
- settings are stored with the `storage` API

Compatibility target:

- Firefox desktop
- Firefox for Android

## Suggested Firefox Categories

- Productivity
- Reading

## Suggested Firefox for Android Categories

- Productivity
- Utilities

## Suggested Support URL

https://github.com/vopaga/to_freedium/issues

## Suggested Support Email

Leave blank. AMO requires either a Support URL or a Support Email; the
Support URL above already satisfies that. Add an address here only if
you want a second public channel.

## Suggested Privacy Policy

Tick the "This add-on has a Privacy Policy" checkbox and paste the
block below into the textarea. AMO renders plain text with line
breaks preserved; no Markdown formatting is needed. The same content
is mirrored in [PRIVACY.md](PRIVACY.md) so the GitHub copy and the
AMO listing stay in sync.

```
To Freedium does not collect analytics, tracking data, or telemetry.

What the extension stores locally on your device:

- whether the redirect is enabled
- the chosen mirror URL or template
- the list of enabled publication domains
- a random per-install token used internally to verify the redirect bridge page. This token never leaves your device.

What the extension does not do:

- it does not read page content
- it does not inject content scripts
- it does not use webRequest
- it does not send anything to remote servers controlled by the author

When the redirect is enabled, Firefox navigates the tab to whichever mirror you have configured. By default that is https://freedium-mirror.cfd/, a Freedium-compatible service run by the community. The author of To Freedium is not connected to that service. The navigation exposes the article identifier and the mirror host to whoever operates the mirror. This is how the feature works. You can replace the default with any other URL, including a self-hosted mirror, from the popup at any time.

When you use the manual-open action, the extension reads either the URL you paste or the URL of your active tab, builds the mirror URL locally on your device, and opens the result. Nothing is sent to the author.

No browsing history is uploaded or synced by the extension.

Full version of this policy and its history: https://github.com/vopaga/to_freedium/blob/main/PRIVACY.md
```

## Suggested Screenshot Captions

AMO asks for a short caption for each screenshot. Keep them under 250
characters, active voice, B2 English. Captions used for the v1.0.x
listing:

| Screenshot | Caption |
|---|---|
| Medium article with paywall blocker, popup open, redirect **disabled** | `A Medium article hidden behind a paywall, with the popup open and the redirect turned off.` |
| Same article on `freedium-mirror.cfd` in plain HTML, popup open, redirect **enabled** | `The same article opens on a Freedium-compatible mirror in plain HTML once the redirect is turned on.` |
| (optional) Popup detail shot | `The toolbar popup. Toggle the redirect, change the mirror URL or template, enable extra publication domains.` |

## Reviewer Notes

This extension redirects only top-level navigations for Medium-style article URLs.

Architecture summary:

- Manifest V3 extension
- redirect logic is implemented with `declarativeNetRequest` dynamic rules
- no content scripts
- no `webRequest`
- no remote code
- no analytics or telemetry

Permissions summary:

- `activeTab` and `scripting` are used only for the explicit manual-open action from the popup
- `declarativeNetRequestWithHostAccess` is used for redirect rules without the broader install warning of `declarativeNetRequest`
- `menus` is used to expose desktop context-menu actions for manual opening
- `storage` is used only to persist user settings
- `host_permissions` are limited to `medium.com` and `*.medium.com` for built-in behavior
- curated publication domains are requested via runtime permission prompt only after explicit user action in the popup

Redirect behavior:

- the extension extracts the Medium-style article ID from the URL
- it redirects to `<mirror-base-url><article-id>`
- the default mirror is `https://freedium-mirror.cfd/`, a community-run
  Freedium-compatible service; the historical `freedium.cfd` host was
  no longer reachable at the time of this release
- the project is not affiliated with either service and the user can
  replace the default with any other mirror, including a self-hosted one
- templates may use `{id}` and `{url}` placeholders for self-hosted variants with a different route shape
- `{url}` receives a canonical article URL without extra query strings or fragments
- backslashes and unknown `{placeholders}` are rejected so the mirror
  template cannot inject DNR regex backreferences
- unsupported standalone Medium-style domains are handled only through explicit manual-open actions, not automatic all-sites interception
- on Firefox for Android, manual-open is exposed through the popup because extension context menus are not supported there
- the internal redirect bridge is web-accessible only from supported source domains and validates a per-install token before it will forward the tab

Data handling:

- the extension stores only local preferences
- it does not transmit extension-managed telemetry
- normal browser navigation to the user-selected mirror is part of the extension's visible function

Known reviewer-sensitive areas:

- `optional_host_permissions` is limited to the curated publication domain list shipped with the extension
- granted runtime access is still requested one host at a time in response to a user action
- the extension does not request broad all-sites host access for unsupported domains; those are handled only through explicit manual-open actions
- a minimal static empty DNR ruleset is included as a Firefox compatibility workaround so dynamic rules restore more reliably after restart

## Packaging

The upload archive is built by `.github/workflows/release.yml` via `web-ext build` and the ignore list in `web-ext-config.cjs`. The same zip is published to the GitHub Releases page alongside a `SHA256SUMS` file. Download the zip from the matching release and upload it to AMO.

If AMO asks for a separate source upload, supply a zip of the full Git tree at the tagged commit (including `tests/`, `.github/`, and the documentation files).

The project license is in [LICENSE](LICENSE).
