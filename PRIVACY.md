# Privacy Statement

To Freedium does not collect analytics, tracking data, or telemetry.

The extension stores these settings locally in Firefox:

- whether redirect is enabled
- the selected mirror URL or mirror template
- enabled built-in publication domains
- a randomly generated, per-install token used internally to authenticate
  the redirect bridge page; this token never leaves the user's device.

The extension does not read page content.

The extension does not inject content scripts.

The extension does not proxy or inspect requests with `webRequest`.

When the user explicitly invokes the manual-open feature, the extension reads either the pasted article URL or the current active tab URL and transforms it into a mirror URL locally on-device.

## Default mirror

The default mirror is `https://freedium-mirror.cfd/`, a community-run
Freedium-compatible service. The historical `freedium.cfd` is no longer
reachable at the time of this release. To Freedium and its authors are
not affiliated with either service.

When the extension is enabled, Firefox navigates the tab to whichever
mirror the user has configured (the default above, or any other URL the
user enters). That navigation exposes the article identifier and the
mirror host to the configured mirror operator, which is inherent to the
feature itself. Anyone concerned about that exposure can replace the
default with a self-hosted Freedium-compatible mirror at any time from
the popup.

No extension-managed browsing history is uploaded or synced by the extension.
