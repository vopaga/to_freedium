# Privacy Statement

To Freedium does not collect analytics, tracking data, or telemetry.

## What the extension stores locally on your device

- whether the redirect is enabled
- the chosen mirror URL or template
- the list of enabled publication domains
- a random per-install token used internally to verify the redirect bridge page. This token never leaves your device.

## What the extension does not do

- it does not read page content
- it does not inject content scripts
- it does not use `webRequest`
- it does not send anything to remote servers controlled by the author

## Default mirror

The default mirror is `https://freedium-mirror.cfd/`, a Freedium-compatible service run by the community. The old `freedium.cfd` host was not reachable when we made this release. The author of To Freedium is not connected to either of them.

When the redirect is enabled, Firefox navigates the tab to whichever mirror you have configured. That navigation exposes the article identifier and the mirror host to whoever operates the mirror. This is how the feature works. You can replace the default with any other URL, including a self-hosted mirror, from the popup at any time.

## Manual open

When you use the manual-open action, the extension reads either the URL you paste or the URL of your active tab, builds the mirror URL locally on your device, and opens the result. Nothing is sent to the author.

No browsing history is uploaded or synced by the extension.
