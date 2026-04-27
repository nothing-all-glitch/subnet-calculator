# Copilot Instructions

## Build, test, and lint

- Install dependencies: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Test suite (watch): `npm run test`
- Test suite (single run): `npm run test:run`
- Single test file/pattern: `npm run test:run -- subnetEngine`

## High-level architecture

- `src/App.vue` is the interactive shell that coordinates input parsing, bit-grid interaction, and live displays.
- `src/utils/ipMath.ts` contains pure IPv4/CIDR operations (parse, bit conversion, network/broadcast/usable ranges).
- `src/utils/subnetEngine.ts` contains VLSM-specific logic (host list parsing, block sizing, sorted allocation, next-start progression).
- `src/types/subnet.ts` defines typed contracts shared between UI and calculation engine.

Key behavior flows:
- CIDR input or bit toggles update the same source-of-truth bit array + prefix.
- CIDR boundary is represented as prefix length and enforced contiguously (network bits left, host bits right).
- VLSM allocations are computed from the current network context and sorted host requirements.

## Key conventions

- Keep subnet math pure and framework-agnostic inside `src/utils/`; avoid embedding calculation logic directly in template markup.
- Preserve contiguous mask behavior when changing bit roles: role toggles move prefix boundary rather than creating sparse masks.
- Treat host requirements as usable-host counts for VLSM sizing; allocate descending by size and advance with broadcast+1.
- Keep deployment static-first and compatible with both GitHub Pages and Vercel.
