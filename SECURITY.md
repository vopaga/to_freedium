# Security Policy

## Supported versions

Only the latest released version is supported. Older versions do not receive
security updates.

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Instead, report privately by opening a
[GitHub security advisory](https://github.com/vopaga/to_freedium/security/advisories/new)
on the project repository.

When reporting, please include:

- A clear description of the issue and its impact.
- Steps to reproduce, including the affected Firefox version and operating system.
- A proof of concept if you have one.
- Any suggested mitigation.

We will acknowledge your report within a reasonable time frame and keep you
informed about the fix.

## Scope

The following are in scope:

- Redirect logic, including DNR rule generation and the internal redirect bridge.
- Mirror template handling and any validation around it.
- Message handling between popup, background, and bridge pages.
- Permission requests for optional publication domains.

The following are out of scope:

- Issues in the user-selected mirror service (this extension does not control
  what the mirror does with the article URL).
- Issues that require a malicious browser extension already installed with
  comparable permissions.
- Browser bugs that affect all extensions, not specifically this one.

## Disclosure

We aim to coordinate disclosure with reporters. Please give us a reasonable
amount of time to release a fix before publishing details.
