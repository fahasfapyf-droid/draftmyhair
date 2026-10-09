import test from "node:test";
import assert from "node:assert/strict";
import { assertFreshChatTransition } from "./gemini-page.ts";

test("accepts a same-origin transition from an existing conversation to /app", () => {
  assert.doesNotThrow(() => assertFreshChatTransition(
    "https://gemini.google.com/app/old-conversation",
    "https://gemini.google.com/app",
  ));
});

test("accepts a transition between two distinct conversation routes", () => {
  assert.doesNotThrow(() => assertFreshChatTransition(
    "https://gemini.google.com/app/old-conversation",
    "https://gemini.google.com/app/new-conversation",
  ));
});

test("rejects an unchanged route even if the composer might be visible", () => {
  assert.throws(() => assertFreshChatTransition(
    "https://gemini.google.com/app/old-conversation",
    "https://gemini.google.com/app/old-conversation",
  ), /route did not change/);
});

test("rejects unexpected origins", () => {
  assert.throws(() => assertFreshChatTransition(
    "https://gemini.google.com/app/old-conversation",
    "https://example.com/app",
  ), /origin changed unexpectedly/);
});

test("rejects leaving the Gemini app route", () => {
  assert.throws(() => assertFreshChatTransition(
    "https://gemini.google.com/app/old-conversation",
    "https://gemini.google.com/settings",
  ), /unexpected route/);
});
