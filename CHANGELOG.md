# Changelog

## 1.0.1-patch.3

- Add original/traditional/simplified modes, always derived from the immutable original.
- Add non-cancelling reading action strips for selected page prose and inside the reader. Native context menus are NOT modified/replaced; Shift bypasses strips and existing handled events are respected.
- Revalidate pending source identity, range, connectivity, protection and text before activation; restore panel focus after keyboard actions.
- Cache views only for the open capture; initialize directional converters lazily; bundle only required OpenCC core/dictionaries while preserving upstream phrase segmentation.
- Add directional parity tests and real-React/Edge context, keyboard, stale selection/source and non-cancellation regressions. Electron native popup coexistence still needs manual verification.

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
