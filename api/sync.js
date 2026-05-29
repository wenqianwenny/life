const headers = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json; charset=utf-8",
};

function send(res, status, body) {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.status(status).send(JSON.stringify(body));
}

function syncKey(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 96);
  return cleaned ? `daily-care:${cleaned}` : null;
}

async function redis(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    const error = new Error("Cloud sync storage is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(url, {
    body: JSON.stringify(command),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const error = new Error(`Redis command failed: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    res.status(204).end();
    return;
  }

  const key = syncKey(req.query.key);
  if (!key) {
    send(res, 400, { error: "Missing sync key." });
    return;
  }

  try {
    if (req.method === "GET") {
      const result = await redis(["GET", key]);
      if (!result.result) {
        send(res, 404, { error: "No sync data." });
        return;
      }
      send(res, 200, JSON.parse(result.result));
      return;
    }

    if (req.method === "POST") {
      const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis(["SET", key, JSON.stringify(payload || {})]);
      send(res, 200, { ok: true });
      return;
    }

    send(res, 405, { error: "Method not allowed." });
  } catch (error) {
    send(res, error.statusCode || 500, { error: error.message || "Sync failed." });
  }
}
