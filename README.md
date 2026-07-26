# PAYAW build-path fix

The TypeScript errors referencing `src/src/...` and `src/supabase/...` mean a previous full-project ZIP was extracted **inside the real `src` folder**.

## Correct layout

```text
PAYAW repository root/
  package.json
  src/
    netcode/GmNetcodePanel.ts
    ui/ms21.css
  supabase/
```

There must not be a second `src/src` directory, and `supabase` must remain at the repository root—not under `src`.

## Apply

1. Extract this ZIP into the repository root, beside `package.json`.
2. Open PowerShell in that repository root.
3. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\fix-payaw-build.ps1
pnpm run build
```

The `TS7006` errors in `GmNetcodePanel.ts` are cascading errors from the broken nested imports. They disappear when the duplicate nested project is removed.
