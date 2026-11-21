---
name: mobile-ui-review
description: Review HomeSpace Expo screen or component changes for NativeWind theme consistency, accessible interactions and existing app dialog behavior. Use when a mobile UI review is requested.
disable-model-invocation: true
---

# Mobile UI Review

Review the requested diff and the affected components. Consult the theme section of `README.md` and the rules in `AGENTS.md`.

1. Check text, surfaces, controls and state styling with both light and dark themes. Use the existing semantic classes. When checking a new token, trace its definition in both themes in `global.css` and its mapping in `tailwind.config.js`.
2. Check shared theme selection, themed icons, inputs and loading indicators. Inspect loading, empty and error behavior where the screen presents remote data.
3. Check touch targets, accessible labels and keyboard interactions relevant to the changed screen. Confirm alerts, confirmations and choices use `src/components/AppDialog.tsx` through `useDialog`.
4. After inspecting the diff, use `npm run typecheck` and `npm run test:theme` for affected UI or theme behavior. Keep the review read-only and leave device or emulator verification to an explicitly requested run.

Report defects with file locations and affected interactions. State which theme and device behavior still needs runtime evidence.
