# AMO Submission Pack

This file contains ready-to-adapt text for a Firefox Add-ons submission.

## Suggested Add-on Name

To Freedium

## Suggested Summary

Open Medium articles through a Freedium-compatible mirror with one tap.

## Suggested Description

To Freedium redirects supported Medium article links to a Freedium-compatible mirror.

What it does:

- redirects top-level navigation on `medium.com` and supported Medium publication domains
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

## Suggested Support Email

Replace with your real support email before submission.

## Suggested Support URL

Replace with your real project or issue tracker URL before submission.

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

- `declarativeNetRequestWithHostAccess` is used for redirect rules without the broader install warning of `declarativeNetRequest`
- `storage` is used only to persist user settings
- `host_permissions` are limited to `medium.com` and `*.medium.com` for built-in behavior
- curated publication domains are requested via runtime permission prompt only after explicit user action in the popup

Redirect behavior:

- the extension extracts the Medium-style article ID from the URL
- it redirects to `<mirror-base-url><article-id>`
- the default mirror is `https://freedium-mirror.cfd/`
- the user can replace this with a self-hosted compatible mirror
- templates may use `{id}` and `{url}` placeholders for self-hosted variants with a different route shape

Data handling:

- the extension stores only local preferences
- it does not transmit extension-managed telemetry
- normal browser navigation to the user-selected mirror is part of the extension's visible function

Known reviewer-sensitive areas:

- `optional_host_permissions` is limited to the curated publication domain list shipped with the extension
- granted runtime access is still requested one host at a time in response to a user action
- a minimal static empty DNR ruleset is included as a Firefox compatibility workaround so dynamic rules restore more reliably after restart

## Packaging

From the repository root, package these files into the upload archive:

- `manifest.json`
- `background.js`
- `popup.html`
- `popup.css`
- `popup.js`
- `rules/empty.json`
- `icons/icon.svg`
- `data/publications.json`

Also include the documentation files in your source package if AMO asks for one.

The project license is in [LICENSE](LICENSE).