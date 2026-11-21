# HomeSpace Mobile App Instructions

## Engineering standards

- Preserve business invariants, public contracts and backward compatibility. Keep authentication, authorization, input validation and error handling intact.
- Protect secrets and sensitive data in code, commits, tests, logs and reports. Treat third-party hooks as untrusted until reviewed and explicitly authorized.
- Change production configuration, deploy or run destructive data operations only when explicitly authorized for the target environment.
- Keep review tasks read-only unless the developer requests fixes.

## Execution policy

- **FAST** is the default for a small fix, one API, a simple UI or configuration change, or a limited refactor. Start as soon as the scope is clear. Use the fewest useful calls, with a soft ceiling of roughly 8–12 in normal conditions.
- **STANDARD** fits multi-file features, API contract changes, broader refactors and hard-to-reproduce bugs. Make a short plan, inspect affected dependencies and verify in one focused round after editing.
- **DEEP** is required for significant security, authentication, authorization, payment, deposit, transaction, contract lifecycle, migration, architecture or incident risk. Identify the relevant invariants and verify the affected boundaries, including failure and denied cases where applicable. Escalate by risk even for small changes.

### Work and tools

- Identify the goal and smallest correct scope. Read the directly affected files, then check callers or dependencies when the change can affect them. Plan mentally or in a few lines for complex work, then execute.
- Give each tool call a purpose that advances the request or reduces a real risk. Batch independent reads and search exact paths or symbols. Reuse results when inputs are unchanged. Skip full repo scans, subagents and independent review passes for routine tasks.
- For a small review, stop at the requested diff when it establishes the findings. Inspect callers, test setup or runtime behavior only if a material finding depends on evidence missing from that diff.
- **No repeated verification without new evidence.** Repeat a read, search or check only when relevant inputs changed, an error or conflicting evidence appeared, or a required risk check remains. If two investigation attempts yield no useful evidence, change approach or stop that investigation.
- Make routine technical decisions independently. Ask when essential information is missing or the action requires authorization. Reuse existing code and patterns, protect user changes, and keep edits and dependencies within scope.

### Git and validation

- Run `git status --short` at most once at the start if needed to identify existing edits, and once at the end if needed to report files. Inspect the scoped diff once when useful. Use `git diff --stat` only to summarize scope and `git diff --check` at most once at the end when applicable. Reuse existing evidence for the same Git state. Recheck affected state for new errors, conflicts or concrete risk. Commit, reset, clean, checkout or discard only when requested.
- Normally validate once after editing with the smallest relevant test or compiler check. Skip full builds for small changes. Expand checks when evidence or risk warrants it. On failure, distinguish code from environment causes, diagnose and rerun only the affected check after a relevant change. Reuse test output already returned. If a check is blocked, use a permitted alternative only when the evidence is necessary, or report the blocker.

### Stop and report

Stop when the request and acceptance criteria are met, required checks are complete and concrete in-scope issues are resolved. Skip speculative optimization, unrelated refactors and automatic chains of review, audit or verification. Report **Completed**, **Validation** and **Notes** when needed. List only checks actually run and state material limits or remaining risks.

## Theme and dialogs

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
- Run `npm run test:theme` for affected theme tokens or semantic styling. Run `npm run typecheck` when TypeScript behavior or component contracts can change.
- Use `useDialog` from `src/components/AppDialog.tsx` for app notifications,
  confirmations, and choices; do not add native `Alert.alert` dialogs to the UI.

## Skills

Use mobile-ui-review for an explicit review in the scope described by the skill.
