# PAYAW Dice Tray Opaque Hotfix

The Player View dice tray now uses dedicated `player-dice-dialog` and `player-dice-panel` classes. Its window, roll result, and history surfaces are explicitly opaque and cannot inherit transparency from generic utility panels.

The dependency-independent static build now copies `player.css`, selects the correct route stylesheet through `route-styles.js`, adds a cache-busting query string, and removes dynamic CSS imports that browsers cannot execute directly.
