import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  InternalAccessError,
  requireInternalAccess,
} from "../../lib/internal/auth.ts";
import { resolveOptimizerResultAccess } from "../../lib/internal/optimizer-result.ts";

const ENV = "DMH_INTERNAL_TOKEN";
const ORIGINAL = process.env[ENV];

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env[ENV];
  } else {
    process.env[ENV] = ORIGINAL;
  }
});

const SYSTEM_USER = "sys-user-42";
const CUSTOMER_USER = "customer-9";

function internalRow(overrides: Partial<{
  userId: string;
  status: string;
  resultStorageKey: string | null;
}> = {}) {
  return {
    userId: SYSTEM_USER,
    status: "COMPLETED",
    resultStorageKey: "blobs/optimizer/abc123.png",
    ...overrides,
  };
}

describe("internal optimizer result access", () => {
  it("an internal token can retrieve a completed optimizer result", () => {
    process.env[ENV] = "tok-123";
    assert.doesNotThrow(() => requireInternalAccess("Bearer tok-123"));

    const decision = resolveOptimizerResultAccess(
      internalRow(),
      SYSTEM_USER
    );
    assert.equal(decision.ok, true);
  });

  it("a missing or wrong token cannot retrieve a result", () => {
    process.env[ENV] = "tok-123";
    assert.throws(() => requireInternalAccess(null), (error) =>
      error instanceof InternalAccessError &&
      (error as InternalAccessError).status === 401);
    assert.throws(() => requireInternalAccess("Bearer wrong"), (error) =>
      error instanceof InternalAccessError &&
      (error as InternalAccessError).status === 401);
  });

  it("a non-completed generation cannot be downloaded", () => {
    for (const status of ["QUEUED", "PROCESSING", "FAILED", "CANCELLED"]) {
      const decision = resolveOptimizerResultAccess(
        internalRow({ status }),
        SYSTEM_USER
      );
      assert.equal(decision.ok, false);
      assert.equal((decision as { status: number }).status, 409);
    }
  });

  it("a normal customer generation cannot be downloaded through the optimizer result endpoint", () => {
    // Same shape, completed, with an artifact — but owned by a customer.
    const decision = resolveOptimizerResultAccess(
      internalRow({ userId: CUSTOMER_USER }),
      SYSTEM_USER
    );
    assert.equal(decision.ok, false);
    assert.equal((decision as { status: number }).status, 404);

    // Unknown generation: also 404, indistinguishable from the customer case.
    const unknown = resolveOptimizerResultAccess(null, SYSTEM_USER);
    assert.equal(unknown.ok, false);
    assert.equal((unknown as { status: number }).status, 404);
  });

  it("fails closed when the internal system user is not configured", () => {
    const decision = resolveOptimizerResultAccess(
      internalRow(),
      undefined
    );
    assert.equal(decision.ok, false);
    assert.equal((decision as { status: number }).status, 503);
  });

  it("rejects a completed generation without a stored artifact", () => {
    const decision = resolveOptimizerResultAccess(
      internalRow({ resultStorageKey: null }),
      SYSTEM_USER
    );
    assert.equal(decision.ok, false);
    assert.equal((decision as { status: number }).status, 409);
  });
});
