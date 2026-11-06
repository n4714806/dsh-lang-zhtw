# dsh-lang-zhtw — n4714806 patch

Traditional Chinese (Taiwan) for DeepSeek Harness, including verified plugin UI dictionaries. [繁體中文說明](<README.zh-TW.md>).

Forked from [Grasseed/dsh-lang-zhtw](https://github.com/Grasseed/dsh-lang-zhtw). Patch branch: `patch/plugin-pages-zh-tw`; version **1.0.1-patch.2**.

## Selected-text reader

Select ordinary prose on the original page, then press **Traditional reader** at the bottom right. Toggle Original/Traditional; **Copy original** always uses the source. Native selection copying inside the panel copies the displayed text. No original page/data edits, network conversion or content persistence. Closing releases the panel content. See [reader scope, safeguards and limits](<docs/reader.md>).

## What's improved

- Keeps the upstream **63 namespaces / 2,676 keys** unchanged.
- Adds **1,409 Mnemon keys** (0.5.40, namespace `mnemon`) and **737 Context/Fleet keys** (0.81.2, namespace `dsh-context`).
- Total: **65 namespaces / 4,822 keys**. This is dictionary coverage, not an all-pages visual guarantee.
- Reproducible Windows/macOS/Linux build from committed snapshots and reader source; pinned development dependencies and tests. The used OpenCC converter is bundled locally, not installed as a runtime dependency.
- No runtime DOM conversion, service monkey-patching, profile edits, model calls, or historical-content rewriting. Interpolation, code and address tokens are protected.

**Known limit:** some Mnemon source pages and component metadata explicitly choose Simplified Chinese without consulting DSH's locale service. This pack cannot fix those bypasses. See [coverage and validation boundaries](<docs/coverage.md>).

## Use the patch

```sh
git clone --branch patch/plugin-pages-zh-tw https://github.com/n4714806/dsh-lang-zhtw.git
```

Use the Desktop plugin manager to update the **existing** `dsh-lang-zhtw` package from this folder, or use its Git source field with `github:n4714806/dsh-lang-zhtw#patch/plugin-pages-zh-tw`. Keep only one copy of this language pack enabled: it owns the `zh-TW` language registration. Choose **繁體中文（台灣）** in the language selector.

The generated browser artifact is committed; end users do not need npm install/build. This repository work does **not** itself update a running Desktop profile. Back up the profile first, review the manager's result, and verify existing plugins after any separately authorized installation. Do not run npm/pnpm inside the Desktop profile or hand-edit its dependency/configuration files.

## Develop and test (repository only)

```sh
npm ci --include=dev --ignore-scripts
npm run build
npm test
```

No network or model requests are made by the build/tests. The build reads committed dictionaries and writes only the generated [client](<client.js>); it does not rewrite the package manifest, icon, locale metadata, or profile.

[Source manifest](<dictionaries/sources.json>) records versions, namespaces, bindings and source artifact SHA-256. To explicitly refresh a reviewed plugin snapshot:

```sh
node tools/refresh-plugin-source.mjs dsh-mnemon /path/to/package/lib/client.js 0.5.40
npm run build
npm test
```

The parser accepts static data only, not executable expressions. Review namespace registrations and bindings again for newer/minified versions. The original [Host extractor](<tools/extract-dicts4.mjs>) is retained as a legacy reference, not invoked by the current build; it uses dynamic evaluation and must not be used on untrusted artifacts. Host dictionary refresh is a separate reviewed change, not automatic.

## Validation status

Automated tests execute the generated module against a mock locale service: registration ordering, disposal, fallback, language switching, placeholder preservation and immutable historical parameters. They are **not** a live Desktop screenshot/click test. Neither Mnemon nor Context was upgraded for this patch.

## Licensing

Upstream language pack: MIT © 2026 Grasseed. Plugin dictionary portions retain their respective MIT / Apache-2.0 terms; see [third-party notices](<THIRD_PARTY_NOTICES.md>) and [coverage](<docs/coverage.md>).
