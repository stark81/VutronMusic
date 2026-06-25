# Task 6: StreamPage — Aggregated Filtering + Pagination Integration

## Status

**Completed** -- all changes implemented, lint/format/build passed.

## Changes Summary

### Modified: `src/renderer/views/StreamPage.vue`

| Step | Change | Description |
| --- | --- | --- |
| 1 | `defaultTracks` computed | Filter by `loadFull` in aggregate mode -- only loadFull logged-in services contribute to the combined track list |
| 2 | `currentService` computed | Returns the currently selected service object (or null for 'all') |
| 2 | `isCurrentPluginLoadFull` computed | Derived from `currentService.loadFull` (true when 'all' or loadFull) |
| 2 | `currentPage` computed | Reads `pluginStore._pagePerPlugin` (accessed directly, not destructured, to preserve Pinia reactivity) |
| 2 | `totalPages` computed | Calculated from `pluginTracks.count / pageSize` |
| 3 | `onPageChange` handler | Calls `loadTrackPage(pluginId, page)` via destructured store method |
| 4 | Template `v-show="idx === 0"` | Split rendering: `v-if` for aggregate/loadFull (TrackList only), `v-else` template for non-loadFull (TrackList + Pagination) |
| 5 | `refreshTracks` | Filter only loadFull plugins in aggregate mode; for single plugin, call `loadTrackPage` for non-loadFull instead of `fetchAllTracks` |
| 6 | Import | Added `import Pagination from '../components/Pagination.vue'` |
| 6 | Destructure | Added `loadTrackPage` to the `usePluginMusic()` destructure |

### Key Design Decisions

1. **`_pagePerPlugin` NOT destructured** -- accessed as `pluginStore._pagePerPlugin` to avoid Pinia reactivity issues (reactive object mutations may not trigger computed re-evaluation through destructured references).
2. **No `watch(groundBy)`** -- the data is already loaded via `loadData` on login, so only `refreshTracks` needed the loadFull distinction.
3. **`tracksCount` unchanged** -- works correctly for both aggregate and single-plugin views since `tracks.value[plugin].count` holds the total from the API.

## Verification

- `yarn lint:fix` -- passed (only pre-existing warnings)
- `yarn format:fix` -- passed
- `yarn build:pre` -- passed (vue-tsc + vite build succeeded)

## Concerns

None.
