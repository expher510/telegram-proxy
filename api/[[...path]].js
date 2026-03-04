export default async function handler(req, res) {
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

  const path = req.url.split("?")[0];

  // ============================================
  // 1️⃣ استقبال من Telegram وتوجيهه لـ n8n
  // POST /api/webhook
  // ============================================
  if (path === "/api/webhook") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Webhook endpoint ready" });
    }

    try {
      console.log("📨 Telegram → n8n:", JSON.stringify(req.body));

      await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

    } catch (err) {
      console.error("❌ Forward to n8n failed:", err.message);
    }

    // دايماً 200 عشان Telegram ميعيدش الإرسال
    return res.status(200).json({ ok: true });
  }

  // ============================================
  // 2️⃣ استقبال من n8n وإرساله لـ Telegram API
  // POST /api/telegram?method=sendMessage
  // ============================================
  if (path === "/api/telegram") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Telegram proxy endpoint ready" });
    }

    // الـ method زي sendMessage أو sendPhoto إلخ
    const method = req.query.method || "sendMessage";

    try {
      console.log(`📤 n8n → Telegram [${method}]:`, JSON.stringify(req.body));

      const tgResponse = await fetch(`${TELEGRAM_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const tgData = await tgResponse.json();
      console.log(`✅ Telegram Response:`, JSON.stringify(tgData));

      return res.status(200).json(tgData);

    } catch (err) {
      console.error("❌ Forward to Telegram failed:", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // Health Check
  // ============================================
  return res.status(200).json({
    status: "🟢 Proxy is running",
    endpoints: {
      webhook: "POST /api/webhook  ← من Telegram لـ n8n",
      telegram: "POST /api/telegram?method=sendMessage  ← من n8n لـ Telegram",
    },
  });
}
