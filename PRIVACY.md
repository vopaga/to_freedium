# Privacy Statement

To Freedium does not collect analytics, tracking data, or telemetry.

The extension stores these settings locally in Firefox:

- whether redirect is enabled
- the selected mirror URL or mirror template
- enabled built-in publication domains

The extension does not read page content.

The extension does not inject content scripts.

The extension does not proxy or inspect requests with `webRequest`.

When the user explicitly invokes the manual-open feature, the extension reads either the pasted article URL or the current active tab URL and transforms it into a mirror URL locally on-device.

When the extension is enabled, Firefox navigates the tab to the configured Freedium-compatible mirror as part of the user-visible redirect feature. That navigation may expose the article identifier and destination host to the selected mirror, which is inherent to the feature itself.

No extension-managed browsing history is uploaded or synced by the extension.
