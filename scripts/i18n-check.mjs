#!/usr/bin/env node
// Compares translation keys across messages/<locale>.json and reports missing ones.
// Exit code 1 if any locale is missing keys.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOCALES = ["en", "uk", "ru"];
const dir = join(process.cwd(), "messages");

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const keys = Object.fromEntries(
  LOCALES.map((l) => [l, new Set(flatten(JSON.parse(readFileSync(join(dir, `${l}.json`), "utf8"))))]),
);
const all = new Set(LOCALES.flatMap((l) => [...keys[l]]));

let missingTotal = 0;
for (const l of LOCALES) {
  const missing = [...all].filter((k) => !keys[l].has(k)).sort();
  if (missing.length) {
    missingTotal += missing.length;
    console.log(`\n${l}: ${missing.length} missing`);
    for (const k of missing) console.log(`  - ${k}`);
  }
}

if (missingTotal) {
  console.log(`\n${missingTotal} missing translation(s).`);
  process.exit(1);
}
console.log(`All ${all.size} keys present in ${LOCALES.join(", ")}.`);
