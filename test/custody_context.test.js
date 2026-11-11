"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { snapshot, labelFor } = require("../custody_context.js");

/* Últimas 14 observaciones semanales de WMTSECL1 (CSV público FRED, 11-nov-2026). */
const FRED_TAIL = [
  ["2026-08-05", 2631099],
  ["2026-08-12", 2596842],
  ["2026-08-19", 2586171],
  ["2026-08-26", 2615246],
  ["2026-09-02", 2601241],
  ["2026-09-09", 2590095],
  ["2026-09-16", 2608821],
  ["2026-09-23", 2597451],
  ["2026-09-30", 2582350],
  ["2026-10-07", 2565477],
  ["2026-10-14", 2550889],
  ["2026-10-21", 2572847],
  ["2026-10-28", 2568597],
  ["2026-11-04", 2543700]
].map(function (row) { return { date: row[0], value: row[1] }; });

test("variación a 4 y 13 semanas sobre la cola real de WMTSECL1", function () {
  const snap = snapshot(FRED_TAIL.slice());
  assert.equal(snap.series_id, "WMTSECL1");
  assert.equal(snap.as_of, "2026-11-04");
  assert.equal(snap.level, 2543700);
  assert.deepEqual(snap.delta_4w, {
    weeks: 4,
    prior_date: "2026-10-07",
    prior_level: 2565477,
    delta: 2543700 - 2565477
  });
  assert.equal(snap.delta_4w.delta, -21777);
  assert.deepEqual(snap.delta_13w, {
    weeks: 13,
    prior_date: "2026-08-05",
    prior_level: 2631099,
    delta: 2543700 - 2631099
  });
  assert.equal(snap.delta_13w.delta, -87399);
  assert.equal(snap.label, "CUSTODY_DRAIN");
  assert.deepEqual(Object.keys(snap).sort(), [
    "as_of", "delta_13w", "delta_4w", "label", "level", "series_id"
  ]);
});

test("el orden de entrada no cambia el cálculo", function () {
  const shuffled = FRED_TAIL.slice().reverse();
  assert.deepEqual(snapshot(shuffled), snapshot(FRED_TAIL));
});

test("CUSTODY_DRAIN solo si Δ4s y Δ13s son ambas estrictamente negativas", function () {
  assert.equal(labelFor(-1, -0.5), "CUSTODY_DRAIN");
  assert.equal(labelFor(-21777, -87399), "CUSTODY_DRAIN");
  assert.equal(labelFor(-1, 1), null);
  assert.equal(labelFor(1, -1), null);
  assert.equal(labelFor(1, 1), null);
  assert.equal(labelFor(0, -1), null);
  assert.equal(labelFor(-1, 0), null);
  assert.equal(labelFor(0, 0), null);
  assert.equal(labelFor(null, -1), null);
  assert.equal(labelFor(-1, null), null);
  assert.equal(labelFor(undefined, undefined), null);
  assert.equal(labelFor(NaN, -1), null);
});

test("una variación positiva impide la etiqueta aunque la otra sea negativa", function () {
  const rows = FRED_TAIL.map(function (o) { return { date: o.date, value: o.value }; });
  rows[rows.length - 1] = { date: "2026-11-04", value: 2700000 };
  const snap = snapshot(rows);
  assert.ok(snap.delta_4w.delta > 0);
  assert.ok(snap.delta_13w.delta > 0);
  assert.equal(snap.label, null);

  rows[9] = { date: "2026-10-07", value: 2800000 };
  const mixed = snapshot(rows);
  assert.ok(mixed.delta_4w.delta < 0);
  assert.ok(mixed.delta_13w.delta > 0);
  assert.equal(mixed.label, null);
});

test("cero no es negativo: no hay CUSTODY_DRAIN", function () {
  const rows = [
    { date: "2026-08-05", value: 100 },
    { date: "2026-10-07", value: 80 },
    { date: "2026-11-04", value: 80 }
  ];
  const snap = snapshot(rows);
  assert.equal(snap.delta_4w.delta, 0);
  assert.equal(snap.delta_13w.delta, -20);
  assert.equal(snap.label, null);
});

test("sin la observación exacta de hace N×7 días la variación es null y no hay etiqueta", function () {
  const gapped = FRED_TAIL.filter(function (o) { return o.date !== "2026-10-07"; });
  const snap = snapshot(gapped);
  assert.equal(snap.level, 2543700);
  assert.equal(snap.delta_4w, null);
  assert.equal(snap.delta_13w.delta, -87399);
  assert.equal(snap.label, null);
});

test("historia insuficiente para 13 semanas no fabrica la variación", function () {
  const short = FRED_TAIL.slice(-5);
  const snap = snapshot(short);
  assert.equal(snap.delta_4w.prior_date, "2026-10-07");
  assert.equal(snap.delta_13w, null);
  assert.equal(snap.label, null);
});

test("serie vacía o inválida", function () {
  const empty = snapshot([]);
  assert.equal(empty.level, null);
  assert.equal(empty.delta_4w, null);
  assert.equal(empty.delta_13w, null);
  assert.equal(empty.label, null);
  assert.equal(snapshot(null).label, null);
  assert.equal(snapshot([{ date: "2026-11-04", value: "." }]).level, null);
});

test("el panel no altera tickers, umbrales ni el contrato 9/9; la custodia queda fuera del voto", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "Panel_1_H41_Liquidity.html"), "utf8");
  assert.match(html, /WALCL:"WALCL"/);
  assert.match(html, /WTREGEN:"WTREGEN"/);
  assert.match(html, /RRPONTTLD:"RRPONTTLD"/);
  assert.match(html, /WRESBAL:"WRESBAL"/);
  assert.match(html, /TREAST:"TREAST"/);
  assert.match(html, /MBST:"WSHOMCB"/);
  assert.match(html, /PRIMARYCR:"WLCFLPCL"/);
  assert.match(html, /SOFR:"SOFR"/);
  assert.match(html, /IORB:"IORB"/);
  assert.match(html, /okCount===9\?"dot ok":"dot err"/);
  assert.match(html, /okCount===9\?"Live \\u00b7 9\/9":"Partial \\u00b7 "\+okCount\+"\/9"/);
  assert.match(html, /rb\.value<2500000/);
  assert.match(html, /rb\.value<3000000/);
  assert.match(html, /tga\.value>=900000/);
  assert.match(html, /tga\.value>=750000/);
  assert.match(html, /spread>30/);
  assert.match(html, /spread>15/);
  assert.match(html, /wk\.pct>=2/);
  assert.match(html, /wk\.pct<=-2/);
  assert.match(html, /UNITS=\{WALCL:1,WTREGEN:1,RRPONTTLD:1000,WRESBAL:1,TREAST:1,MBST:1,PRIMARYCR:1,SOFR:1,IORB:1\}/);

  const alerts = html.slice(html.indexOf("function getAlerts()"), html.indexOf("function badgeClass"));
  assert.equal(alerts.includes("WMTSECL1"), false);
  assert.equal(alerts.includes("CUSTODY_DRAIN"), false);
  assert.match(html, /id="custodyContext"/);
  assert.match(html, /fetchFRED\("WMTSECL1",sd,false\)/);
  assert.match(html, /src="\/custody_context\.js"/);
});
