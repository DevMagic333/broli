// api/bot.js — El Bromista, the BROLI Telegram bot
// Runs as a Vercel serverless function. No server, no CLI, no dependencies.

/* ═══════════ CONFIG — EDIT THIS ═══════════ */
const CONFIG = {
  contract: "C9eAZmNDiAokkVoai7diynWtME6UpZfgVuCrX4ripump",
  pumpUrl:  "https://pump.fun/coin/C9eAZmNDiAokkVoai7diynWtME6UpZfgVuCrX4ripump",
  site:     "https://ihatebroccoli.fun",
  twitter:  "https://x.com/Broli_sol",
  autoJabChance: 0.15,                 // odds the bot butts in when someone says broccoli
  muteHours: 24                        // default /mute duration
};
/* ═════════════════════════════════════════ */

const TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_SECRET;

const COMPLAINTS = [
  "It squeaks. Food is not supposed to squeak.",
  "Es un arbolito y yo no soy jirafa.",
  "The cheese sauce is doing 100% of the work.",
  "Steamed, boiled, roasted, air fried. Still bad.",
  "Found one under the couch. Dated it. 2019.",
  "Mom said one more bite. That was in March.",
  "¿Otra vez brócoli? En serio.",
  "I ate my greens and somehow I'm angrier.",
  "Smells like a gym sock's funeral in here.",
  "Nobody in recorded history has finished the broccoli.",
  "My dog turned it down and he eats drywall.",
  "It's the only vegetable that fights back.",
  "Sabe a castigo.",
  "Even the compost bin said no thanks."
];

const RECIPES = [
  "Broccoli, steamed 40 minutes. Serve to enemy.",
  "Broccoli, deep fried, buried in cheese. You are eating cheese. Admit it.",
  "Broccoli, raw. This is a hostage situation.",
  "Brócoli con limón y sal. Sigue siendo brócoli.",
  "Broccoli, blended into a smoothie. Now it's a punishment you can drink.",
  "Broccoli, hidden under mac and cheese. Cowardly. Effective.",
  "Broccoli, thrown directly in the trash. 5 stars. Chef's kiss."
];

const ROASTS = [
  "Power level: a wet paper bag.",
  "You eat broccoli voluntarily, don't you. Be honest.",
  "Certified floret enjoyer. Disgraceful.",
  "Tienes energía de brócoli hervido.",
  "You'd lose an arm wrestle to a carrot.",
  "Detected: cauliflower sympathizer."
];

const WELCOME = [
  "A new hater joins the field. Welcome.",
  "Another soul who was forced to finish their plate. Welcome.",
  "Bienvenido. Aquí odiamos el brócoli en dos idiomas.",
  "Welcome. Rule one: never finish the broccoli."
];

const pick = a => a[Math.floor(Math.random() * a.length)];
const money = n => n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M"
              : n >= 1e3 ? "$" + (n / 1e3).toFixed(1) + "K"
              : "$" + Number(n).toFixed(2);

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function isAdmin(chat_id, user_id){
  try {
    const r = await tg("getChatMember", { chat_id, user_id });
    return ["creator", "administrator"].includes(r?.result?.status);
  } catch { return false; }
}

const who = u => u ? `${u.first_name || ""}${u.username ? " (@" + u.username + ")" : ""}`.trim() : "them";

/* ═══════════ TEAMS — the broccoli war ═══════════ */
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

async function sb(method, path, body, headers = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text();
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}

const TEAM_NAMES = { haters: "Team Broli", florets: "los Floretes" };

const JOIN_REPLIES = {
  haters: [
    "Correct answer. Welcome to Team Broli.",
    "A hater of taste and conviction. Registered.",
    "Bienvenido al lado correcto de la historia."
  ],
  florets: [
    "Wrong, but noted. Welcome to los Floretes.",
    "Registered as a floret. I will pray for you.",
    "Un Florete más. El brócoli no te va a querer de vuelta."
  ]
};

async function joinTeam(from, teamArg) {
  if (!SB_URL || !SB_KEY) return "Team registry is offline. The war continues on paper.";
  const team = /flor/i.test(teamArg) ? "florets"
             : /(hat|broli|odi)/i.test(teamArg) ? "haters" : null;
  if (!team) return "Pick a side: /join haters or /join florets";
  await sb("POST", "broli_teams?on_conflict=user_id", [{
    user_id: from.id,
    username: from.username || from.first_name || "anon",
    team
  }], { Prefer: "resolution=merge-duplicates" });
  return `${who(from)} → <b>${TEAM_NAMES[team]}</b>\n${pick(JOIN_REPLIES[team])}`;
}

