# To Freedium

Firefox extension that redirects Medium article links to a Freedium-compatible mirror so you can read paywalled articles in plain HTML. Works on Firefox desktop and Firefox for Android.

[Source](https://github.com/vopaga/to_freedium) · [Issues](https://github.com/vopaga/to_freedium/issues) · [License](LICENSE)

## Install

### From AMO

Submission to addons.mozilla.org is planned for the 1.0.0 release. Once listed, install with one click on Firefox desktop or Android.

### From GitHub Releases

The [Releases page](https://github.com/vopaga/to_freedium/releases) hosts a `.zip` and a `SHA256SUMS` for each tagged version. The zip is the exact artifact submitted to AMO.

```sh
# verify the download
sha256sum -c SHA256SUMS
```

To load it without AMO signing:

1. Extract the zip.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Pick **Load Temporary Add-on** and select `manifest.json` from the extracted folder.

Temporary add-ons unload when Firefox restarts. Permanent installs of unsigned packages only work on Firefox Developer Edition, Nightly, or ESR; on stock Firefox use the AMO listing once it is live.

## Usage

After installing, every visit to a `medium.com` article (or any enabled publication) redirects to the configured mirror. Open the toolbar popup (or the Add-ons menu on Android) to:

- Toggle the redirect on or off.
- Change the mirror URL or template.
- Enable extra publication domains one by one. Currently bundled: Towards Data Science, Better Programming, UX Collective, Level Up Coding, Better Humans. Firefox prompts for permission each time you enable one.
- Open a pasted URL or the current page through the mirror — useful for standalone Medium-style sites such as `generativeai.pub` that aren't in the curated list.

On Firefox desktop you can also right-click a link or page and choose **Open through mirror** from the context menu. Android does not support extension context menus, so the popup is the manual entry point there.

### Mirror URL formats

| Format | Example | Result for article id `1234567890ab` |
|---|---|---|
| Base URL | `https://freedium-mirror.cfd/` | `https://freedium-mirror.cfd/1234567890ab` |
| `{id}` template | `https://mirror.example/{id}` | `https://mirror.example/1234567890ab` |
| `{url}` template | `https://mirror.example/read?url={url}` | `https://mirror.example/read?url=https%3A%2F%2Fmedium.com%2Fp%2F1234567890ab` |

Mirrors that point at `medium.com` or any curated publication are rejected to prevent redirect loops. Backslashes and unknown `{placeholders}` are rejected so a template cannot inject DNR regex backreferences.

## Default mirror

`https://freedium-mirror.cfd/` is a community-run Freedium-compatible service. The historical `freedium.cfd` host was no longer reachable at the time of this release. This project is not affiliated with either service — the default is just what works today, and you can replace it (including with a self-hosted mirror) from the popup at any time.

## Privacy

No analytics, no telemetry, no page content reading, no remote code, no `webRequest`. Settings are stored locally. The configured mirror obviously sees the navigations you send it — that is inherent to the feature. Full statement in [PRIVACY.md](PRIVACY.md). Permissions justification and reviewer notes in [AMO_SUBMISSION.md](AMO_SUBMISSION.md).

## Contributing

Development setup, test commands, and the manual testing checklist live in [CONTRIBUTING.md](CONTRIBUTING.md). Vulnerability reports should follow [SECURITY.md](SECURITY.md).

## License

[GPL-3.0](LICENSE).
