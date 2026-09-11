# Shared interface components

Use these components for the existing product flows. Keep their interaction and
surface styles in the owning component rather than adding page-specific copies.

| Purpose | Owner | Behavior |
| --- | --- | --- |
| Filters, view, workspace, account, and board settings | `AppDrawer` | Owns opening, dismissal, background locking, focus, and the mobile viewport adapter. |
| Floating selection and filter toolbars | `SelectionPanel` | A nonmodal toolbar. It does not wrap or manage drawers. |
| Confirmation | `AppDialog` | Uses the native modal dialog and its cancellation behavior. |
| Floating placement | `AppPopover` | Fits the visible viewport, flips when needed, and provides menu opening/focus behavior. |
| Actions and choices | `AppDropdownMenu` | Owns menu dimensions, spacing, row appearance, selection state, and keyboard navigation. |
| Role choices with descriptions | `AppRolePicker` | Adds option content to the shared menu; does not redefine its surface. |
| People and roles | `AppPersonRow` | An empty options list produces a read-only role label. |
| Input with a submit action | `AppInlineActionField` | Uses the shared `panel-field` input styling and form submission. |

## Interaction rules

- Drawers use `open`, `close`, `dismissible`, and `afterLeave`. Do not route a
  drawer through `SelectionPanel` or add a second viewport listener in its page.
- Only the top drawer handles Escape and wraps Tab. A nested menu or native
  confirmation handles its own dismissal first. Hidden and disabled controls are
  excluded from focus navigation.
- Menu width is content-driven, with the trigger as a minimum and the visible
  viewport as a maximum. A numeric width is reserved for controls such as the
  calendar. There is no separate "anchor" sizing mode or mobile minimum width.
- Arrow Down, Enter, and Space open a menu and focus its first available item;
  Arrow Up opens it at the last item. Escape returns to the trigger. Tab closes
  the menu and moves to the adjacent control in its containing interface.
- `AppDropdownMenu` owns the row radius, padding, focus ring, and selected state.
  Content classes can arrange descriptions, but should not change the menu's
  width, clipping, shadow, or outer radius.
- Shared text fields retain native input semantics, use the existing focus
  token, and keep the mobile ring inside the field's scroll boundary.

## Product destinations

- Boards open in `/library?board=…`; member and board settings use `panel=settings`.
- Portfolio editing opens in `/portfolio?view=details&portfolio=…`.
- `/boards/:id` is a compatibility redirect, not a second settings or review UI.
- Workspace roles are managed in workspace settings; your own role is read-only.
- Empty-member messages appear only after the member request succeeds.

## Verification and limits

The consolidation passed 47 web tests, TypeScript, and the production build. Lint
reported no errors. A Chromium desktop
fixture using the actual components verified menu sizing, opening focus,
Tab/Escape, and nested drawer dismissal. The final native-dialog browser check
and mobile browser checks were not completed.

Before changing mobile keyboard behavior again, verify on an iPhone: open a
sheet, focus a lower input, switch between inputs, dismiss the keyboard, scroll,
and close/reopen the sheet. Mocked viewport tests do not establish how Safari's
keyboard animation feels. The keyboard changes that were explicitly undone
remain undone.

The video editor's internal panels are still specialized for its canvas layout.
This pass consolidates its outer drawer but does not change those internal
gestures or claim they have been verified on iOS.
