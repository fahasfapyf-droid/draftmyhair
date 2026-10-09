import test from "node:test";
import assert from "node:assert/strict";
import { assertFreshChatTransition, freshChat } from "./gemini-page.ts";

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

class MockLocator {
  constructor(page, kind, count = 1) {
    this.page = page;
    this.kind = kind;
    this.availableCount = count;
  }
  async count() { return this.availableCount; }
  nth() { return this; }
  async isVisible() {
    if (this.kind === "composer") return this.page.composerVisible;
    return true;
  }
  async click() {
    if (this.kind === "new-chat" && this.page.changesRoute) {
      this.page.currentUrl = "https://gemini.google.com/app/new-conversation";
    }
  }
}

class MockGeminiPage {
  constructor({ changesRoute = true, composerVisible = true, priorUserMessages = 0 } = {}) {
    this.currentUrl = "https://gemini.google.com/app/old-conversation";
    this.changesRoute = changesRoute;
    this.composerVisible = composerVisible;
    this.priorUserMessages = priorUserMessages;
  }
  url() { return this.currentUrl; }
  async waitForTimeout() {}
  getByRole(role, options = {}) {
    if (role === "button" && /new chat|new conversation/i.test(String(options.name ?? ""))) {
      return new MockLocator(this, "new-chat");
    }
    return new MockLocator(this, "missing", 0);
  }
  locator(selector) {
    if (/user-query|data-message-author-role/i.test(selector)) {
      return new MockLocator(this, "messages", this.priorUserMessages);
    }
    if (/textarea|contenteditable/i.test(selector)) {
      return new MockLocator(this, "composer", this.composerVisible ? 1 : 0);
    }
    return new MockLocator(this, "missing", 0);
  }
}

test("freshChat clicks New chat, verifies route transition, composer, and empty user-message state", async () => {
  const page = new MockGeminiPage();
  await assert.doesNotReject(() => freshChat(page));
  assert.equal(page.url(), "https://gemini.google.com/app/new-conversation");
});

test("freshChat fails closed if New chat does not change the route", async () => {
  const page = new MockGeminiPage({ changesRoute: false });
  await assert.rejects(() => freshChat(page), /route did not change/);
});

test("freshChat fails closed if the composer is not visible", async () => {
  const page = new MockGeminiPage({ composerVisible: false });
  await assert.rejects(() => freshChat(page), /Required Gemini control not found/);
});

test("freshChat fails closed if prior user-message elements remain", async () => {
  const page = new MockGeminiPage({ priorUserMessages: 1 });
  await assert.rejects(() => freshChat(page), /prior user-message elements remain/);
});
