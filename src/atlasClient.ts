type EnvLike = Record<string, string | undefined>;

function getEnvValue(key: string, viteEnv?: EnvLike, nodeEnv?: EnvLike) {
  return (viteEnv && viteEnv[key]) || (nodeEnv && nodeEnv[key]) || undefined;
}

export async function sendToAtlas(userText: string) {
  const viteEnv = typeof import.meta !== "undefined" ? (import.meta as unknown as { env?: EnvLike }).env : undefined;
  const nodeEnv = typeof globalThis !== "undefined" ? (globalThis as unknown as { process?: { env?: EnvLike } }).process?.env : undefined;

  const url =
    getEnvValue("VITE_ATLAS_API_URL", viteEnv, nodeEnv) ||
    getEnvValue("VITE_ATLASCLOUD_API_URL", viteEnv, nodeEnv) ||
    getEnvValue("ATLAS_API_URL", viteEnv, nodeEnv) ||
    getEnvValue("ATLASCLOUD_API_URL", viteEnv, nodeEnv) ||
    "https://api.atlascloud.ai/v1/chat/completions";

  const apiKey =
    getEnvValue("VITE_ATLAS_API_KEY", viteEnv, nodeEnv) ||
    getEnvValue("VITE_ATLASCLOUD_API_KEY", viteEnv, nodeEnv) ||
    getEnvValue("ATLAS_API_KEY", viteEnv, nodeEnv) ||
    getEnvValue("ATLASCLOUD_API_KEY", viteEnv, nodeEnv) ||
    "";

  if (!apiKey) {
    throw new Error("مفتاح Atlas غير موجود. أضف VITE_ATLAS_API_KEY أو ATLAS_API_KEY.");
  }

  const trimmedUserText = (userText || "").slice(0, 2000);

  const systemPrompt = `
أنت مساعد عربي لتحويل النصوص إلى JSON مواعيد. أعد كائناً واحداً بهذه الصيغة:
{
  "appointments": [
    {
      "type": "medical|medication|personal_event|work|other",
      "title": "عنوان قصير",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "end_time": "HH:MM أو null",
      "location": "اختياري أو null",
      "person": "اختياري أو null",
      "actions_before": ["خطوة", "..."],
      "actions_after": ["خطوة", "..."],
      "tags": ["وسم1", "وسم2"],
      "recurrence": { "pattern": "none|daily|weekly|monthly|yearly", "every": 1, "days_of_week": ["sat","sun","mon","tue","wed","thu","fri"] },
      "reminder_minutes_before": 30,
      "notes": "اختياري أو null"
    }
  ]
}
شروط:
- إن لم تجد مواعيد أرجع {"appointments": []}.
- لا تضع حقولاً فارغة؛ استخدم null أو [] عند الحاجة.
- تأكد أن JSON صالح بالكامل دون نص زائد.
`.trim();

  const payload = {
    model: "openai/gpt-oss-20b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: trimmedUserText },
    ],
    max_tokens: 256,
    temperature: 0.2,
    top_p: 0.7,
    top_k: 20,
    repetition_penalty: 1.02,
    stream: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    const lowered = text.toLowerCase();
    if (res.status === 429 || lowered.includes("too many requests") || lowered.includes("only request this after")) {
      throw new Error(`يرجى الانتظار قليلًا ثم إعادة المحاولة (429): ${text}`);
    }
    throw new Error(`Atlas API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  const assistantContent = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.delta?.content || null;
  return { raw: json, assistant: assistantContent };
}

export default sendToAtlas;
