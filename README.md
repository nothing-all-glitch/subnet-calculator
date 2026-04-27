# Interactive Subnet Calculator

An interactive IPv4 subnetting web app focused on visual bit-level learning and practical VLSM planning.

## Features

- 32-bit interactive grid grouped by octets
- Dual-layer bit interaction:
  - Value zone toggles bit `0/1`
  - Role zone toggles bit role (`Network` vs `Host`) with contiguous mask enforcement
- Live CIDR boundary movement with network/host highlighting
- Real-time subnet details:
  - Subnet mask, network, broadcast, first/last usable, usable host count
- VLSM allocator for host lists like `64,45,14,9,2`
- Dark dashboard theme with animated visual feedback

## Scripts

- `npm run dev` — start local development server
- `npm run build` — type-check + production build
- `npm run preview` — preview built app
- `npm run test` — run tests in watch mode
- `npm run test:run` — run full test suite once
- `npm run test:run -- subnetEngine` — run a single test file pattern

## Architecture

- `src/utils/ipMath.ts` — pure IPv4/CIDR math helpers
- `src/utils/subnetEngine.ts` — host parsing and VLSM allocation engine
- `src/App.vue` — interactive UI (bit grid, live subnet panel, VLSM table)
- `src/types/subnet.ts` — shared domain types

The UI is intentionally thin; all subnet logic is implemented in pure utility functions so behavior is deterministic and testable.

## Deployment

- **GitHub Pages**: workflow at `.github/workflows/deploy-pages.yml`
- **Vercel**: `vercel.json` included for Vite framework detection
