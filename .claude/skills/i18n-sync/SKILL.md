---
name: i18n-sync
description: Find and fill missing or unused translation keys across messages/en.json, uk.json and ru.json. Use after adding UI text or when the i18n check fails.
---

# Sync translations

1. Run `node scripts/i18n-check.mjs`. It lists keys missing in each locale and keys present in only one locale.

2. For each missing key, add a translation:
   - `en` is the reference wording.
   - `uk` and `ru`: natural, short UI language, not word-for-word. Keep placeholders (`{count}`, `{name}`) and ICU plural forms exactly; Ukrainian and Russian need `one`, `few`, `many`, `other`.
   - Keep the same nesting and key order as `en.json`.

3. If a key is unused in the code, ask before deleting it.

4. Re-run the check until it reports nothing missing.

Domain terms to keep consistent: stock = залишок / остаток; goods receipt = надходження / поступление; transfer = переміщення / перемещение; stocktake = інвентаризація / инвентаризация; restock list = список на докупівлю / список на дозакупку; supplier = постачальник / поставщик.
