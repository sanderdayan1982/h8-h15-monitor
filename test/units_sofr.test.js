"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const h41 = fs.readFileSync(path.join(root, "Panel_1_H41_Liquidity.html"), "utf8");
const h8 = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "falta " + name);
  let depth = 0;
  let seen = false;
  for (let i = src.indexOf("{", start); i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") { depth++; seen = true; }
    else if (ch === "}") {
      depth--;
      if (seen && depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("función sin cerrar: " + name);
}

/* Impresos FRED del 2026-11-04, en la unidad nativa de cada serie. */
const FRED_2026_11_04 = {
  WALCL: 6748145,
  WTREGEN: 957175,
  WRESBAL: 2930088,
  RRPONTTLD: 0.225
};

test("unidad y factor de cada serie, y Net Liquidity en torno a 5,8T", function () {
  const units = h41.match(/var UNITS=\{([^}]+)\}/);
  assert.ok(units, "UNITS ausente");
  const factor = Object.fromEntries(units[1].split(",").map(function (pair) {
    const parts = pair.split(":");
    return [parts[0], Number(parts[1])];
  }));
  assert.equal(factor.WALCL, 1);
  assert.equal(factor.WTREGEN, 1);
  assert.equal(factor.WRESBAL, 1);
  assert.equal(factor.RRPONTTLD, 1000);
  assert.match(h41, /WALCL, WTREGEN, WRESBAL, TREAST, WSHOMCB and WLCFLPCL in \$Millions/);
  assert.match(h41, /only RRPONTTLD is in \$Billions/);

  assert.match(h8, /H8B3094NCBA viene en \$ millones/);
  const h8units = h8.match(/var H8_TO_B=\{([^}]+)\}/);
  assert.ok(h8units);
  const h8factor = Object.fromEntries(h8units[1].split(",").map(function (pair) {
    const parts = pair.split(":");
    return [parts[0], Number(parts[1])];
  }));
  assert.equal(h8factor.H8B3094NCBA, 0.001);

  const DATA = {};
  Object.keys(FRED_2026_11_04).forEach(function (k) {
    const v = FRED_2026_11_04[k] * factor[k];
    DATA[k] = [{ date: "2026-11-04", value: v }];
  });
  const ctx = { DATA: DATA, NL_SERIES: null };
  vm.runInNewContext(
    extractFunction(h41, "findClosest") + "\n" +
    extractFunction(h41, "computeNetLiquidity") + "\n" +
    "computeNetLiquidity();",
    ctx
  );
  const nlBillions = ctx.NL_SERIES.values[0];
  const nlUsd = nlBillions * 1e9;
  assert.ok(nlUsd > 5.5e12 && nlUsd < 6.1e12, "NL=" + nlUsd);
  assert.equal(nlBillions, (6748145 - 957175 - 225) / 1000);
});

test("SOFR−IORB solo en la última fecha común", function () {
  const ctx = {};
  vm.runInNewContext(
    extractFunction(h41, "commonRateSeries") + "\n" +
    extractFunction(h41, "lastCommonRates") + "\n" +
    "this.lastCommonRates=lastCommonRates; this.commonRateSeries=commonRateSeries;",
    ctx
  );
  const sofr = [
    { date: "2026-11-09", value: 3.88 },
    { date: "2026-11-10", value: 4.50 }
  ];
  const iorb = [
    { date: "2026-11-10", value: 3.90 },
    { date: "2026-11-12", value: 1.00 }
  ];
  const hit = ctx.lastCommonRates(sofr, iorb);
  assert.equal(hit.date, "2026-11-10");
  assert.equal(hit.sofr, 4.50);
  assert.equal(hit.iorb, 3.90);
  assert.notEqual(Math.round((sofr[1].value - iorb[1].value) * 100), Math.round((hit.sofr - hit.iorb) * 100));

  const shuffled = ctx.lastCommonRates(sofr.slice().reverse(), iorb.slice().reverse());
  assert.equal(shuffled.date, "2026-11-10");

  assert.equal(ctx.lastCommonRates(
    [{ date: "2026-11-09", value: 3.88 }],
    [{ date: "2026-11-12", value: 3.90 }]
  ), null);
  assert.equal(ctx.commonRateSeries(
    [{ date: "2026-11-09", value: 3.88 }, { date: "2026-11-11", value: 4 }],
    [{ date: "2026-11-09", value: 3.90 }, { date: "2026-11-12", value: 1 }]
  ).map(function (p) { return p.date; }).join(","), "2026-11-09");

  const live = ctx.lastCommonRates(
    [{ date: "2026-11-09", value: 3.88 }],
    [{ date: "2026-11-09", value: 3.90 }, { date: "2026-11-12", value: 3.90 }]
  );
  assert.equal(live.date, "2026-11-09");
  assert.equal(Math.round((live.sofr - live.iorb) * 100), -2);

  assert.match(h41, /spEl\.textContent=spStatus\+" · "\+common\.date/);
  assert.equal(h41.includes("last(DATA.SOFR)"), false);
  assert.equal(h41.includes("findClosest(iorbMap"), false);
});
