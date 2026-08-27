// api/bot.js — El Bromista, the BROLI Telegram bot
// Runs as a Vercel serverless function. No server, no CLI, no dependencies.

/* ═══════════ CONFIG — EDIT THIS ═══════════ */
const CONFIG = {
  contract: "",                        // paste contract address after launch
  pumpUrl:  "https://pump.fun",        // your coin's pump.fun page
  site: "https://ihatebroccoli.fun",
  twitter:  "https://x.com/Broli_sol",
  autoJabChance: 0.15                  // odds the bot butts in when someone says broccoli
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
  return fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
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
/links — everywhere we live\n
Say "broccoli" in here and I may interrupt. Di "brócoli" y también.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("El Bromista is awake.");
  if (SECRET && req.headers["x-telegram-bot-api-secret-token"] !== SECRET)
    return res.status(401).send("no");

  try {
    const msg = req.body?.message;
    if (!msg) return res.status(200).send("ok");
    const chat = msg.chat.id, id = msg.message_id, text = (msg.text || "").toLowerCase();

    if (msg.new_chat_members?.length) {
      await say(chat, pick(WELCOME));
      return res.status(200).send("ok");
    }

    const cmd = text.split(/[\s@]/)[0];

    if (["/start", "/help", "/ayuda"].includes(cmd))      await say(chat, HELP, id);
    else if (["/precio", "/price", "/mc"].includes(cmd))  await say(chat, await stats(), id);
    else if (["/odio", "/hate"].includes(cmd))            await say(chat, pick(COMPLAINTS), id);
    else if (["/poder", "/power"].includes(cmd))          await say(chat, power(), id);
    else if (["/receta", "/recipe"].includes(cmd))        await say(chat, pick(RECIPES), id);
    else if (cmd === "/roast")                            await say(chat, pick(ROASTS), id);
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