async function scoreBoard() {
  if (!SB_URL || !SB_KEY) return "Team registry is offline.";
  const members = await sb("GET", "broli_teams?select=team") || [];
  const h = members.filter(m => m.team === "haters").length;
  const f = members.filter(m => m.team === "florets").length;
  const season = (await sb("GET", "broli_season?id=eq.1"))?.[0] || { haters: 0, florets: 0 };
  const spin = season.florets > season.haters
    ? "The season record is under investigation."
    : season.florets === season.haters
    ? "A tie. Which means I am winning morally."
    : "The record speaks for itself.";
  return `<b>THE BROCCOLI WAR</b>\n\n` +
         `Team Broli      ${h} hater${h === 1 ? "" : "s"}\n` +
         `los Floretes    ${f} floret${f === 1 ? "" : "s"}\n\n` +
         `<b>Season</b> — Haters ${season.haters} · Florets ${season.florets}\n${spin}\n\n` +
         `Not enlisted? /join haters or /join florets`;
}

async function recordWin(teamArg) {
  const team = /flor/i.test(teamArg) ? "florets" : /hat/i.test(teamArg) ? "haters" : null;
  if (!team) return "Usage: /win haters or /win florets";
  const row = (await sb("GET", "broli_season?id=eq.1"))?.[0];
  if (!row) return "Season table missing. Run the setup SQL first.";
  await sb("PATCH", "broli_season?id=eq.1", { [team]: (row[team] || 0) + 1 });
  return team === "haters"
    ? "Week goes to <b>Team Broli</b>. As predicted. As deserved."
    : "Week goes to <b>los Floretes</b>. The vote was compromised. Recount pending forever.";
}
/* ═══════════════════════════════════════════════ */

/* varied angles so a signal never becomes copy-paste */
const ANGLES = [
  "reply with your own broccoli complaint",
  "quote it with the worst vegetable you can think of",
  "reply in Spanish if that is your thing",
  "drop a sticker in the replies",
  "tell them about the thing in the back of your fridge",
  "argue with it — disagreement counts",
  "reply with what your mom made you finish"
];

/* auto-moderation: scam patterns only, never opinions */
const SCAM = [
  /\bt\.me\/\+?[A-Za-z0-9_]{6,}/i,
  /\b(airdrop|claim now|claim your|free mint|verify your wallet)\b/i,
  /\b(seed phrase|private key|recovery phrase)\b/i,
  /\bdm me\b.*\b(help|support|admin)\b/i,
  /\bconnect (your )?wallet\b/i,
  /\b(1000x|guaranteed|risk[- ]free) (returns?|profit)\b/i
];
const looksLikeScam = t => SCAM.some(re => re.test(t));
const say = (chat_id, text, reply_to) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML",
      disable_web_page_preview: true, reply_to_message_id: reply_to });

