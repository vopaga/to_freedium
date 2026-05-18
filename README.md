<p align="center">
  <img src="icons/icon.svg" width="128" height="128" alt="">
</p>

<h1 align="center">To Freedium</h1>

<p align="center">
  Firefox extension that redirects Medium article links to a Freedium-compatible mirror
  <br>so you can read paywalled articles in plain HTML.
  <br>Works on Firefox desktop and Firefox for Android.
</p>

<p align="center">
  <a href="https://github.com/vopaga/to_freedium/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/vopaga/to_freedium?style=flat-square&color=165d45&label=release"></a>
  <a href="https://github.com/vopaga/to_freedium/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/vopaga/to_freedium/ci.yml?branch=main&style=flat-square&label=ci"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-GPL--3.0-165d45?style=flat-square"></a>
  <a href="https://ko-fi.com/vopaga"><img alt="Support on Ko-fi" src="https://img.shields.io/badge/support-Ko--fi-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white"></a>
</p>

---

## Install

### From AMO

Install in one click on Firefox desktop and Android:

https://addons.mozilla.org/firefox/addon/to-freedium/

While the latest version is in Mozilla's review queue the page shows "Awaiting Review". The install button becomes active once review passes.

### From GitHub Releases

The [Releases page](https://github.com/vopaga/to_freedium/releases) has a `.zip` and a `SHA256SUMS` file for each version. The zip is the same file we upload to AMO.

```sh
# verify the download
sha256sum -c SHA256SUMS
```

To load it without AMO signing:

1. Extract the zip.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Pick **Load Temporary Add-on** and select `manifest.json` from the extracted folder.

Temporary add-ons disappear when you restart Firefox. To install an unsigned package permanently you need Firefox Developer Edition, Nightly, or ESR. On the regular Firefox build, use the AMO listing after it goes live.

## Usage

After installing, every visit to a `medium.com` article (or any enabled publication) redirects to the chosen mirror. Open the toolbar popup (or the Add-ons menu on Android) to:

- Toggle the redirect on or off.
- Change the mirror URL or template.
- Enable extra publication domains one by one. The list includes Towards Data Science, Better Programming, UX Collective, Level Up Coding, and Better Humans. Firefox asks for permission each time you enable one.
- Open a pasted URL or the current page through the mirror. This is useful for standalone Medium-style sites like `generativeai.pub` that are not in the list.

On Firefox desktop you can also right-click a link or page and choose **Open through mirror** from the context menu. Android does not support extension context menus, so the popup is the only way to do this there.

### Mirror URL formats

| Format | Example | Result for article id `1234567890ab` |
|---|---|---|
| Base URL | `https://freedium-mirror.cfd/` | `https://freedium-mirror.cfd/1234567890ab` |
| `{id}` template | `https://mirror.example/{id}` | `https://mirror.example/1234567890ab` |
| `{url}` template | `https://mirror.example/read?url={url}` | `https://mirror.example/read?url=https%3A%2F%2Fmedium.com%2Fp%2F1234567890ab` |

Mirrors that point at `medium.com` or any of the listed publications are rejected so the redirect cannot loop back. Backslashes and unknown `{placeholders}` are also rejected so a template cannot inject DNR regex backreferences.

## Default mirror

`https://freedium-mirror.cfd/` is a Freedium-compatible service run by the community. The old `freedium.cfd` host was not reachable when we made this release. This project is not connected to either of them. The default is simply what works today, and you can replace it (with a self-hosted mirror or any other URL) from the popup at any time.

## Privacy

No analytics, no telemetry, no page content reading, no remote code, no `webRequest`. Settings are stored locally. The chosen mirror sees the URLs you send it, which is how the feature works. Full statement in [PRIVACY.md](PRIVACY.md). Permission notes for AMO reviewers in [AMO_SUBMISSION.md](AMO_SUBMISSION.md).

## Contributing

Development setup, test commands, and the manual testing checklist are in [CONTRIBUTING.md](CONTRIBUTING.md). For vulnerability reports, see [SECURITY.md](SECURITY.md).

## License

[GPL-3.0](LICENSE).
