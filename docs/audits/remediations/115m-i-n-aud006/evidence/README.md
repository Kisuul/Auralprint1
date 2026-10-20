# Evidence inventory

- `baseline.json`: exact fetched main, merged PR #56/version/toolchain.
- `modeled.mjs` / `modeled.json`: 23 deterministic characterization cases, tiny
  physical data with modeled reported sizes. Temporary inspection copy only.
- `native.cjs` / `native.json`: final native application capacity/codec/lifecycle
  observations; externally provided browser tooling. Actual media stays in work/.
- `native-initial.json`: initial complete 11 recording cases and download/replay,
  followed by incorrect harness expectation for empty File workflow. Preserved
  failure, not a passed source assertion. No production defect inferred.
- `rc06-native.json`: existing unchanged uninstrumented built-page export probe.
- `rc05-native.json`: existing unchanged native finalizing/EOF regression probe.
- command logs and `scope.json`: local validation and exact changed-path boundary.

[Characterization/reproduction](../resource-characterization.md) explains fixture
substitution, memory metrics and limitations. Check validation.json for actual
completed commands, final run outcomes and evidence hashes. No negative-control
policy mutations or device-memory certification are claimed. Saved Blob URLs are
browser-local expired identifiers, not downloadable recordings.