async function stats() {
  if (!CONFIG.contract) return "Not live yet. Patience, hater.";
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONFIG.contract}`);
    const p = (await r.json())?.pairs?.[0];
    if (!p) return "No chart data yet. Still on the bonding curve.";
    const ch = Number(p.priceChange?.h24 || 0);
    const mood = ch >= 0 ? "Aura rising." : "He is sitting on the throne again.";
    return `<b>$BROLI</b>\n` +
      `Price   ${Number(p.priceUsd) < 0.01 ? "$" + Number(p.priceUsd).toFixed(8) : money(p.priceUsd)}\n` +
      `Cap     ${money(p.marketCap || p.fdv || 0)}\n` +
      `24h     ${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%\n` +
      `Vol     ${money(p.volume?.h24 || 0)}\n` +
      `Liq     ${money(p.liquidity?.usd || 0)}\n\n${mood}`;
  } catch { return "Chart is hiding. Try again in a minute."; }
}

function power() {
  if (Math.random() < 0.02) return "⚡ <b>OVER 9000</b> ⚡\nLegendary Super Broccoli achieved.";
  const n = Math.floor(Math.random() * 8500) + 100;
  const tag = n < 1000 ? "Weak. Eat a vegetable. Sorry."
            : n < 4000 ? "Respectable hatred."
            : n < 7000 ? "Now we're talking."
                       : "Dangerously close.";
  return `Power level: <b>${n.toLocaleString()}</b>\n${tag}`;
}

const HELP =
`<b>El Bromista</b> — BROLI's problem child\n
/precio — live price and cap
/ca — contract address
/odio — a fresh broccoli complaint
/poder — roll your power level
/receta — a broccoli recipe (do not cook it)
/roast — get insulted
/links — everywhere we live
/join haters · /join florets — pick your side in the war
/score — team counts + season standings\n
Say "broccoli" in here and I may interrupt. Di "brócoli" y también.\n
<b>Admins only</b> — reply to a message, then:
/del — delete it
/mute — mute them ${CONFIG.muteHours}h
/unmute — undo
/ban — remove for good
/signal &lt;link&gt; — share a post with the group
/win haters|florets — record the weekly trial result`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("El Bromista is awake.");
  if (SECRET && req.headers["x-telegram-bot-api-secret-token"] !== SECRET)
    return res.status(401).send("no");

  try {
    const msg = req.body?.message;
    if (!msg) return res.status(200).send("ok");
    const chat = msg.chat.id, id = msg.message_id;
    const text = (msg.text || msg.caption || "").toLowerCase();
    const from = msg.from;

    if (msg.new_chat_members?.length) {
      await say(chat, pick(WELCOME));
      return res.status(200).send("ok");
    }

    /* auto-remove obvious scams from non-admins */
    if (text && looksLikeScam(text) && !(await isAdmin(chat, from.id))) {
      await tg("deleteMessage", { chat_id: chat, message_id: id });
      await say(chat, `Removed a message from ${who(from)} — it matched a known scam pattern.\n\n` +
                      `Reminder: admins never DM you first, and nobody here will ever ask for a seed phrase.`);
      return res.status(200).send("ok");
    }

    const cmd = text.split(/[\s@]/)[0];
    const target = msg.reply_to_message;

    /* ── admin commands ── */
    if (["/del","/mute","/unmute","/ban","/signal","/win"].includes(cmd)) {
      if (!(await isAdmin(chat, from.id))) {
        await say(chat, "That one's for admins.", id);
        return res.status(200).send("ok");
      }

      if (cmd === "/win") {
        const arg = (msg.text || "").split(/\s+/)[1] || "";
        await say(chat, await recordWin(arg), id);
        return res.status(200).send("ok");
      }

      if (cmd === "/signal") {
        const link = (msg.text || "").split(/\s+/).slice(1).join(" ").trim();
        if (!link) { await say(chat, "Usage: /signal &lt;link to the post&gt;", id); return res.status(200).send("ok"); }
        await say(chat,
          `New post is up.\n\n${link}\n\n` +
          `If you feel like it: <b>${pick(ANGLES)}</b>.\n\n` +
          `Say your own thing. Copy-paste replies get everyone flagged and help nobody.`);
        return res.status(200).send("ok");
      }

      if (!target) { await say(chat, "Reply to the message you mean.", id); return res.status(200).send("ok"); }
      const u = target.from;

      if (cmd === "/del") {
        await tg("deleteMessage", { chat_id: chat, message_id: target.message_id });
      } else if (cmd === "/mute") {
        await tg("restrictChatMember", {
          chat_id: chat, user_id: u.id,
          until_date: Math.floor(Date.now()/1000) + CONFIG.muteHours*3600,
          permissions: { can_send_messages: false }
        });
        await say(chat, `${who(u)} is muted for ${CONFIG.muteHours}h.`);
      } else if (cmd === "/unmute") {
        await tg("restrictChatMember", {
          chat_id: chat, user_id: u.id,
          permissions: { can_send_messages: true, can_send_audios: true, can_send_documents: true,
                         can_send_photos: true, can_send_videos: true, can_send_other_messages: true,
                         can_add_web_page_previews: true }
        });
        await say(chat, `${who(u)} can talk again.`);
      } else if (cmd === "/ban") {
        await tg("banChatMember", { chat_id: chat, user_id: u.id });
        await say(chat, `${who(u)} removed.`);
      }
      return res.status(200).send("ok");
    }

    if (["/start", "/help", "/ayuda"].includes(cmd))      await say(chat, HELP, id);
    else if (["/precio", "/price", "/mc"].includes(cmd))  await say(chat, await stats(), id);
    else if (["/odio", "/hate"].includes(cmd))            await say(chat, pick(COMPLAINTS), id);
    else if (["/poder", "/power"].includes(cmd))          await say(chat, power(), id);
    else if (["/receta", "/recipe"].includes(cmd))        await say(chat, pick(RECIPES), id);
    else if (cmd === "/roast")                            await say(chat, pick(ROASTS), id);
    else if (["/join", "/unirse"].includes(cmd))
      await say(chat, await joinTeam(from, (msg.text || "").split(/\s+/)[1] || ""), id);
    else if (["/score", "/marcador"].includes(cmd))       await say(chat, await scoreBoard(), id);
    else if (cmd === "/ca")
      await say(chat, CONFIG.contract
        ? `<code>${CONFIG.contract}</code>\n\nTap to copy.`
        : "Not live yet.", id);
    else if (cmd === "/links")
      await say(chat, `<a href="${CONFIG.pumpUrl}">pump.fun</a> · ` +
                      `<a href="${CONFIG.site}">site</a> · ` +
                      `<a href="${CONFIG.twitter}">X</a>`, id);
    else if (/br[oó]coli|broccoli/.test(text) && Math.random() < CONFIG.autoJabChance)
      await say(chat, pick(COMPLAINTS), id);

    return res.status(200).send("ok");
  } catch (e) {
    console.error(e);
    return res.status(200).send("ok"); // always 200 or Telegram retries forever
  }
}
