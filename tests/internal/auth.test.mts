import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  InternalAccessError,
  internalTokenMatches,
  requireInternalAccess,
} from "../../lib/internal/auth.ts";

const ENV = "DMH_INTERNAL_TOKEN";
const ORIGINAL = process.env[ENV];

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env[ENV];
  } else {
    process.env[ENV] = ORIGINAL;
  }
});

describe("internal access auth", () => {
  it("matches identical tokens constant-time", () => {
    process.env[ENV] = "abc123";
    assert.equal(internalTokenMatches("abc123", process.env[ENV]), true);
    assert.doesNotThrow(() => requireInternalAccess("Bearer abc123"));
  });

  it("rejects a wrong token", () => {
    process.env[ENV] = "abc123";
    assert.equal(internalTokenMatches("wrong", process.env[ENV]), false);
    assert.throws(() => requireInternalAccess("Bearer wrong"), (error) => {
      assert.ok(error instanceof InternalAccessError);
      assert.equal((error as InternalAccessError).status, 401);
      return true;
    });
  });

  it("rejects a length-mismatched token without comparing", () => {
    process.env[ENV] = "abc123";
    assert.equal(internalTokenMatches("a", process.env[ENV]), false);
  });

  it("rejects a missing token header", () => {
    process.env[ENV] = "abc123";
    assert.throws(() => requireInternalAccess(null), (error) => {
      assert.ok(error instanceof InternalAccessError);
      assert.equal((error as InternalAccessError).status, 401);
      return true;
    });
  });

  it("rejects a non-Bearer header", () => {
    process.env[ENV] = "abc123";
    assert.throws(() => requireInternalAccess("abc123"), (error) => {
      assert.ok(error instanceof InternalAccessError);
      assert.equal((error as InternalAccessError).status, 401);
      return true;
    });
  });

  it("returns 503 when token env is not configured", () => {
    delete process.env[ENV];
    assert.throws(() => requireInternalAccess("Bearer anything"), (error) => {
      assert.ok(error instanceof InternalAccessError);
      assert.equal((error as InternalAccessError).status, 503);
      return true;
    });
  });
});
