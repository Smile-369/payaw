# PAYAW GM Password Authentication Hotfix

The GM login no longer calls Supabase `signInWithOtp()`. The hosted-room panel now provides:

- **Sign in** using an existing email/password account.
- **Create account** using Supabase email/password sign-up.
- Player links continue to use isolated anonymous sessions and do not require passwords.

## Required Supabase setting

To create the GM account without sending confirmation email, disable **Confirm email** for the email provider in Supabase Authentication settings. If confirmation remains enabled, Supabase can still send an account-confirmation message during sign-up.

Existing magic-link-only users may need to be deleted/recreated as password users in Supabase Authentication, or use a different GM email for the new account.
