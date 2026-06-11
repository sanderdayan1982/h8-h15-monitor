// Proxy FRED — inyecta la api_key server-side desde variable de entorno.
exports.handler = async function (event) {
  const KEY = process.env.FRED_API_KEY;
  if (!KEY) {
    return { statusCode: 500, body: JSON.stringify({ error_message: "FRED_API_KEY env var not set" }) };
  }

  // FIX: según cómo llegue la invocación (redirect o directa), event.path
  // puede ser "/fred-proxy/..." o "/.netlify/functions/fred-proxy/...".
  // Cubrimos ambos prefijos.
  const endpoint = event.path
    .replace(/^\/\.netlify\/functions\/fred-proxy/, "")
    .replace(/^\/fred-proxy/, "");

  const params = new URLSearchParams(event.queryStringParameters || {});
  params.delete("api_key");
  params.set("api_key", KEY);

  const url = "https://api.stlouisfed.org/fred" + endpoint + "?" + params.toString();

  try {
    const resp = await fetch(url);
    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: { "Content-Type": "application/json" },
      body: body
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error_message: String(e) }) };
  }
};
