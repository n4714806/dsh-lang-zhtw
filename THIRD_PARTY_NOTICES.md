# Third-party notices

This fork retains the upstream dsh-lang-zhtw MIT license and original attribution to Grasseed. The new plugin dictionaries and generated client contain adapted/translated data from:

- **dsh-mnemon 0.5.40** — https://github.com/omdsh-dev/dsh-mnemon — MIT. Copyright (c) 2026 dsh-external contributors. Full text: `licenses/dsh-mnemon-MIT.txt`.
- **dsh-context 0.81.2** — https://github.com/bowenliang123/dsh-context — Apache License 2.0. Copyright 2025 bowenliang123. Full text: `licenses/dsh-context-Apache-2.0.txt`. No separate NOTICE file was present in the inspected package distribution.

Modifications by this fork: extract only static UI dictionary data, reformat as JSON, convert it to Traditional Chinese (Taiwan) using OpenCC plus a small UI terminology table, preserve interpolation/code/address tokens, and register the translated dictionaries with DSH's public locale service. No upstream application logic is copied into the runtime patch.

`dictionaries/source/dsh-context.zh.json` and `dictionaries/source/dsh-mnemon.zh.json` are extracted/reformatted source snapshots. Their translated derivatives are in the generated `client.js`; the respective upstream licenses continue to apply to these portions. Build tools and tests are covered by this repository's MIT license. The package's top-level MIT declaration does not relicense the Apache-2.0 dictionary portions.

Source artifact versions, hashes and namespaces are recorded in `dictionaries/sources.json`. Acorn and esbuild are build-only tools. Starting with 1.0.1-patch.2, the browser artifact also bundles the used OpenCC conversion core and CN/TW dictionary data (Traditional-only in patch.2; bidirectional in patch.3) for the explicit, local selected-text reader. There is no runtime package installation or network fetch.

- **opencc-js 1.3.1** — https://github.com/nk2028/opencc-js — MIT, Copyright (c) 2020-2021 The nk2028 Project. Full text: `licenses/opencc-js-MIT.txt`.
- **opencc-data**, as distributed by opencc-js 1.3.1 — Apache-2.0. Original notice and full license are preserved in `licenses/opencc-third-party.md`. Bundling/tree-shaking changes packaging, not the dictionary licensing.
