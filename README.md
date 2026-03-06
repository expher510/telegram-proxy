# 📡 Telegram Proxy

وسيط بين Telegram Bot API و n8n على HuggingFace — مبني على Vercel Serverless
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/alialpop510-1872s-projects)
[![HuggingFace](https://img.shields.io/badge/🤗-alisaadeng-yellow)](https://huggingface.co/alisaadeng)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord)](https://discord.gg/ZsqyhvAq)

---

## ⚡ المشكلة والحل

HuggingFace بيبلوك الـ IP بتاعه من Telegram — يعني n8n مش بيقدر يستقبل أو يبعت لـ Telegram مباشرة.

```
بدون Proxy ❌
Telegram → n8n (HuggingFace) ← BLOCKED

مع Proxy ✅
Telegram → Proxy (Vercel) → n8n (HuggingFace)
n8n → Proxy (Vercel) → Telegram API
```

---

## 🚀 Deploy على Vercel

### 1 — Clone الـ Repo

```bash
git clone https://github.com/expher510/telegram-proxy
cd telegram-proxy
```

### 2 — Deploy على Vercel

```bash
vercel deploy
```

### 3 — Environment Variables

| Key | Value |
|-----|-------|
| `TELEGRAM_TOKEN` | التوكن من BotFather |
| `N8N_WEBHOOK_URL` | `https://YOUR_SPACE.hf.space/webhook/YOUR_ID` |

### 4 — اربط Telegram بالـ Proxy

افتح في المتصفح:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR-PROXY.vercel.app/api/webhook
```

أو استخدم الـ endpoint المدمج:

```
https://YOUR-PROXY.vercel.app/api/setwebhook
```

---

## 📌 الـ Endpoints

### 1️⃣ `POST /api/webhook`
استقبال من Telegram وتوجيهه لـ n8n

```
Telegram → Proxy → n8n
```

---

### 2️⃣ `POST /api/telegram?method=METHOD`
إرسال من n8n لـ Telegram API

```
n8n → Proxy → Telegram API
```

في n8n HTTP Request Node:

```
Method : POST
URL    : https://YOUR-PROXY.vercel.app/api/telegram?method=sendMessage
Body   : {
           "chat_id": "{{ $json.body.message.chat.id }}",
           "text": "ردك هنا 👋"
         }
```

#### الـ Methods المتاحة:

**رسائل أساسية:**

| Method | الاستخدام |
|--------|-----------|
| `sendMessage` | رسالة نص |
| `sendPhoto` | صورة بـ URL |
| `sendVideo` | فيديو بـ URL |
| `sendDocument` | ملف بجودة كاملة |
| `sendAudio` | صوت بـ URL |
| `sendVoice` | رسالة صوتية |
| `sendAnimation` | GIF |
| `sendSticker` | ستيكر |
| `sendMediaGroup` | ألبوم صور |
| `sendLocation` | موقع جغرافي |
| `sendVenue` | مكان بعنوان |
| `sendContact` | جهة اتصال |
| `forwardMessage` | تحويل رسالة |
| `copyMessage` | نسخ رسالة |

**استطلاعات:**

| Method | الاستخدام |
|--------|-----------|
| `sendPoll` | استطلاع رأي |
| `sendPoll` (type: quiz) | اختبار بإجابة صحيحة |
| `sendDice` | نرد أو إيموجي عشوائي 🎲 |

**تعديل رسائل موجودة:**

| Method | الاستخدام |
|--------|-----------|
| `editMessageText` | تعديل نص رسالة |
| `editMessageCaption` | تعديل كابشن ملف/صورة |
| `editMessageReplyMarkup` | تعديل الأزرار |
| `deleteMessage` | حذف رسالة |
| `pinChatMessage` | تثبيت رسالة |
| `unpinChatMessage` | إلغاء تثبيت رسالة |

**Callback & Inline:**

| Method | الاستخدام |
|--------|-----------|
| `answerCallbackQuery` | رد على ضغطة زر Inline |
| `answerInlineQuery` | رد على inline query |
| `sendChatAction` | إظهار "جاري الكتابة..." |

**إدارة الجروب:**

| Method | الاستخدام |
|--------|-----------|
| `banChatMember` | حظر عضو |
| `unbanChatMember` | رفع الحظر |
| `restrictChatMember` | تقييد صلاحيات عضو |
| `promoteChatMember` | ترقية عضو لأدمن |

---

### 3️⃣ `GET /api/file?file_id=FILE_ID`
تحميل ملف من Telegram وبعته لـ n8n كـ Binary

```
n8n → Proxy → Telegram Files → Binary
```

في n8n HTTP Request Node:

```
Method          : GET
URL             : https://YOUR-PROXY.vercel.app/api/file?file_id={{ $json.body.message.video_note.file_id }}
Response Format : File (Binary)
```

الـ `file_id` بتاخده من:

| النوع | المسار |
|-------|--------|
| صورة | `message.photo[-1].file_id` |
| فيديو | `message.video.file_id` |
| فيديو دائري | `message.video_note.file_id` |
| صوت مسجل | `message.voice.file_id` |
| رسالة صوتية | `message.audio.file_id` |
| ملف | `message.document.file_id` |
| ستيكر | `message.sticker.file_id` |

> ⚠️ الحد الأقصى 20MB — قيد من Telegram

---

### 4️⃣ `POST /api/upload`
رفع ملف Binary من n8n لـ Telegram

```
n8n Binary → Proxy → Telegram
```

في n8n HTTP Request Node:

```
Method : POST
URL    : https://YOUR-PROXY.vercel.app/api/upload?method=sendDocument&chat_id=CHAT_ID&filename=data.json&mimetype=application/json
Body   : Binary
```

الأنواع المتاحة:

| Method | mimetype | النوع |
|--------|----------|-------|
| `sendDocument` | `application/json` | JSON / PDF / ZIP |
| `sendPhoto` | `image/jpeg` | صورة مضغوطة |
| `sendVideo` | `video/mp4` | فيديو |
| `sendAudio` | `audio/mpeg` | صوت |
| `sendVoice` | `audio/ogg` | رسالة صوتية |
| `sendAnimation` | `image/gif` | GIF |

> ⚠️ لإرسال صورة بجودتها الأصلية → استخدم `sendDocument` مش `sendPhoto`

---

### 5️⃣ `GET /api/me`
معلومات البوت

```json
{ "ok": true, "result": { "id": 123, "username": "your_bot", ... } }
```

---

### 6️⃣ `GET /api/webhookinfo`
التحقق من حالة الـ Webhook

```json
{ "ok": true, "result": { "url": "https://...", "pending_update_count": 0 } }
```

---

### 7️⃣ `GET /api/deletewebhook`
حذف الـ Webhook

```json
{ "ok": true, "telegram": { "ok": true, "result": true } }
```

---

## 🏗️ Structure

```
📁 telegram-proxy
├── 📁 api
│   └── [[...path]].js   ← كل الـ endpoints
└── vercel.json           ← إعدادات Vercel
```

---

## 🔗 روابط مهمة

- [Vercel Dashboard](https://vercel.com/alialpop510-1872s-projects)
- [BotFather](https://t.me/BotFather)
- [Telegram Bot API Docs](https://core.telegram.org/bots/api)
- [n8n Docs](https://docs.n8n.io)
- [🤗 HuggingFace](https://huggingface.co/alisaadeng)
- [💬 Discord](https://discord.gg/ZsqyhvAq)
- [GitHub](https://github.com/expher510/telegram-proxy)

---

## 📄 License

MIT — مجاني للاستخدام والتعديل ✅






