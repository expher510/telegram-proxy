export default async function handler(req, res) {
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  const path            = req.url.split("?")[0];
  const segments        = path.split("/").filter(Boolean); // ["api", "webhook", "TOKEN"]

  // ============================================
  // helper: جيب التوكن من الـ URL أو الـ body أو query
  // ============================================
  function getToken(source = "query") {
    if (source === "path")  return segments[2] || null;             // /api/webhook/TOKEN
    if (source === "query") return req.query.token || null;         // ?token=TOKEN
    if (source === "body")  return req.body?.token || null;         // { token: "..." }
    return null;
  }

  // ============================================
  // 1️⃣ استقبال من Telegram وتوجيهه لـ n8n
  // POST /api/webhook/TOKEN
  // ============================================
  if (segments[0] === "api" && segments[1] === "webhook") {
    const token = getToken("path");

    if (req.method !== "POST") {
      return res.status(200).json({
        status: "🟢 Webhook endpoint ready",
        usage : "POST /api/webhook/YOUR_BOT_TOKEN",
      });
    }

    if (!token) {
      return res.status(400).json({ error: "❌ Token is required in URL: /api/webhook/TOKEN" });
    }

    const body = req.body;

    // جيب اسم البوت من التوكن
    let bot_info = { id: null, username: null, first_name: null };
    try {
      const meRes  = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const meData = await meRes.json();
      if (meData.ok) {
        bot_info = {
          id        : meData.result.id,
          username  : meData.result.username,
          first_name: meData.result.first_name,
        };
      }
    } catch (_) {}

    // الـ payload اللي هيتبعت لـ n8n = بيانات تيليجرام + معلومات البوت
    const payload = {
      ...body,
      _bot: {
        token     : token,
        id        : bot_info.id,
        username  : bot_info.username,
        first_name: bot_info.first_name,
      },
    };

    console.log("📨 Telegram → n8n:", JSON.stringify(payload));

    try {
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify(payload),
        signal : AbortSignal.timeout(55000),
      });

      const n8nData = await n8nResponse.text();
      console.log(`✅ n8n Response [${n8nResponse.status}]:`, n8nData);
    } catch (err) {
      console.error("❌ Forward to n8n failed:", err.message);
    }

    return res.status(200).json({ ok: true });
  }

  // ============================================
  // 2️⃣ استقبال من n8n وإرساله لـ Telegram API
  // POST /api/telegram/TOKEN?method=sendMessage
  // ============================================
  if (segments[0] === "api" && segments[1] === "telegram") {
    const token = getToken("path") || getToken("query");

    if (req.method !== "POST") {
      return res.status(200).json({
        status: "🟢 Telegram proxy endpoint ready",
        usage : "POST /api/telegram/YOUR_BOT_TOKEN?method=sendMessage",
      });
    }

    if (!token) {
      return res.status(400).json({ error: "❌ Token is required: /api/telegram/TOKEN?method=..." });
    }

    const method      = req.query.method || "sendMessage";
    const body        = req.body;
    const TELEGRAM_API = `https://api.telegram.org/bot${token}`;

    try {
      console.log(`📤 n8n → Telegram [${method}]:`, JSON.stringify(body));

      const tgResponse = await fetch(`${TELEGRAM_API}/${method}`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify(body),
      });

      const tgData = await tgResponse.json();
      console.log("✅ Telegram Response:", JSON.stringify(tgData));
      return res.status(200).json(tgData);
    } catch (err) {
      console.error("❌ Forward to Telegram failed:", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 3️⃣ تحميل ملف من Telegram وبعته لـ n8n
  // GET /api/file/TOKEN?file_id=xxxxx
  // ============================================
  if (segments[0] === "api" && segments[1] === "file") {
    const token = getToken("path") || getToken("query");

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed, use GET" });
    }

    if (!token) {
      return res.status(400).json({ error: "❌ Token is required: /api/file/TOKEN?file_id=..." });
    }

    const file_id      = req.query.file_id;
    const TELEGRAM_API = `https://api.telegram.org/bot${token}`;

    if (!file_id) {
      return res.status(400).json({ error: "❌ file_id is required" });
    }

    try {
      console.log(`📥 Downloading file_id: ${file_id}`);

      const getFileRes  = await fetch(`${TELEGRAM_API}/getFile`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ file_id }),
      });
      const getFileData = await getFileRes.json();

      if (!getFileData.ok) {
        return res.status(400).json({ error: "❌ Failed to get file path", details: getFileData });
      }

      const file_path = getFileData.result.file_path;
      const fileUrl   = `https://api.telegram.org/file/bot${token}/${file_path}`;
      const fileRes   = await fetch(fileUrl);

      if (!fileRes.ok) {
        return res.status(500).json({ error: "❌ Failed to download file" });
      }

      const ext       = file_path.split(".").pop().toLowerCase();
      const mimeTypes = {
        mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo",
        mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav",
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
        pdf: "application/pdf", zip: "application/zip", json: "application/json",
      };

      const contentType = mimeTypes[ext] || fileRes.headers.get("content-type") || "application/octet-stream";
      const fileName    = file_path.split("/").pop();
      const fileBuffer  = await fileRes.arrayBuffer();

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("X-File-Path", file_path);
      res.setHeader("X-File-Name", fileName);
      return res.send(Buffer.from(fileBuffer));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // 4️⃣ رفع ملف Binary من n8n لـ Telegram
  // POST /api/upload/TOKEN?method=sendDocument&chat_id=xxx
  // ============================================
  if (segments[0] === "api" && segments[1] === "upload") {
    const token = getToken("path") || getToken("query");

    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Upload endpoint ready" });
    }

    if (!token) {
      return res.status(400).json({ error: "❌ Token is required: /api/upload/TOKEN?chat_id=..." });
    }

    const method       = req.query.method   || "sendDocument";
    const chat_id      = req.query.chat_id;
    const caption      = req.query.caption  || "";
    const filename     = req.query.filename || "file";
    const mimetype     = req.query.mimetype || "application/octet-stream";
    const TELEGRAM_API = `https://api.telegram.org/bot${token}`;

    if (!chat_id) {
      return res.status(400).json({ error: "❌ chat_id is required in query params" });
    }

    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const fileBuffer = Buffer.concat(chunks);

      const fieldNames = {
        sendDocument: "document", sendPhoto: "photo", sendVideo: "video",
        sendAudio: "audio", sendVoice: "voice", sendAnimation: "animation", sendSticker: "sticker",
      };

      const fieldName = fieldNames[method] || "document";
      const formData  = new FormData();
      formData.append("chat_id", chat_id);
      if (caption) formData.append("caption", caption);
      formData.append(fieldName, new Blob([fileBuffer], { type: mimetype }), filename);

      const tgResponse = await fetch(`${TELEGRAM_API}/${method}`, { method: "POST", body: formData });
      const tgData     = await tgResponse.json();
      return res.status(200).json(tgData);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 5️⃣ معلومات الـ Webhook الحالي
  // GET /api/webhookinfo/TOKEN
  // ============================================
  if (segments[0] === "api" && segments[1] === "webhookinfo") {
    const token = getToken("path") || getToken("query");
    if (!token) return res.status(400).json({ error: "❌ Token required" });
    try {
      const tgRes  = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const tgData = await tgRes.json();
      return res.status(200).json(tgData);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 6️⃣ معلومات البوت
  // GET /api/me/TOKEN
  // ============================================
  if (segments[0] === "api" && segments[1] === "me") {
    const token = getToken("path") || getToken("query");
    if (!token) return res.status(400).json({ error: "❌ Token required" });
    try {
      const tgRes  = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const tgData = await tgRes.json();
      return res.status(200).json(tgData);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 7️⃣ حذف الـ Webhook
  // GET /api/deletewebhook/TOKEN
  // ============================================
  if (segments[0] === "api" && segments[1] === "deletewebhook") {
    const token = getToken("path") || getToken("query");
    if (!token) return res.status(400).json({ error: "❌ Token required" });
    try {
      const tgRes  = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
      const tgData = await tgRes.json();
      return res.status(200).json({ ok: true, telegram: tgData });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // Health Check
  // ============================================
  return res.status(200).json({
    status: "🟢 Multi-Bot Proxy is running",
    n8n_url: N8N_WEBHOOK_URL ? "✅ Set" : "❌ Missing",
    note: "Dynamic multi-bot support - Token passed in URL path",
    endpoints: {
      // ── الاستقبال ──────────────────────────────
      webhook      : "POST /api/webhook/TOKEN",

      // ── الإرسال ────────────────────────────────
      sendMessage  : "POST /api/telegram/TOKEN?method=sendMessage        | { chat_id, text }",
      sendPhoto    : "POST /api/telegram/TOKEN?method=sendPhoto          | { chat_id, photo, caption? }",
      sendVideo    : "POST /api/telegram/TOKEN?method=sendVideo          | { chat_id, video, caption? }",
      sendAudio    : "POST /api/telegram/TOKEN?method=sendAudio          | { chat_id, audio, caption? }",
      sendDocument : "POST /api/telegram/TOKEN?method=sendDocument       | { chat_id, document, caption? }",
      sendSticker  : "POST /api/telegram/TOKEN?method=sendSticker        | { chat_id, sticker }",
      sendLocation : "POST /api/telegram/TOKEN?method=sendLocation       | { chat_id, latitude, longitude }",
      sendMediaGroup: "POST /api/telegram/TOKEN?method=sendMediaGroup    | { chat_id, media: [...] }",
      editText     : "POST /api/telegram/TOKEN?method=editMessageText    | { chat_id, message_id, text }",
      deleteMessage: "POST /api/telegram/TOKEN?method=deleteMessage      | { chat_id, message_id }",
      answerCallback: "POST /api/telegram/TOKEN?method=answerCallbackQuery | { callback_query_id, text? }",
      sendChatAction: "POST /api/telegram/TOKEN?method=sendChatAction    | { chat_id, action }",

      // ── ملفات ──────────────────────────────────
      file         : "GET  /api/file/TOKEN?file_id=xxx",
      upload       : "POST /api/upload/TOKEN?method=sendDocument&chat_id=xxx&filename=file.pdf",

      // ── معلومات ────────────────────────────────
      me           : "GET  /api/me/TOKEN",
      webhookInfo  : "GET  /api/webhookinfo/TOKEN",
      deleteWebhook: "GET  /api/deletewebhook/TOKEN",
    },
    n8n_payload_example: {
      "_bot": {
        "token"     : "BOT_TOKEN",
        "id"        : 123456789,
        "username"  : "MyBot",
        "first_name": "My Bot",
      },
      "message": { "...": "باقي بيانات تيليجرام الأصلية" },
    },
  });
}
