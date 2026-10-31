# Mobile theme

- Define app colors only in `global.css`, in both `:root` and `.dark:root`.
- Screens and components must use semantic classes from `tailwind.config.js`:
  `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`,
  `text-primary`, `bg-brand`, `text-on-brand`, and the status tokens.
- Do not add literal colors or Tailwind palette colors to UI files. See the
  Theme section in `README.md` for background/foreground pairings.
- Use `@/components/Icon` for themed Ionicons and `placeholder:text-subtle`
  for text inputs. NativeWind resolves `ActivityIndicator` text color to its
  native `color` prop.
- Keep theme selection in `ThemeProvider`; do not create per-screen theme state.
- Run `npm run typecheck` and `npm run test:theme` after theme/UI changes.
- Use `useDialog` from `src/components/AppDialog.tsx` for app notifications,
  confirmations, and choices; do not add native `Alert.alert` dialogs to the UI.
