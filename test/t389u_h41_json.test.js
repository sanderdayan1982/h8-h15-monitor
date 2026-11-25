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

test("el panel no lleva clave ni llama a FRED desde el navegador", function () {
  assert.doesNotMatch(h41, /FRED_KEY\s*=/);
  assert.doesNotMatch(h41, /api_key=/);
  assert.doesNotMatch(h41, /fred-proxy/);
  assert.match(h41, /raw\.githubusercontent\.com\/sanderdayan1982\/h8-h15-monitor\/main\/data\/h41_liquidity\.json/);
  assert.match(h41, /formatFuenteNoResponde/);
});

test("Fuente no responde incluye la hora WAT del último dato", function () {
  const ctx = {};
  vm.runInNewContext(extractFunction(h41, "formatWat") + "\n" + extractFunction(h41, "formatFuenteNoResponde"), ctx);
  const msg = ctx.formatFuenteNoResponde("2026-11-25T21:00:00Z");
  assert.match(msg, /Fuente no responde/);
  assert.match(msg, /WAT/);
  assert.match(msg, /25/);
  assert.match(ctx.formatFuenteNoResponde(""), /sin hora de último dato/);
});

test("applyH41Json rellena las 9 series y WMTSECL1 sin clave", function () {
  const ctx = {
    TICKERS: {
      WALCL: "WALCL", WTREGEN: "WTREGEN", RRPONTTLD: "RRPONTTLD", WRESBAL: "WRESBAL",
      TREAST: "TREAST", MBST: "WSHOMCB", PRIMARYCR: "WLCFLPCL", SOFR: "SOFR", IORB: "IORB"
    },
    DATA: {},
    failedSeries: []
  };
  vm.runInNewContext(extractFunction(h41, "applyH41Json"), ctx);
  const tickers = ["WALCL","WTREGEN","RRPONTTLD","WRESBAL","TREAST","MBST","PRIMARYCR","SOFR","IORB"];
  const UNITS = {WALCL:1,WTREGEN:1,RRPONTTLD:1000,WRESBAL:1,TREAST:1,MBST:1,PRIMARYCR:1,SOFR:1,IORB:1};
  const series = {};
  tickers.forEach(function (k) {
    const sid = ctx.TICKERS[k];
    series[sid] = {id: sid, observations: [{date: "2026-11-18", value: 1}]};
  });
  series.WMTSECL1 = {id: "WMTSECL1", observations: [{date: "2026-11-18", value: 9}]};
  ctx.applyH41Json({schema: "g8-h41-liquidity-v1", as_of: "2026-11-18", series: series}, tickers, UNITS);
  assert.equal(ctx.DATA.WALCL[0].value, 1);
  assert.equal(ctx.DATA.RRPONTTLD[0].value, 1000);
  assert.equal(ctx.DATA.MBST[0].value, 1);
  assert.equal(ctx.DATA.WMTSECL1[0].value, 9);
  assert.equal(ctx.failedSeries.length, 0);
});
