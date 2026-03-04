export default async function handler(req, res) {
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

  const path = req.url.split("?")[0];

  // ============================================
  // 1️⃣ استقبال من Telegram وتوجيهه لـ n8n
  // ============================================
  if (path === "/api/webhook") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Webhook endpoint ready" });
    }

    // ✅ احفظ الـ body قبل أي حاجة
    const body = req.body;
    console.log("📨 Telegram → n8n:", JSON.stringify(body));

    // ✅ رد على Telegram فوراً عشان ميـ timeout ش
    res.status(200).json({ ok: true });

    // ✅ بعت لـ n8n في الـ background
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      console.log(`✅ n8n Response [${response.status}]:`, text);
    } catch (err) {
      console.error("❌ Forward to n8n failed:", err.message);
    }

    return;
  }

  // ============================================
  // 2️⃣ استقبال من n8n وإرساله لـ Telegram API
  // ============================================
  if (path === "/api/telegram") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Telegram proxy endpoint ready" });
    }

    const method = req.query.method || "sendMessage";
    const body = req.body;

    try {
      console.log(`📤 n8n → Telegram [${method}]:`, JSON.stringify(body));

      const tgResponse = await fetch(`${TELEGRAM_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    n8n_url: N8N_WEBHOOK_URL ? "✅ Set" : "❌ Missing",
    telegram_token: TELEGRAM_TOKEN ? "✅ Set" : "❌ Missing",
  });
}
