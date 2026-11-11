/* FLUJOS-01 Parte C — contexto de custodia. No puntúa ni vota.
   Serie: WMTSECL1 (FRED, H.4.1, semanal, miércoles, millones de USD).
   ΔN semanas = nivel(as_of) − nivel(as_of − N×7 días), solo si esa fecha existe. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.custodyContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var SERIES_ID = "WMTSECL1";

  function isoAddDays(iso, days) {
    var p = iso.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
    dt.setUTCDate(dt.getUTCDate() + days);
    var m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    var d = String(dt.getUTCDate()).padStart(2, "0");
    return dt.getUTCFullYear() + "-" + m + "-" + d;
  }

  function indexByDate(observations) {
    var map = Object.create(null);
    if (!observations || !observations.length) return map;
    for (var i = 0; i < observations.length; i++) {
      var o = observations[i];
      if (!o || typeof o.date !== "string") continue;
      var v = typeof o.value === "number" ? o.value : parseFloat(o.value);
      if (!isFinite(v)) continue;
      map[o.date] = v;
    }
    return map;
  }

  function latestDate(map) {
    var dates = Object.keys(map);
    if (!dates.length) return null;
    dates.sort();
    return dates[dates.length - 1];
  }

  function changeAt(map, asOf, weeks) {
    var priorDate = isoAddDays(asOf, -weeks * 7);
    if (!Object.prototype.hasOwnProperty.call(map, priorDate)) return null;
    return {
      weeks: weeks,
      prior_date: priorDate,
      prior_level: map[priorDate],
      delta: map[asOf] - map[priorDate]
    };
  }

  function labelFor(delta4, delta13) {
    if (typeof delta4 !== "number" || typeof delta13 !== "number") return null;
    if (!isFinite(delta4) || !isFinite(delta13)) return null;
    if (delta4 < 0 && delta13 < 0) return "CUSTODY_DRAIN";
    return null;
  }

  function snapshot(observations) {
    var map = indexByDate(observations);
    var asOf = latestDate(map);
    var empty = {
      series_id: SERIES_ID,
      as_of: null,
      level: null,
      delta_4w: null,
      delta_13w: null,
      label: null
    };
    if (!asOf) return empty;
    var c4 = changeAt(map, asOf, 4);
    var c13 = changeAt(map, asOf, 13);
    var d4 = c4 ? c4.delta : null;
    var d13 = c13 ? c13.delta : null;
    return {
      series_id: SERIES_ID,
      as_of: asOf,
      level: map[asOf],
      delta_4w: c4,
      delta_13w: c13,
      label: labelFor(d4, d13)
    };
  }

  return { SERIES_ID: SERIES_ID, snapshot: snapshot, labelFor: labelFor };
});
