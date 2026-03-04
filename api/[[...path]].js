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

    const body = req.body;
    console.log("📨 Telegram → n8n:", JSON.stringify(body));

    // ✅ بعت لـ n8n وانتظر الرد
    try {
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55000),
      });
      const n8nData = await n8nResponse.text();
      console.log(`✅ n8n Response [${n8nResponse.status}]:`, n8nData);
    } catch (err) {
      console.error("❌ Forward to n8n failed:", err.message);
    }

    return res.status(200).json({ ok: true });
  }

  // ============================================
  // 3️⃣ [جديد] تحميل ملف من Telegram وبعته لـ n8n
  // GET /api/file?file_id=xxxxx
  // ============================================
  if (path === "/api/file") {
    // لازم يكون GET
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed, use GET" });
    }

    const file_id = req.query.file_id;

    // تأكد إن file_id موجود
    if (!file_id) {
      return res.status(400).json({ error: "❌ file_id is required" });
    }

    try {
      console.log(`📥 Downloading file_id: ${file_id}`);

      // الخطوة 1 — جيب الـ file_path من Telegram
      const getFileRes = await fetch(`${TELEGRAM_API}/getFile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id }),
      });
      const getFileData = await getFileRes.json();

      if (!getFileData.ok) {
        console.error("❌ getFile failed:", JSON.stringify(getFileData));
        return res.status(400).json({ error: "❌ Failed to get file path", details: getFileData });
      }

      const file_path = getFileData.result.file_path;
      console.log(`📁 file_path: ${file_path}`);

      // الخطوة 2 — حمّل الملف الفعلي من Telegram
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file_path}`;
      const fileRes = await fetch(fileUrl);

      if (!fileRes.ok) {
        console.error("❌ File download failed:", fileRes.status);
        return res.status(500).json({ error: "❌ Failed to download file" });
      }

      // الخطوة 3 — بعت الملف لـ n8n كـ binary
      const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
      const fileBuffer = await fileRes.arrayBuffer();

      console.log(`✅ File downloaded [${contentType}] size: ${fileBuffer.byteLength} bytes`);

      // ابعت الملف كـ binary response
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${file_path.split("/").pop()}"`);
      res.setHeader("X-File-Path", file_path);
      return res.send(Buffer.from(fileBuffer));

    } catch (err) {
      console.error("❌ File proxy error:", err.message);
      return res.status(500).json({ error: err.message });
    }
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
