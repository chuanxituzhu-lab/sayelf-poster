import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { buildAwardReferenceSeed, ONLINE_LIBRARY_LIMIT } from "../src/online-library.mjs";

test("online inspiration library distills award memory into bounded source cards", async () => {
  const memory = JSON.parse(await fs.readFile(new URL("../data/award-learning-memory.json", import.meta.url), "utf8"));
  const seeds = buildAwardReferenceSeed(memory);
  assert.equal(ONLINE_LIBRARY_LIMIT, 10);
  assert.ok(seeds.length >= 5);
  assert.equal(new Set(seeds.map(item => item.id)).size, seeds.length);
  assert.ok(seeds.every(item => /^https?:\/\//.test(item.sourceUrl)));
  assert.ok(seeds.every(item => item.transfer.length > 0));
});
