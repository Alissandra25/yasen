import { describe, expect, it } from "vitest";
import { pickLogoAsset, type StoredLogoAsset } from "./logo";

function asset(
  slot: StoredLogoAsset["slot"],
  theme: StoredLogoAsset["theme"],
): StoredLogoAsset {
  return {
    slot,
    theme,
    image: Buffer.from(`${slot}-${theme}`),
    mimeType: "image/png",
  };
}

describe("pickLogoAsset", () => {
  it("returns null when nothing is uploaded", () => {
    expect(pickLogoAsset([], "mark", "light")).toBeNull();
  });

  it("uses the exact match when the full set is prepared", () => {
    const assets = [
      asset("mark", "light"),
      asset("mark", "dark"),
      asset("lockup", "light"),
      asset("lockup", "dark"),
    ];

    const result = pickLogoAsset(assets, "mark", "dark");

    expect(result).toEqual({
      image: Buffer.from("mark-dark"),
      mimeType: "image/png",
      needsCrop: false,
      needsBackingPlate: false,
    });
  });

  it("crops the same-theme lockup before borrowing the other theme's mark", () => {
    // Only a dark lockup and a light mark exist; the dark lockup is the better source for a
    // dark mark (same theme, just needs cropping) than the light mark (wrong theme).
    const assets = [asset("mark", "light"), asset("lockup", "dark")];

    const result = pickLogoAsset(assets, "mark", "dark");

    expect(result).toEqual({
      image: Buffer.from("lockup-dark"),
      mimeType: "image/png",
      needsCrop: true,
      needsBackingPlate: false,
    });
  });

  it("falls back to the light mark with a backing plate when only light exists", () => {
    const assets = [asset("mark", "light")];

    const result = pickLogoAsset(assets, "mark", "dark");

    expect(result).toEqual({
      image: Buffer.from("mark-light"),
      mimeType: "image/png",
      needsCrop: false,
      needsBackingPlate: true,
    });
  });

  it("needs both crop and backing plate for the single-upload case", () => {
    // The stage-4 "one casual photo" case: only a light lockup exists, and a dark mark is asked for.
    const assets = [asset("lockup", "light")];

    const result = pickLogoAsset(assets, "mark", "dark");

    expect(result).toEqual({
      image: Buffer.from("lockup-light"),
      mimeType: "image/png",
      needsCrop: true,
      needsBackingPlate: true,
    });
  });

  it("never falls back from lockup to mark, only across theme", () => {
    // A cropped square can't become a wordmark lockup, so a mark-only upload should resolve to
    // nothing for a lockup request, not the mark.
    const assets = [asset("mark", "light"), asset("mark", "dark")];

    expect(pickLogoAsset(assets, "lockup", "dark")).toBeNull();
  });

  it("falls back to the light lockup when only light is uploaded", () => {
    const assets = [asset("lockup", "light")];

    const result = pickLogoAsset(assets, "lockup", "dark");

    expect(result).toEqual({
      image: Buffer.from("lockup-light"),
      mimeType: "image/png",
      needsCrop: false,
      needsBackingPlate: true,
    });
  });
});
