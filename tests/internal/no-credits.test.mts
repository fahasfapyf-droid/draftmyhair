import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("internal optimizer credit isolation", () => {
  it("the internal generate route never consumes customer credits", () => {
    const src = read("app/api/internal/optimizer/generate/route.ts");
    assert.ok(
      src.includes("skipCredits: true"),
      "internal route must pass skipCredits: true"
    );
    assert.ok(
      !src.includes("consumeCredits"),
      "internal route must not import/use consumeCredits"
    );
    assert.ok(
      !src.includes("credit.service"),
      "internal route must not touch the credit service"
    );
  });

  it("customer credit consumption remains exclusive to the public /api/generate route", () => {
    const publicSrc = read("app/api/generate/route.ts");
    assert.ok(
      publicSrc.includes("consumeCredits"),
      "public route still owns credit consumption"
    );
    assert.ok(
      !publicSrc.includes("internal/optimizer"),
      "public route must not reference the internal optimizer"
    );
  });

  it("the credit service itself is untouched by internal features", () => {
    const creditSrc = read("lib/services/credit.service.ts");
    assert.ok(
      !creditSrc.includes("promptOverride"),
      "credit service must not know about prompt overrides"
    );
    assert.ok(
      !creditSrc.includes("skipCredits"),
      "credit service must not know about skipCredits"
    );
    assert.ok(
      !creditSrc.includes("internal"),
      "credit service must not know about internal flows"
    );
  });
});
