#!/usr/bin/env bash
# Shared helpers for hooks. Reads the hook's JSON input once and extracts fields with node (no jq needed).

HOOK_INPUT="$(cat)"

# json_field <dot.path>  → prints the value (empty if missing)
json_field() {
  HOOK_INPUT="$HOOK_INPUT" node -e '
    const path = process.argv[1].split(".");
    let v = JSON.parse(process.env.HOOK_INPUT || "{}");
    for (const p of path) v = v == null ? undefined : v[p];
    process.stdout.write(v == null ? "" : String(v));
  ' "$1"
}

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# rel_path <abs-or-rel path> → path relative to the project root
rel_path() {
  local p="$1"
  printf '%s' "${p#"$PROJECT_DIR"/}"
}
