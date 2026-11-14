"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const h41 = fs.readFileSync(path.join(root, "Panel_1_H41_Liquidity.html"), "utf8");

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

function load(names) {
  const ctx = {};
  vm.runInNewContext(
    names.map(function (name) { return extractFunction(h41, name); }).join("\n") +
    "\nthis.api={};" +
    names.map(function (name) { return "this.api." + name + "=" + name + ";"; }).join("\n"),
    ctx
  );
  return ctx.api;
}

test("A3 la liquidez neta exige la misma fecha en WALCL, TGA y RRP", function () {
  const api = load([
    "findClosest",
    "computeNetLiquidity",
    "computeWeeklyChanges",
    "formatNlComponentDates",
    "nlWeeklyState",
    "nlHistoryDelta"
  ]);

  assert.equal(api.findClosest({ "2026-11-10": 152 }, "2026-11-11"), null);
  assert.equal(api.findClosest({ "2026-11-11": 0 }, "2026-11-11"), 0);
  assert.equal(api.findClosest(null, "2026-11-11"), null);

  const ctx = {
    DATA: {
      WALCL: [
        { date: "2026-10-28", value: 6745635 },
        { date: "2026-11-04", value: 6748145 },
        { date: "2026-11-11", value: 6758867 },
        { date: "2026-11-18", value: 6760000 }
      ],
      WTREGEN: [
        { date: "2026-10-28", value: 999727 },
        { date: "2026-11-04", value: 957175 },
        { date: "2026-11-11", value: 914370 },
        { date: "2026-11-18", value: 900000 }
      ],
      RRPONTTLD: [
        { date: "2026-10-28", value: 176 },
        { date: "2026-11-04", value: 225 },
        { date: "2026-11-10", value: 152 },
        { date: "2026-11-13", value: 325 },
        { date: "2026-11-18", value: 200 },
        { date: "2026-11-19", value: 999 }
      ]
    },
    NL_SERIES: null,
    WK_CHANGES: null
  };
  vm.runInNewContext(
    extractFunction(h41, "findClosest") + "\n" +
    extractFunction(h41, "computeNetLiquidity") + "\n" +
    extractFunction(h41, "computeWeeklyChanges") + "\n" +
    "computeNetLiquidity(); computeWeeklyChanges();",
    ctx
  );

  const mixed = (6758867 - 914370 - 152) / 1000;
  assert.equal(ctx.NL_SERIES.dates.join(","), "2026-10-28,2026-11-04,2026-11-18");
  assert.equal(ctx.NL_SERIES.values[1], (6748145 - 957175 - 225) / 1000);
  assert.equal(ctx.NL_SERIES.values[2], (6760000 - 900000 - 200) / 1000);
  assert.equal(ctx.NL_SERIES.values.indexOf(mixed), -1);
  assert.equal(ctx.NL_SERIES.referenceDate, "2026-11-18");
  assert.equal(ctx.NL_SERIES.referenceComplete, true);
  assert.equal(ctx.NL_SERIES.components.WALCL, "2026-11-18");
  assert.equal(ctx.NL_SERIES.components.WTREGEN, "2026-11-18");
  assert.equal(ctx.NL_SERIES.components.RRPONTTLD, "2026-11-18");
  assert.equal(ctx.WK_CHANGES.map(function (w) { return w.date; }).join(","), "2026-11-04");
  assert.equal(api.nlWeeklyState(false, { pct: 0.93 }), null);
  assert.equal(api.nlWeeklyState(true, { pct: 0.93 }), "ESTABLE");
  assert.equal(api.nlWeeklyState(true, { pct: 2 }), "EXPANDE");
  assert.equal(api.nlWeeklyState(true, { pct: -2 }), "CONTRAE");
  const first = api.nlHistoryDelta("2026-10-28", 1, [], ["2026-10-28", "2026-11-04"]);
  assert.equal(first.pct, 0);
  assert.equal(first.signal, "NEUTRAL");
  const gapped = api.nlHistoryDelta("2026-11-04", 1, [], ["2026-10-28", "2026-11-04"]);
  assert.equal(gapped.pct, null);
  assert.equal(gapped.signal, null);
  assert.equal(api.nlHistoryDelta("2026-11-11", null, ctx.WK_CHANGES, ctx.NL_SERIES.walclDates).signal, null);
  assert.equal(api.nlHistoryDelta("2026-11-18", ctx.NL_SERIES.values[2], ctx.WK_CHANGES, ctx.NL_SERIES.walclDates).signal, null);

  const gap = {
    DATA: {
      WALCL: [
        { date: "2026-11-04", value: 6748145 },
        { date: "2026-11-11", value: 6758867 }
      ],
      WTREGEN: [
        { date: "2026-11-04", value: 957175 },
        { date: "2026-11-11", value: 914370 }
      ],
      RRPONTTLD: [
        { date: "2026-11-04", value: 225 },
        { date: "2026-11-10", value: 152 },
        { date: "2026-11-13", value: 325 }
      ]
    },
    NL_SERIES: null,
    WK_CHANGES: null
  };
  vm.runInNewContext(
    extractFunction(h41, "findClosest") + "\n" +
    extractFunction(h41, "computeNetLiquidity") + "\n" +
    extractFunction(h41, "computeWeeklyChanges") + "\n" +
    "computeNetLiquidity(); computeWeeklyChanges();",
    gap
  );
  assert.equal(gap.NL_SERIES.dates.join(","), "2026-11-04");
  assert.equal(gap.NL_SERIES.referenceDate, "2026-11-11");
  assert.equal(gap.NL_SERIES.referenceComplete, false);
  assert.equal(gap.NL_SERIES.values[0], (6748145 - 957175 - 225) / 1000);
  assert.equal(gap.NL_SERIES.values.includes(mixed), false);
  assert.equal(gap.NL_SERIES.components.WALCL, "2026-11-11");
  assert.equal(gap.NL_SERIES.components.WTREGEN, "2026-11-11");
  assert.equal(gap.NL_SERIES.components.RRPONTTLD, "2026-11-13");
  assert.equal(api.formatNlComponentDates(gap.NL_SERIES.components),
    "WALCL 2026-11-11 · TGA 2026-11-11 · RRP 2026-11-13");
  assert.equal(gap.WK_CHANGES.length, 0);
  assert.equal(api.nlWeeklyState(gap.NL_SERIES.referenceComplete, { pct: 0.93 }), null);

  const zeroRrp = {
    DATA: {
      WALCL: [{ date: "2026-11-04", value: 1000 }],
      WTREGEN: [{ date: "2026-11-04", value: 100 }],
      RRPONTTLD: [{ date: "2026-11-04", value: 0 }]
    },
    NL_SERIES: null
  };
  vm.runInNewContext(
    extractFunction(h41, "findClosest") + "\n" +
    extractFunction(h41, "computeNetLiquidity") + "\n" +
    "computeNetLiquidity();",
    zeroRrp
  );
  assert.equal(zeroRrp.NL_SERIES.referenceComplete, true);
  assert.equal(zeroRrp.NL_SERIES.values[0], (1000 - 100 - 0) / 1000);

  assert.match(h41, /id="kNLdates"/);
  assert.match(h41, /formatNlComponentDates\(NL_SERIES\.components\)/);
  assert.equal(h41.includes("findClosest(tgaMap"), false);
  assert.equal(h41.includes("findClosest(rrpMap"), false);
});

