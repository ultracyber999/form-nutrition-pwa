# Physical iPhone acceptance checklist

Status: NOT RUN. Complete this checklist on the owner's physical iPhone before personal daily-use beta. Use synthetic data until backup/restore has been proven at the final origin.

## Preconditions

- FORM is deployed once to the final stable trusted HTTPS origin; hostname/port will not change.
- Deployment protection is enabled and the owner can access it in Safari.
- A backup/export mechanism is available on a second device or computer for comparison.
- No real health records are entered during initial acceptance.

## First launch and installability

- [ ] Open the exact final HTTPS origin in Safari; Hebrew RTL renders without certificate, mixed-content or console-visible deployment errors.
- [ ] Add to Home Screen; icon, title, launch viewport, safe areas and theme are acceptable.
- [ ] Close all app instances and relaunch from the Home Screen; the shell loads while online.

## Synthetic golden slice and persistence

- [ ] Complete onboarding with synthetic profile data.
- [ ] Add 180 g cooked chicken; verify 297 kcal and 55.8 g protein.
- [ ] Force-close/reopen the installed app; the entry and totals persist.
- [ ] Export a backup; reinstall or clear only in a controlled test after the backup is externally saved; restore and verify identical totals.
- [ ] Edit the food quantity and verify day completion invalidates rather than approving a stale log.

## Offline/update/rollback

- [ ] Warm the service worker online, enable airplane mode, relaunch, write a synthetic entry, close/reopen, and verify persistence.
- [ ] Disable airplane mode and confirm the app recovers without data loss.
- [ ] Deploy a harmless build update at the same origin; verify update activation and existing data retention.
- [ ] Roll back to the prior deployment; verify schema compatibility and data retention.
- [ ] Verify a failed/broken deployment does not remove the previous working shell or local data.

## Backup/import safety

- [ ] Export an external JSON backup before any destructive import.
- [ ] Perform a replace-all import with synthetic data; confirm the pre-import backup recovery control exists.
- [ ] Restore the pre-import backup end-to-end and verify original synthetic records return.
- [ ] Confirm externally downloaded backup files can be validated and restored.
- [ ] Understand and accept that IndexedDB internal backups remain vulnerable to browser storage eviction; external exports remain essential.

## Accessibility and ergonomics

- [ ] VoiceOver reads key Today, Nutrition, Check-in, Progress, Coach and Settings controls in a sensible Hebrew order.
- [ ] Dynamic type / 200% text scaling and zoom do not trap or obscure primary workflows.
- [ ] Reduced motion is respected.
- [ ] Touch targets are comfortably operable one-handed; safe areas do not cover bottom navigation/actions.
- [ ] Mixed Hebrew/numeric values are readable and not visually mirrored incorrectly.
- [ ] Dark and light themes have acceptable contrast in real lighting.

## Time/safety behavior

- [ ] Keep the app open across midnight; the default Today date rolls over after foreground/resume.
- [ ] Change the profile timezone only in a synthetic test and verify date behavior intentionally.
- [ ] Pause the goal and verify the coach cannot suggest calorie reduction.
- [ ] Enter concerning symptoms in check-in and verify coach safety review plus urgent-care guidance; then clear/resolve the synthetic state.
- [ ] Repeated low energy/high hunger produces recovery review rather than reduction.

## Acceptance decision

- [ ] Storage-quota/browser-eviction risk has either been tested as far as practical or explicitly accepted.
- [ ] No real personal data will be entered until all required boxes above are checked or consciously waived in writing.
- [ ] Unrestricted production remains NO-GO regardless of private acceptance.
