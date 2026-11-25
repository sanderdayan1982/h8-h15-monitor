"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const toml = fs.readFileSync(path.join(__dirname, "..", "netlify.toml"), "utf8");

test("Netlify ignora commits de solo datos (t388u)", function () {
  assert.match(toml, /ignore\s*=/);
  assert.match(toml, /\$CACHED_COMMIT_REF \$COMMIT_REF/);
  assert.match(toml, /\*\.html/);
  assert.match(toml, /netlify\.toml/);
});
