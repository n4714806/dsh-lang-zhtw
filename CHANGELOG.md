# Changelog

## 1.0.1-patch.2

- Add an explicit selected-text Traditional reading panel, not whole-page rewriting. Original/Traditional toggle, Copy original, native Escape/focus handling and memory-only content lifetime.
- Keep original page, data, model inputs and existing exports untouched. Native selection copying inside the panel intentionally copies displayed text.
- Reject protected selections; preserve recognisable technical tokens; bound text length and DOM traversal; never clone selected DOM.
- Bundle the used OpenCC core/dictionaries locally with their MIT/Apache notices. Build/browser-test tools remain development-only; no runtime network fetch or additional profile dependencies.
- Add conversion/privacy/lifecycle regressions and documented browser verification boundaries.

## 1.0.1-patch.1

- Fork maintained in `n4714806/dsh-lang-zhtw`, branch `patch/plugin-pages-zh-tw`.
- Add versioned `mnemon` (0.5.40, 1,409 keys) and `dsh-context` (0.81.2, 737 keys) Traditional Chinese UI dictionaries, retaining all 63 upstream Host dictionaries unchanged.
- Preserve interpolation parameters, literal code and addresses; do not convert runtime or historical content.
- Replace the `/tmp`-dependent destructive generator with a reproducible repository-only build. Pin build dependencies, commit a lockfile and source provenance, and add static-data parsing and safety/regression tests.
- Include upstream dictionary notices/licenses and document Mnemon source-page/metadata bypasses. This is not complete coverage for all third-party plugins.
- No Desktop deployment or installed plugin upgrade is performed by this repository patch.
