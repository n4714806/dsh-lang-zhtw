# Changelog

## 1.0.1-patch.1

- Fork maintained in `n4714806/dsh-lang-zhtw`, branch `patch/plugin-pages-zh-tw`.
- Add versioned `mnemon` (0.5.40, 1,409 keys) and `dsh-context` (0.81.2, 737 keys) Traditional Chinese UI dictionaries, retaining all 63 upstream Host dictionaries unchanged.
- Preserve interpolation parameters, literal code and addresses; do not convert runtime or historical content.
- Replace the `/tmp`-dependent destructive generator with a reproducible repository-only build. Pin build dependencies, commit a lockfile and source provenance, and add static-data parsing and safety/regression tests.
- Include upstream dictionary notices/licenses and document Mnemon source-page/metadata bypasses. This is not complete coverage for all third-party plugins.
- No Desktop deployment or installed plugin upgrade is performed by this repository patch.
