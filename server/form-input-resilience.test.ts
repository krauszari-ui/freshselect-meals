import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "client/src/components");
const dobPickerSource = readFileSync(resolve(root, "DobPicker.tsx"), "utf8");
const signaturePadSource = readFileSync(resolve(root, "SignaturePad.tsx"), "utf8");

describe("form input resilience", () => {
  it("resynchronizes the date picker when the parent record value changes", () => {
    expect(dobPickerSource).toContain("}, [value]);");
    expect(dobPickerSource).not.toContain('}, [value === "" ? "" : null]);');
  });

  it("captures the live signature before resizing clears the canvas", () => {
    expect(signaturePadSource).toContain('const liveSignature = pad.isEmpty() ? "" : pad.toDataURL("image/jpeg", 0.5);');
    expect(signaturePadSource).toContain("const signatureToRestore = liveSignature || value;");
    expect(signaturePadSource.indexOf("const liveSignature")).toBeLessThan(signaturePadSource.indexOf("canvas.width = width * ratio"));
  });
});
