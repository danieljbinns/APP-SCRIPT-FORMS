# FAQ & Troubleshooting

## 1. Emails not sending?

- Check `EmailUtils.gs` logs.
- Verify `Config.gs` has the correct email addresses for Specialists.
- Ensure the script has `MailApp` permissions (run `Setup.gs` -> `testEmail()` if available).

## 2. "Access Denied" on Dashboard?

- Ensure you are logging in with an allowed domain email (`team-group.com`, `robinsonsolutions.com`).
- Verify `AccessControlService.gs` logic.
- Check `Config.gs` -> `ALLOWED_DOMAINS`.

## 3. Form submission spins forever?

- Check browser console (`F12`).
- Check `View -> Executions` in Apps Script editor for server-side errors.
- Common issue: Sheet column mismatch (header name changed in Sheet but not in Code).

## 4. How to add a new Job Title?

- This is now a free-text field in `Initial Request` and editable in `HR Verification`.
- No dropdown update needed.

## 5. How to add a new Site?

- Go to `Dashboard` -> `Data Manager` -> `Add Site`.
- Or manually edit the `Reference_Sites` column in `Data_Lookup` sheet.
