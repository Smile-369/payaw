# PAYAW Milestone 16.2 — NPC Visibility and Live Clock

## NPC map visibility

NPC markers now have a dedicated toolbar button, the existing Layer Manager checkbox, the NPC category-menu checkbox, and an NPC-panel checkbox. Every control synchronizes through the canonical `npc-layer` input. The `N` keyboard shortcut toggles the layer.

## Live real-time clock

The map toolbar displays the browser's live local time and updates once per second. Clicking it switches between 12-hour and 24-hour display formats. The preference is saved in local storage.

The clock divides the day into NPC schedule periods:

- Morning: 05:00–08:59
- Day: 09:00–17:59
- Evening: 18:00–21:59
- Night: 22:00–04:59

When the period changes, NPC marker positions move to their corresponding generated schedule locations. Travel-calculator NPC endpoints, inspector selection, focus controls, and NPC cards use the current location.
