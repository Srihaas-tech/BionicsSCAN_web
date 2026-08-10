import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from "../src/lib/auth-token";

const secret = "0123456789abcdef0123456789abcdef";
const now = 1_700_000_000_000;

test("password comparison accepts only the configured password", () => {
  assert.equal(verifyPassword("correct horse battery staple", "correct horse battery staple"), true);
  assert.equal(verifyPassword("incorrect", "correct horse battery staple"), false);
});

test("session tokens expire and reject tampering", () => {
  const token = createSessionToken(secret, 1, now);
  assert.equal(verifySessionToken(token, secret, now + 30_000), true);
  assert.equal(verifySessionToken(token, secret, now + 3_600_001), false);
  assert.equal(verifySessionToken(`${token}x`, secret, now + 30_000), false);
  assert.equal(verifySessionToken(token, `${secret}x`, now + 30_000), false);
});
