"use strict";

// t334u: the H.8+H.15 index links to the live H.4.1 path.
// New test; existing tests are not edited.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const panel = fs.readFileSync(path.join(root, "Panel_1_H41_Liquidity.html"), "utf8");

const ANCHOR_RE = /<a\b[^>]*>/g;

test("el único enlace interno de index.html apunta a /panel_1_h41_liquidity", function () {
  const anchors = index.match(ANCHOR_RE) || [];
  assert.equal(anchors.length, 1, "index.html must keep a single <a>");
  assert.match(anchors[0], /class="panel-link"/);
  assert.match(anchors[0], /href="\/panel_1_h41_liquidity"/);
  assert.match(anchors[0], /target="_blank"/);
  assert.equal(index.includes("Panel_1_H41_Liquidity.html"), false);
  assert.equal((index.match(/← H\.4\.1 Panel/g) || []).length, 1);
});

test("el archivo del panel y su vuelta a / se conservan", function () {
  assert.ok(panel.length > 0, "Panel_1_H41_Liquidity.html remains (pretty URL source)");
  assert.match(panel, /href="\/"/);
  assert.equal((panel.match(/href="\/panel_1_h41_liquidity"/g) || []).length, 0);
});