test("A4 una pata ausente no se pinta como 0 ni como NORMAL", function () {
  const api = load([
    "sofrIorbState",
    "lastCommonRates",
    "commonRateSeries",
    "assetsRecordRow"
  ]);

  const absent = api.sofrIorbState(null);
  assert.equal(absent.bps, null);
  assert.equal(absent.state, null);
  assert.equal(api.lastCommonRates(
    [{ date: "2026-11-12", value: 3.90 }],
    [{ date: "2026-11-13", value: 3.90 }]
  ), null);
  const disjoint = api.sofrIorbState(api.lastCommonRates(
    [{ date: "2026-11-12", value: 3.90 }],
    [{ date: "2026-11-13", value: 3.90 }]
  ));
  assert.equal(disjoint.bps, null);
  assert.equal(disjoint.state, null);
  const flat = api.sofrIorbState({ sofr: 3.90, iorb: 3.90 });
  assert.equal(flat.bps, 0);
  assert.equal(flat.state, "NORMAL");
  assert.equal(api.sofrIorbState({ sofr: 4.125, iorb: 4 }).state, "NORMAL");
  assert.equal(api.sofrIorbState({ sofr: 4.25, iorb: 4 }).state, "STRESS");
  assert.equal(api.sofrIorbState({ sofr: 4.5, iorb: 4 }).state, "CRITICAL");

  const wa = { "2026-11-04": 6748145, "2026-11-11": 6758867 };
  const tr = { "2026-11-04": 4578777 };
  const mb = { "2026-11-11": 1883522 };
  const pc = { "2026-11-11": 0 };
  const missing = api.assetsRecordRow("2026-11-11", "2026-11-04", wa, tr, mb, pc);
  assert.equal(missing.treasuries, null);
  assert.equal(missing.primary, 0);
  assert.equal(missing.mbs, 1883522 / 1000);
  assert.equal(missing.walcl, 6758867 / 1000);
  assert.equal(missing.delta, (6758867 - 6748145) / 1000);
  const noPrev = api.assetsRecordRow("2026-11-11", null, wa, tr, mb, pc);
  assert.equal(noPrev.delta, null);

  assert.match(h41, /sofrIorbState\(commonSp\)/);
  assert.match(h41, /sig\.state==null\?"NO DATA":sig\.state/);
  assert.equal(h41.includes("*100):0"), false);
  assert.equal(h41.includes("trMap[d]||0"), false);
  assert.equal(h41.includes("mbMap[d]||0"), false);
  assert.equal(h41.includes("pcMap[d]||0"), false);
  assert.equal(h41.includes("waMap[d]||0"), false);
  assert.match(h41, /assetsRecordRow\(/);
});
