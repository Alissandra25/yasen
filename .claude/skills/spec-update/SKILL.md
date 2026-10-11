---
name: spec-update
description: Record a decision or deviation in docs/spec so the spec stays in sync with the code. Use when a rule was decided during development, or the code had to differ from the spec.
---

# Update the spec

1. Find the section the decision belongs to in `docs/spec/technical.md` (and `docs/spec/business.md` if it changes what the owner sees).

2. Edit that section in place. Match the existing style: short bullets, bold lead-in, the rule first and the reason after. Don't append a changelog at the end.

3. If the data model changed, update section 11 too.

4. Tell the user exactly which sections changed, and remind them that the Notion copies (EN and UA) need the same change.

Never change the spec to match a bug. If the code is wrong, fix the code.
