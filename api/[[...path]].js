export default async function handler(req, res) {
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_API    = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
  const path            = req.url.split("?")[0];

  // ============================================
  // 1️⃣ استقبال من Telegram وتوجيهه لـ n8n
  // ============================================
  if (path === "/api/webhook") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Webhook endpoint ready" });
    }

    const body = req.body;
    console.log("📨 Telegram → n8n:", JSON.stringify(body));

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
  // 2️⃣ استقبال من n8n وإرساله لـ Telegram API
  // POST /api/telegram?method=sendMessage
  // POST /api/telegram?method=sendPhoto
  // POST /api/telegram?method=sendVideo
  // POST /api/telegram?method=sendAudio
  // POST /api/telegram?method=sendDocument
  // POST /api/telegram?method=sendSticker
  // POST /api/telegram?method=sendLocation
  // POST /api/telegram?method=sendVenue
  // POST /api/telegram?method=sendContact
  // POST /api/telegram?method=sendPoll
  // POST /api/telegram?method=sendQuiz
  // POST /api/telegram?method=sendDice
  // POST /api/telegram?method=sendChatAction
  // POST /api/telegram?method=answerCallbackQuery
  // POST /api/telegram?method=editMessageText
  // POST /api/telegram?method=editMessageCaption
  // POST /api/telegram?method=editMessageReplyMarkup
  // POST /api/telegram?method=deleteMessage
  // POST /api/telegram?method=pinChatMessage
  // POST /api/telegram?method=unpinChatMessage
  // POST /api/telegram?method=banChatMember
  // POST /api/telegram?method=unbanChatMember
  // POST /api/telegram?method=restrictChatMember
  // POST /api/telegram?method=promoteChatMember
  // POST /api/telegram?method=answerInlineQuery
  // POST /api/telegram?method=forwardMessage
  // POST /api/telegram?method=copyMessage
  // POST /api/telegram?method=sendMediaGroup
  // ============================================
  if (path === "/api/telegram") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Telegram proxy endpoint ready" });
    }

    const method = req.query.method || "sendMessage";
    const body   = req.body;

    try {
      console.log(`📤 n8n → Telegram [${method}]:`, JSON.stringify(body));

      const tgResponse = await fetch(`${TELEGRAM_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  // GET /api/file?file_id=xxxxx
  // ============================================
  if (path === "/api/file") {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed, use GET" });
    }

    const file_id = req.query.file_id;
    if (!file_id) {
      return res.status(400).json({ error: "❌ file_id is required" });
    }

    try {
      console.log(`📥 Downloading file_id: ${file_id}`);

      const getFileRes  = await fetch(`${TELEGRAM_API}/getFile`, {
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

      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file_path}`;
      const fileRes = await fetch(fileUrl);

      if (!fileRes.ok) {
        console.error("❌ File download failed:", fileRes.status);
        return res.status(500).json({ error: "❌ Failed to download file" });
      }

      const ext = file_path.split(".").pop().toLowerCase();
      const mimeTypes = {
        mp4:  "video/mp4",
        mov:  "video/quicktime",
        avi:  "video/x-msvideo",
        mp3:  "audio/mpeg",
        ogg:  "audio/ogg",
        oga:  "audio/ogg",
        m4a:  "audio/mp4",
        wav:  "audio/wav",
        jpg:  "image/jpeg",
        jpeg: "image/jpeg",
        png:  "image/png",
        gif:  "image/gif",
        webp: "image/webp",
        pdf:  "application/pdf",
        zip:  "application/zip",
        json: "application/json",
      };

      const contentType = mimeTypes[ext] || fileRes.headers.get("content-type") || "application/octet-stream";
      const fileName    = file_path.split("/").pop();
      const fileBuffer  = await fileRes.arrayBuffer();

      console.log(`✅ File downloaded [${contentType}] size: ${fileBuffer.byteLength} bytes`);

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("X-File-Path", file_path);
      res.setHeader("X-File-Name", fileName);
      return res.send(Buffer.from(fileBuffer));
    } catch (err) {
      console.error("❌ File proxy error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ============================================
  // 4️⃣ رفع ملف Binary من n8n لـ Telegram
  // POST /api/upload?method=sendDocument&chat_id=xxx&filename=data.json&mimetype=application/json
  // ============================================
  if (path === "/api/upload") {
    if (req.method !== "POST") {
      return res.status(200).json({ status: "🟢 Upload endpoint ready" });
    }

    const method   = req.query.method   || "sendDocument";
    const chat_id  = req.query.chat_id;
    const caption  = req.query.caption  || "";
    const filename = req.query.filename || "file";
    const mimetype = req.query.mimetype || "application/octet-stream";

    if (!chat_id) {
      return res.status(400).json({ error: "❌ chat_id is required in query params" });
    }

    try {
      console.log(`📤 Uploading [${method}] → Telegram | chat_id: ${chat_id} | file: ${filename}`);

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const fileBuffer = Buffer.concat(chunks);

      console.log(`📦 File size: ${fileBuffer.byteLength} bytes | type: ${mimetype}`);

      const fieldNames = {
        sendDocument : "document",
        sendPhoto    : "photo",
        sendVideo    : "video",
        sendAudio    : "audio",
        sendVoice    : "voice",
        sendAnimation: "animation",
        sendSticker  : "sticker",
      };

      const fieldName = fieldNames[method] || "document";

      const formData = new FormData();
      formData.append("chat_id", chat_id);
      if (caption) formData.append("caption", caption);
      formData.append(fieldName, new Blob([fileBuffer], { type: mimetype }), filename);

      const tgResponse = await fetch(`${TELEGRAM_API}/${method}`, {
        method: "POST",
        body: formData,
      });

      const tgData = await tgResponse.json();
      console.log("✅ Telegram Upload Response:", JSON.stringify(tgData));
      return res.status(200).json(tgData);
    } catch (err) {
      console.error("❌ Upload error:", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 5️⃣ معلومات الـ Webhook الحالي
  // GET /api/webhookinfo
  // ============================================
  if (path === "/api/webhookinfo") {
    try {
      const tgRes  = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
      const tgData = await tgRes.json();
      return res.status(200).json(tgData);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 6️⃣ معلومات البوت
  // GET /api/me
  // ============================================
  if (path === "/api/me") {
    try {
      const tgRes  = await fetch(`${TELEGRAM_API}/getMe`);
      const tgData = await tgRes.json();
      return res.status(200).json(tgData);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ============================================
  // 7️⃣ حذف الـ Webhook
  // GET /api/deletewebhook
  // ============================================
  if (path === "/api/deletewebhook") {
    try {
      const tgRes  = await fetch(`${TELEGRAM_API}/deleteWebhook`);
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
    status: "🟢 Proxy is running",
    n8n_url       : N8N_WEBHOOK_URL ? "✅ Set" : "❌ Missing",
    telegram_token: TELEGRAM_TOKEN  ? "✅ Set" : "❌ Missing",
    endpoints: {
      // ── الاستقبال ──────────────────────────────
      webhook       : "POST /api/webhook",

      // ── الإرسال العام ──────────────────────────
      sendMessage   : "POST /api/telegram?method=sendMessage        | { chat_id, text, parse_mode?, reply_markup? }",
      sendPhoto     : "POST /api/telegram?method=sendPhoto          | { chat_id, photo, caption? }",
      sendVideo     : "POST /api/telegram?method=sendVideo          | { chat_id, video, caption? }",
      sendAudio     : "POST /api/telegram?method=sendAudio          | { chat_id, audio, caption? }",
      sendDocument  : "POST /api/telegram?method=sendDocument       | { chat_id, document, caption? }",
      sendSticker   : "POST /api/telegram?method=sendSticker        | { chat_id, sticker }",
      sendLocation  : "POST /api/telegram?method=sendLocation       | { chat_id, latitude, longitude }",
      sendVenue     : "POST /api/telegram?method=sendVenue          | { chat_id, latitude, longitude, title, address }",
      sendContact   : "POST /api/telegram?method=sendContact        | { chat_id, phone_number, first_name }",
      sendMediaGroup: "POST /api/telegram?method=sendMediaGroup     | { chat_id, media: [...] }",
      forwardMessage: "POST /api/telegram?method=forwardMessage     | { chat_id, from_chat_id, message_id }",
      copyMessage   : "POST /api/telegram?method=copyMessage        | { chat_id, from_chat_id, message_id }",

      // ── استطلاعات ──────────────────────────────
      sendPoll      : "POST /api/telegram?method=sendPoll           | { chat_id, question, options: [...], is_anonymous? }",
      sendQuiz      : "POST /api/telegram?method=sendPoll           | { chat_id, question, options, type:'quiz', correct_option_id }",
      sendDice      : "POST /api/telegram?method=sendDice           | { chat_id, emoji? }",

      // ── تفاعل مع رسائل موجودة ──────────────────
      editText      : "POST /api/telegram?method=editMessageText          | { chat_id, message_id, text }",
      editCaption   : "POST /api/telegram?method=editMessageCaption       | { chat_id, message_id, caption }",
      editMarkup    : "POST /api/telegram?method=editMessageReplyMarkup   | { chat_id, message_id, reply_markup }",
      deleteMessage : "POST /api/telegram?method=deleteMessage            | { chat_id, message_id }",
      pinMessage    : "POST /api/telegram?method=pinChatMessage           | { chat_id, message_id }",
      unpinMessage  : "POST /api/telegram?method=unpinChatMessage         | { chat_id, message_id? }",

      // ── Callback & Inline ──────────────────────
      answerCallback: "POST /api/telegram?method=answerCallbackQuery | { callback_query_id, text?, show_alert? }",
      answerInline  : "POST /api/telegram?method=answerInlineQuery   | { inline_query_id, results: [...] }",
      sendChatAction: "POST /api/telegram?method=sendChatAction      | { chat_id, action: 'typing'|'upload_photo'|'record_voice'|... }",

      // ── إدارة الأعضاء ──────────────────────────
      banMember     : "POST /api/telegram?method=banChatMember       | { chat_id, user_id, until_date? }",
      unbanMember   : "POST /api/telegram?method=unbanChatMember     | { chat_id, user_id }",
      restrictMember: "POST /api/telegram?method=restrictChatMember  | { chat_id, user_id, permissions: {...} }",
      promoteMember : "POST /api/telegram?method=promoteChatMember   | { chat_id, user_id, can_manage_chat?, ... }",

      // ── ملفات ──────────────────────────────────
      file          : "GET  /api/file?file_id=xxx",
      upload        : "POST /api/upload?method=sendDocument&chat_id=xxx&filename=data.json&mimetype=application/json",

      // ── معلومات ──────────────────────────────
      me            : "GET  /api/me",
      webhookInfo   : "GET  /api/webhookinfo",
      deleteWebhook : "GET  /api/deletewebhook",
    },
  });
}
