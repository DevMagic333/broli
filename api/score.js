// api/score.js — BROLI leaderboard with signed sessions
// GET  /api/score            → top 20
// POST { start:true }        → issues a signed session token
// POST { token, name, score, hits, ms } → validates and records

import crypto from "node:crypto";

const URL    = process.env.SUPABASE_URL;
const KEY    = process.env.SUPABASE_SERVICE_KEY;
const SECRET = process.env.GAME_SECRET || "change-me";
const TABLE  = "broli_scores";
const MAX    = 9001;

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json"
};

const sign = v => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");

function issue(){
  const payload = `${Date.now()}.${crypto.randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(payload)}`;
}

function verify(token){
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  const expect = sign(payload);
  const a = Buffer.from(expect), b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const issued = Number(parts[0]);
  if (!Number.isFinite(issued)) return null;
  return { issued, age: Date.now() - issued };
}

const clean = s => String(s || "")
  .replace(/[^\p{L}\p{N} _.@-]/gu, "").trim().slice(0, 16) || "anon";

const top = async () => {
  const r = await fetch(
    `${URL}/rest/v1/${TABLE}?select=name,score,created_at&order=score.desc,created_at.asc&limit=20`,
    { headers });
  return r.json();
};

export default async function handler(req, res) {
  if (!URL || !KEY) return res.status(200).json({ scores: [], error: "not configured" });

  try {
    if (req.method === "GET") return res.status(200).json({ scores: await top() });
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    // start a run
    if (body.start) return res.status(200).json({ token: issue() });

    // submit a run
    const v = verify(body.token);
    if (!v) return res.status(403).json({ error: "invalid session" });
    if (v.age < 6000)    return res.status(403).json({ error: "too fast" });
    if (v.age > 1800000) return res.status(403).json({ error: "session expired" });

    const score = Math.floor(Number(body.score));
    const hits  = Math.floor(Number(body.hits));
    const ms    = Math.floor(Number(body.ms));

    if (![score, hits, ms].every(Number.isFinite))     return res.status(400).json({ error: "bad payload" });
    if (score < 0 || score > MAX)                      return res.status(400).json({ error: "bad score" });
    if (hits < 0 || hits > 400)                        return res.status(400).json({ error: "bad hits" });
    if (ms < 0 || ms > v.age + 5000)                   return res.status(400).json({ error: "bad duration" });

    // plausibility: broccoli spawn no faster than ~3/sec, best hit is worth ~620
    if (hits > Math.ceil(ms / 300) + 3)                return res.status(400).json({ error: "impossible pace" });
    if (score > hits * 640)                            return res.status(400).json({ error: "score exceeds hits" });
    if (score > 0 && hits === 0)                       return res.status(400).json({ error: "score without hits" });

    // token is unique in the table, so a run can only ever be submitted once
    const r = await fetch(`${URL}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        name: clean(body.name), score, hits, ms,
        token: sign(body.token)          // store the hash, not the token
      })
    });
    if (r.status === 409) return res.status(409).json({ error: "already submitted" });
    if (!r.ok)            return res.status(500).json({ error: "insert failed" });

    return res.status(200).json({ ok: true, scores: await top() });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ scores: [], error: "server error" });
  }
}
