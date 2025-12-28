import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import sendToAtlas from "./atlasClient";
import { supabase } from "./lib/supabase";
import { useAppointments, type Appointment, type Priority, type Status } from "./store/useAppointments";

const priorityText: Record<Priority, string> = { low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" };
const statusText: Record<Status, string> = { scheduled: "مجدول", done: "منجز", canceled: "ملغي" };
const statusOrder: Record<Status, number> = { scheduled: 0, done: 1, canceled: 2 };
const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

type FormModel = {
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  description: string;
  tag: string;
  reminderMinutes: string;
  priority: Priority;
  status: Status;
};

type AtlasAppointment = {
  type?: string;
  title?: string;
  date?: string;
  time?: string;
  end_time?: string | null;
  location?: string | null;
  person?: string | null;
  actions_before?: string[];
  actions_after?: string[];
  tags?: string[];
  reminder_minutes_before?: number | null;
  recurrence?: { pattern?: string; every?: number; days_of_week?: string[] };
  notes?: string | null;
};

type ToneName = "soft" | "bright" | "digital" | "calm" | "alert";

type Settings = {
  defaultPriority: Priority;
  reminderWindowMinutes: number;
  tags: string[];
};

type SettingsOverlayProps = {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  setSettings: (value: Settings | ((prev: Settings) => Settings)) => void;
  tone: ToneName;
  onToneChange: (tone: ToneName) => void;
  playTone: (tone: ToneName) => void;
  notificationPermission: NotificationPermission;
  notificationError: string | null;
  requestBellPermission: () => void;
  onResetManual: () => void;
};

type ErrorModalState = { title: string; message: string } | null;

const tonePatterns: Record<ToneName, { freq: number; duration: number }[]> = {
  soft: [
    { freq: 660, duration: 0.25 },
    { freq: 880, duration: 0.25 },
  ],
  bright: [
    { freq: 880, duration: 0.2 },
    { freq: 988, duration: 0.2 },
    { freq: 1046, duration: 0.25 },
  ],
  digital: [
    { freq: 523, duration: 0.15 },
    { freq: 784, duration: 0.15 },
    { freq: 1046, duration: 0.2 },
  ],
  calm: [
    { freq: 440, duration: 0.2 },
    { freq: 554, duration: 0.3 },
    { freq: 659, duration: 0.25 },
  ],
  alert: [
    { freq: 1046, duration: 0.12 },
    { freq: 1046, duration: 0.12 },
    { freq: 880, duration: 0.1 },
    { freq: 1046, duration: 0.18 },
  ],
};

const toneLabels: Record<ToneName, string> = {
  soft: "نغمة لطيفة",
  bright: "رنين واضح",
  digital: "تنبيه رقمي قصير",
  calm: "موجة هادئة",
  alert: "إنذار سريع",
};

// واجهة الإعدادات تظهر في نافذة مستقلة كاملة الشاشة.
function SettingsOverlay({
  open,
  onClose,
  settings,
  setSettings,
  tone,
  onToneChange,
  playTone,
  notificationPermission,
  notificationError,
  requestBellPermission,
  onResetManual,
}: SettingsOverlayProps) {
  const [newTag, setNewTag] = useState("");
  const [tagEdits, setTagEdits] = useState<Record<string, string>>({});

  const addTag = () => {
    const name = newTag.trim();
    if (!name) return;
    setSettings((s) => {
      if (s.tags.includes(name)) return s;
      return { ...s, tags: [...s.tags, name] };
    });
    setNewTag("");
  };

  const updateTag = (oldName: string, value: string) => {
    const name = value.trim();
    if (!name) {
      setTagEdits((prev) => ({ ...prev, [oldName]: oldName }));
      return;
    }
    setSettings((s) => ({ ...s, tags: s.tags.map((t) => (t === oldName ? name : t)) }));
  };

  const removeTag = (name: string) => {
    setSettings((s) => ({ ...s, tags: s.tags.filter((t) => t !== name) }));
    setTagEdits((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">خيارات عامة</p>
            <h2 className="text-lg font-semibold text-slate-900">الإعدادات</h2>
          </div>
          <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-blue-200 hover:text-blue-600" onClick={onClose}>
            إغلاق
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <h3 className="font-semibold text-slate-900">المواعيد</h3>
              <p className="text-sm text-slate-600">اضبط الأولوية الافتراضية ونطاق التذكير.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-700">الأولوية الافتراضية</label>
              <select className="select" value={settings.defaultPriority} onChange={(e) => setSettings((s) => ({ ...s, defaultPriority: e.target.value as Priority }))}>
                <option value="critical">حرج</option>
                <option value="high">مرتفع</option>
                <option value="medium">متوسط</option>
                <option value="low">منخفض</option>
              </select>
              <label className="text-sm text-slate-700">نافذة التذكير (دقائق)</label>
              <input
                className="input"
                type="number"
                min={5}
                max={180}
                value={settings.reminderWindowMinutes}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) setSettings((s) => ({ ...s, reminderWindowMinutes: Math.min(180, Math.max(5, v)) }));
                }}
              />
              <p className="text-xs text-slate-500">يتم إرسال التذكير إذا كان الموعد ضمن هذا النطاق.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="button" onClick={onResetManual}>
                إعادة ضبط نموذج الإضافة
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">التنبيهات</h3>
                <p className="text-sm text-slate-600">تحكم في نغمة الإشعار وحالة الإذن.</p>
                <p className="text-xs text-slate-500">الحالة: {notificationPermission === "granted" ? "مسموح" : notificationPermission === "denied" ? "مرفوض" : "بانتظار الإذن"}</p>
              </div>
              <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-blue-200 hover:text-blue-600" type="button" onClick={requestBellPermission}>
                طلب الإذن
              </button>
            </div>
            <div className="space-y-2">
              <select className="select" value={tone} onChange={(e) => onToneChange(e.target.value as ToneName)}>
                <option value="soft">{toneLabels.soft}</option>
                <option value="bright">{toneLabels.bright}</option>
                <option value="digital">{toneLabels.digital}</option>
                <option value="calm">{toneLabels.calm}</option>
                <option value="alert">{toneLabels.alert}</option>
              </select>
              <div className="flex gap-2">
                <button className="btn-primary" type="button" onClick={() => playTone(tone)}>
                  تجربة الصوت
                </button>
                <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" type="button" onClick={requestBellPermission}>
                  إعادة طلب الإذن
                </button>
              </div>
            </div>
            {notificationError && <p className="text-sm text-red-600">{notificationError}</p>}
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">الوسوم</h3>
                <p className="text-sm text-slate-600">أضف وسومًا لتنظيم المواعيد، ويمكن تعديلها أو حذفها.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="اكتب وسمًا جديدًا" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
              <button className="btn-primary" type="button" onClick={addTag}>
                إضافة
              </button>
            </div>
            <div className="space-y-2">
              {settings.tags.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد وسوم بعد.</p>
              ) : (
                settings.tags.map((tag) => (
                  <div key={tag} className="flex items-center gap-2">
                    <input
                      className="input flex-1"
                      value={tagEdits[tag] ?? tag}
                      onChange={(e) => setTagEdits((prev) => ({ ...prev, [tag]: e.target.value }))}
                      onBlur={(e) => updateTag(tag, e.target.value)}
                    />
                    <button className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700" type="button" onClick={() => removeTag(tag)}>
                      حذف
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorModal({ open, title, message, onClose }: { open: boolean; title: string; message: string; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-rose-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">!</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={onClose}>
            إرسال
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function toDateParts(a: Appointment | { start_at: string; end_at?: string }) {
  const start = new Date(a.start_at);
  return {
    date: start.toISOString().slice(0, 10),
    time: start.toISOString().slice(11, 16),
    endTime: a.end_at ? new Date(a.end_at).toISOString().slice(11, 16) : "",
  };
}

function getManualTemplate(settings: Settings): FormModel {
  return {
    title: "",
    date: "",
    time: "",
    endTime: "",
    location: "",
    description: "",
    tag: settings.tags[0] ?? "",
    reminderMinutes: String(settings.reminderWindowMinutes),
    priority: settings.defaultPriority,
    status: "scheduled",
  };
}

function mapTypeToPriority(type: string): Priority {
  const t = type.toLowerCase();
  if (t.includes("critical")) return "critical";
  if (t.includes("medical") || t.includes("medication")) return "high";
  if (t.includes("work")) return "medium";
  if (t.includes("personal")) return "low";
  return "medium";
}

function isHospitalAppointment(raw: AtlasAppointment) {
  const text = `${raw.title ?? ""} ${raw.notes ?? ""} ${raw.location ?? ""}`.toLowerCase();
  return ["مستشفى", "عيادة", "تحليل", "دواء", "مراجعة", "طبيب"].some((k) => text.includes(k)) || (raw.type ?? "").toLowerCase().includes("medical");
}

function extractAppointmentsJSON(rawContent: string): { appointments?: unknown } {
  const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const content = fenceMatch ? fenceMatch[1] : rawContent;
  try {
    return JSON.parse(content);
  } catch {
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) return JSON.parse(braceMatch[0]);
    throw new Error("تعذر قراءة JSON. يرجى إعادة المحاولة وإرجاع كائن appointments.");
  }
}

function isRateLimitError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes("429") || msg.toLowerCase().includes("too many requests");
}

function convertAtlasToAppointment(raw: AtlasAppointment): Omit<Appointment, "id" | "status"> & Partial<Pick<Appointment, "status">> {
  const now = new Date();
  const datePart = raw.date ?? now.toISOString().slice(0, 10);
  const timePart = raw.time ?? "09:00";
  const start = new Date(`${datePart}T${timePart}`);
  const start_at = isNaN(start.getTime()) ? now.toISOString() : start.toISOString();

  let end_at: string | undefined;
  if (raw.end_time) {
    const end = new Date(`${datePart}T${raw.end_time}`);
    if (!isNaN(end.getTime())) end_at = end.toISOString();
  }

  const parts: string[] = [];
  if (raw.notes) parts.push(raw.notes);
  if (raw.person) parts.push(`مع: ${raw.person}`);
  if (raw.actions_before?.length) parts.push(`قبل: ${raw.actions_before.join(" | ")}`);
  if (raw.actions_after?.length) parts.push(`بعد: ${raw.actions_after.join(" | ")}`);
  if (raw.recurrence?.pattern && raw.recurrence.pattern !== "none") {
    const every = raw.recurrence.every ? `كل ${raw.recurrence.every}` : "متكرر";
    const days = raw.recurrence.days_of_week?.length ? ` (${raw.recurrence.days_of_week.join(",")})` : "";
    parts.push(`تكرار: ${raw.recurrence.pattern} ${every}${days}`);
  }
  if (raw.tags?.length) parts.push(`وسوم: ${raw.tags.join(", ")}`);

  const hospital = isHospitalAppointment(raw);
  const reminder = raw.reminder_minutes_before ?? (hospital ? 120 : null);
  if (hospital) {
    if (!raw.actions_before?.length) parts.push("اقتراح قبل الموعد: تحضير التحاليل أو الملفات الضرورية");
    if (!raw.actions_after?.length) parts.push("اقتراح بعد الموعد: تدوين الملاحظات والتعليمات الطبية");
    parts.push("تنبيه مقترح: قبل 15 دقيقة على الأقل");
  }
  if (reminder) parts.push(`تذكير قبل: ${reminder} دقيقة`);

  return {
    title: raw.title || "موعد بدون عنوان",
    description: parts.join(" | ") || undefined,
    tag: raw.tags?.[0] ?? null,
    start_at,
    end_at,
    priority: hospital ? "high" : mapTypeToPriority(raw.type ?? ""),
    status: "scheduled",
    location: raw.location ?? undefined,
    reminder_minutes_before: reminder,
  };
}
export default function App() {
  const { fetch, items, loading, remove, add, update } = useAppointments();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const defaultSettings: Settings = { defaultPriority: "medium", reminderWindowMinutes: 15, tags: [] };
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return defaultSettings;
    try {
      const raw = window.localStorage.getItem("nabiuhSettings");
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...defaultSettings,
          ...parsed,
          tags: Array.isArray(parsed?.tags) ? parsed.tags : defaultSettings.tags,
        };
      }
    } catch (error) {
      console.warn("تعذر قراءة إعدادات التخزين المحلي، سيتم استخدام القيم الافتراضية.", error);
    }
    return defaultSettings;
  });
  const [manual, setManual] = useState<FormModel>(() => getManualTemplate(settings));
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState<FormModel>(manual);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const manualRef = useRef<HTMLDivElement | null>(null);
  const [nextReminder, setNextReminder] = useState<Appointment | null>(null);
  const [minutesToReminder, setMinutesToReminder] = useState<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(typeof Notification === "undefined" ? "default" : Notification.permission);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [tone, setTone] = useState<ToneName>("soft");
  const [showSettings, setShowSettings] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorModalState>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) fetch();
    });
    return () => data.subscription.unsubscribe();
  }, [fetch]);

  useEffect(() => {
    if (session) fetch();
  }, [session, fetch]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nabiuhSettings", JSON.stringify(settings));
    }
  }, [settings]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const upcoming = [...items]
        .filter((a) => a.status === "scheduled")
        .map((a) => {
          const windowMinutes = a.reminder_minutes_before ?? settings.reminderWindowMinutes;
          const diff = new Date(a.start_at).getTime() - now;
          return { appt: a, diff, windowMinutes };
        })
        .filter(({ diff, windowMinutes }) => diff > 0 && diff <= windowMinutes * 60 * 1000)
        .sort((a, b) => a.diff - b.diff)[0];
      if (upcoming) {
        setNextReminder(upcoming.appt);
        setMinutesToReminder(Math.max(1, Math.round(upcoming.diff / 60000)));
      } else {
        setNextReminder(null);
        setMinutesToReminder(null);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [items, settings.reminderWindowMinutes]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTone = window.localStorage.getItem("nabiuhTone");
      if (savedTone === "soft" || savedTone === "bright" || savedTone === "digital" || savedTone === "calm" || savedTone === "alert") setTone(savedTone as ToneName);
    }
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("nabiuhTone", tone);
  }, [tone]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const future = new Set(items.filter((a) => a.status === "scheduled").map((a) => a.id));
    notifiedRef.current.forEach((id) => {
      if (!future.has(id)) notifiedRef.current.delete(id);
    });
  }, [items]);

  useEffect(() => {
    if (!nextReminder || minutesToReminder === null) return;
    if (minutesToReminder > settings.reminderWindowMinutes) return;
    const id = nextReminder.id;
    if (notifiedRef.current.has(id)) return;
    notifiedRef.current.add(id);
    playTone(tone);
    if (typeof Notification !== "undefined" && notificationPermission === "granted") {
      const body = `${nextReminder.title} بعد ${minutesToReminder} دقيقة`;
      new Notification("تذكير بالموعد", { body, tag: `appointment-${id}` });
    }
  }, [nextReminder, minutesToReminder, tone, notificationPermission, settings.reminderWindowMinutes]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
      const tagA = a.tag ?? "";
      const tagB = b.tag ?? "";
      if (tagA !== tagB) return tagA.localeCompare(tagB, "ar");
      const reminderA = a.reminder_minutes_before ?? settings.reminderWindowMinutes;
      const reminderB = b.reminder_minutes_before ?? settings.reminderWindowMinutes;
      if (reminderA !== reminderB) return reminderA - reminderB;
      if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
      return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    });
  }, [items, settings.reminderWindowMinutes]);

  const userInitial = (session?.user?.email ?? "").slice(0, 1).toUpperCase() || "أ";

  function requestBellPermission() {
    setNotificationError(null);
    if (typeof Notification === "undefined") {
      setNotificationError("المتصفح لا يدعم التنبيهات.");
      return;
    }
    Notification.requestPermission()
      .then((perm) => setNotificationPermission(perm))
      .catch((err) => setNotificationError(err instanceof Error ? err.message : "تعذر طلب الصلاحية."));
  }

  function playTone(name: ToneName) {
    if (typeof window === "undefined") return;
    const AudioCtor = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = audioCtxRef.current ?? new AudioCtor();
    audioCtxRef.current = ctx;
    ctx.resume?.();
    let start = ctx.currentTime;
    const pattern = tonePatterns[name] || tonePatterns.soft;
    for (const step of pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = step.freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);
      osc.start(start);
      osc.stop(start + step.duration + 0.05);
      start += step.duration + 0.08;
    }
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    setLoginMsg(null);
    setLoginError(null);
    if (!loginEmail.trim() || !password) {
      setLoginError("يرجى إدخال البريد وكلمة المرور.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password });
    if (error) setLoginError(error.message);
    setAuthLoading(false);
  }

  async function handleGoogle() {
    setLoginMsg(null);
    setLoginError(null);
    const redirect = `${window.location.origin}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } });
    if (error) setLoginError(error.message);
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setLoginMsg(null);
    setLoginError(null);
    if (!loginEmail.trim()) {
      setLoginError("أدخل البريد الإلكتروني.");
      return;
    }
    if (password.length < 6) {
      setLoginError("كلمة المرور يجب أن تكون 6 أحرف أو أكثر.");
      return;
    }
    if (password !== passwordConfirm) {
      setLoginError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email: loginEmail.trim(), password });
    if (error) setLoginError(error.message);
    else setLoginMsg("تم إنشاء الحساب. تحقق من بريدك للتفعيل.");
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    setManualError(null);
    if (!manual.title.trim()) {
      setManualError("أدخل عنوان الموعد.");
      return;
    }
    setManualLoading(true);
    try {
      const now = new Date();
      const date = manual.date || now.toISOString().slice(0, 10);
      const time = manual.time || "09:00";
      const start = new Date(`${date}T${time}`);
      const start_at = isNaN(start.getTime()) ? now.toISOString() : start.toISOString();
      const end_at = manual.endTime ? new Date(`${date}T${manual.endTime}`).toISOString() : undefined;
      await add({
        title: manual.title.trim(),
        description: manual.description.trim() || undefined,
        location: manual.location.trim() || undefined,
        tag: manual.tag.trim() || null,
        reminder_minutes_before: manual.reminderMinutes ? parseInt(manual.reminderMinutes, 10) : null,
        start_at,
        end_at,
        priority: manual.priority,
        status: manual.status,
      });
      setManual(getManualTemplate(settings));
      fetch();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "تعذر حفظ الموعد.");
      setErrorModal({ title: "حدث خطأ أثناء إضافة الموعد", message: err instanceof Error ? err.message : "خطأ غير متوقع. حاول مجددًا." });
    } finally {
      setManualLoading(false);
    }
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    if (!editForm.title.trim()) {
      setEditError("أدخل عنوان الموعد.");
      return;
    }
    setEditLoading(true);
    try {
      const base = toDateParts(editTarget);
      const date = editForm.date || base.date;
      const time = editForm.time || base.time;
      const start = new Date(`${date}T${time}`);
      const start_at = isNaN(start.getTime()) ? editTarget.start_at : start.toISOString();
      const end_at = editForm.endTime ? new Date(`${date}T${editForm.endTime}`).toISOString() : undefined;
      await update(editTarget.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        location: editForm.location.trim() || undefined,
        tag: editForm.tag.trim() || null,
        reminder_minutes_before: editForm.reminderMinutes ? parseInt(editForm.reminderMinutes, 10) : null,
        start_at,
        end_at,
        priority: editForm.priority,
        status: editForm.status,
      });
      setEditTarget(null);
      fetch();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "تعذر تعديل الموعد.");
      setErrorModal({ title: "حدث خطأ أثناء تعديل الموعد", message: err instanceof Error ? err.message : "خطأ غير متوقع. حاول مجددًا." });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleAiSubmit(e: FormEvent) {
    e.preventDefault();
    setAiError(null);
    setAiSuccess(null);
    if (!aiText.trim()) {
      setAiError("اكتب تفاصيل الموعد أولاً.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await sendToAtlas(aiText.trim());
      const content = res.assistant;
      const parsed = typeof content === "string" ? extractAppointmentsJSON(content) : content;
      const appointmentsRaw = Array.isArray(parsed?.appointments) ? parsed.appointments : [];
      if (!appointmentsRaw.length) throw new Error("لم يتم استخراج أي مواعيد.");
      const toInsert = appointmentsRaw.map((item: AtlasAppointment) => convertAtlasToAppointment(item));
      for (const appt of toInsert) await add(appt);
      setAiSuccess(`تمت إضافة ${toInsert.length} موعد/مواعيد.`);
      setAiText("");
      fetch();
    } catch (err) {
      setAiError(isRateLimitError(err) ? "الرجاء الانتظار ثم المحاولة مجددًا (429)." : err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
      const msg = isRateLimitError(err) ? "تجاوزت الحد المسموح. الرجاء الانتظار ثم المحاولة." : err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
      setErrorModal({ title: "تعذر إضافة الموعد آليًا", message: msg });
    } finally {
      setAiLoading(false);
    }
  }

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center text-slate-700">يتم التحميل...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-white bg-[radial-gradient(circle_at_20%_20%,#152341_0%,#0f1b33_45%,#0a1427_100%)]">
        <div className="w-full max-w-xl space-y-5 glass-card p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 bg-white/5">مرحبًا بعودتك</div>
              <h1 className="mt-3 text-3xl font-bold">تسجيل الدخول</h1>
              <p className="mt-2 text-white/80 text-sm">أدر مواعيدك بسهولة وسرعة. استخدم بريدك أو حساب Google.</p>
            </div>
            <button className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80 hover:border-white/40" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
              {authMode === "login" ? "إنشاء حساب" : "تسجيل الدخول"}
            </button>
          </div>

          <form className="space-y-3" onSubmit={authMode === "login" ? handlePasswordLogin : handleSignup}>
            <input className="input bg-white/90 text-slate-900" type="email" placeholder="البريد الإلكتروني" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            <div className="relative">
              <input className="input bg-white/90 text-slate-900 pr-10" type={showPassword ? "text" : "password"} placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="absolute inset-y-0 right-2 flex items-center text-sm text-slate-500" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "إخفاء" : "إظهار"}
              </button>
            </div>
            {authMode === "signup" && (
              <div className="relative">
                <input className="input bg-white/90 text-slate-900 pr-10" type={showPasswordConfirm ? "text" : "password"} placeholder="تأكيد كلمة المرور" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
                <button type="button" className="absolute inset-y-0 right-2 flex items-center text-sm text-slate-500" onClick={() => setShowPasswordConfirm((v) => !v)}>
                  {showPasswordConfirm ? "إخفاء" : "إظهار"}
                </button>
              </div>
            )}
            {loginError && <p className="text-sm text-rose-200">{loginError}</p>}
            {loginMsg && <p className="text-sm text-emerald-200">{loginMsg}</p>}
            <button type="submit" className="btn-primary w-full bg-blue-600 hover:bg-blue-500" disabled={authLoading}>
              {authMode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
            </button>
          </form>

          <div className="text-center text-xs text-white/70">أو</div>
          <button className="w-full rounded-md border border-white/30 bg-white/15 px-4 py-2 font-medium text-white shadow-sm hover:border-white/50" onClick={handleGoogle}>
            الدخول عبر Google
          </button>
          <ul className="mt-3 space-y-1 text-xs text-white/70">
            <li>• بياناتك مرتبطة بحسابك فقط.</li>
            <li>• الذكاء الاصطناعي يستخرج تفاصيل الموعد ويضيف التذكير.</li>
            <li>• يمكنك دائمًا الإضافة أو التعديل يدويًا.</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <>
      <SettingsOverlay
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        setSettings={setSettings}
        tone={tone}
        onToneChange={setTone}
        playTone={playTone}
        notificationPermission={notificationPermission}
        notificationError={notificationError}
        requestBellPermission={requestBellPermission}
        onResetManual={() => setManual(getManualTemplate(settings))}
      />
      <ErrorModal open={!!errorModal} title={errorModal?.title ?? ""} message={errorModal?.message ?? ""} onClose={() => setErrorModal(null)} />
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
          {nextReminder && minutesToReminder !== null && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">تنبيه: موعد قريب خلال {minutesToReminder} دقيقة</p>
                <p className="text-sm">العنوان: {nextReminder.title}</p>
              </div>
              <span className="text-xs text-amber-700">{formatDate(nextReminder.start_at)}</span>
            </div>
          )}
        <header className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-md md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-white/70">لوحة التحكم</p>
            <h1 className="text-3xl font-bold text-white">المواعيد</h1>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button className="btn-primary" onClick={() => manualRef.current?.scrollIntoView({ behavior: "smooth" })}>إضافة موعد يدوي</button>
            <button className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:border-white/40 hover:bg-white/15" onClick={() => setShowSettings(true)}>⚙️ الإعدادات</button>
            <button className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:border-white/40 hover:bg-white/15" onClick={fetch}>تحديث</button>
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
              <span className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-100 font-semibold">{userInitial}</span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">{session.user?.email}</p>
                <button className="text-xs text-rose-200 hover:underline" onClick={handleLogout}>تسجيل الخروج</button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            {loading ? (
              <p className="text-slate-200">يتم التحميل...</p>
            ) : sortedItems.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-center text-white/70 shadow-lg">لا توجد مواعيد بعد.</div>
            ) : (
              <div className="grid gap-3">
                {sortedItems.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-md hover:border-white/20 hover:bg-white/8 transition"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-white/70">
                          <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15">{statusText[a.status]}</span>
                          {a.tag && <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-100 border border-blue-400/30">#{a.tag}</span>}
                        </div>
                        <h3 className="text-xl font-semibold text-white">{a.title}</h3>
                        {a.description && <p className="text-sm text-white/80 leading-relaxed">{a.description}</p>}
                        <div className="flex flex-wrap gap-3 text-sm text-white/70">
                          {a.location && (
                            <span className="inline-flex items-center gap-1">
                              <span role="img" aria-label="location">
                                📍
                              </span>
                              {a.location}
                            </span>
                          )}
                          {a.reminder_minutes_before && (
                            <span className="inline-flex items-center gap-1">
                              <span role="img" aria-label="bell">
                                🔔
                              </span>
                              قبل {a.reminder_minutes_before} دقيقة
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-white/80">
                        <span className="px-3 py-1 rounded-full border border-white/20 bg-white/10 text-sm font-semibold">{priorityText[a.priority]}</span>
                        <span className="text-sm">{formatDate(a.start_at)}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-blue-400/40 bg-blue-500/15 px-3 py-1.5 text-blue-100 text-sm hover:border-blue-300/60"
                        onClick={() => {
                          setEditTarget(a);
                          setEditForm({
                            ...toDateParts(a),
                            title: a.title,
                            location: a.location ?? "",
                            description: a.description ?? "",
                            priority: a.priority,
                            status: a.status,
                            tag: a.tag ?? "",
                            reminderMinutes: a.reminder_minutes_before ? String(a.reminder_minutes_before) : "",
                          });
                          editRef.current?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-rose-100 text-sm hover:border-rose-300/60"
                        onClick={() => remove(a.id)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div ref={manualRef} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-slate-900">إضافة موعد يدوي</h3>
              <form className="mt-3 space-y-2" onSubmit={handleManualSubmit}>
                  <input className="input" placeholder="عنوان الموعد" value={manual.title} onChange={(e) => setManual((v) => ({ ...v, title: e.target.value }))} disabled={manualLoading} />
                  <input className="input" type="text" placeholder="الموقع" value={manual.location} onChange={(e) => setManual((v) => ({ ...v, location: e.target.value }))} disabled={manualLoading} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" type="date" value={manual.date} onChange={(e) => setManual((v) => ({ ...v, date: e.target.value }))} disabled={manualLoading} />
                    <input className="input" type="time" value={manual.time} onChange={(e) => setManual((v) => ({ ...v, time: e.target.value }))} disabled={manualLoading} />
                    <input className="input" type="time" value={manual.endTime} onChange={(e) => setManual((v) => ({ ...v, endTime: e.target.value }))} placeholder="انتهاء (اختياري)" disabled={manualLoading} />
                    <select className="select" value={manual.tag} onChange={(e) => setManual((v) => ({ ...v, tag: e.target.value }))} disabled={manualLoading}>
                      <option value="">بدون وسم</option>
                      {settings.tags.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      min={5}
                      max={240}
                      placeholder="دقائق التذكير"
                      value={manual.reminderMinutes}
                      onChange={(e) => setManual((v) => ({ ...v, reminderMinutes: e.target.value }))}
                      disabled={manualLoading}
                    />
                    <select className="select" value={manual.priority} onChange={(e) => setManual((v) => ({ ...v, priority: e.target.value as Priority }))} disabled={manualLoading}>
                      <option value="critical">حرجة</option>
                      <option value="high">عالية</option>
                      <option value="medium">متوسطة</option>
                      <option value="low">منخفضة</option>
                  </select>
                  <select className="select" value={manual.status} onChange={(e) => setManual((v) => ({ ...v, status: e.target.value as Status }))} disabled={manualLoading}>
                    <option value="scheduled">مجدول</option>
                    <option value="done">منجز</option>
                    <option value="canceled">ملغي</option>
                  </select>
                </div>
                <textarea className="textarea min-h-[80px]" placeholder="ملاحظات" value={manual.description} onChange={(e) => setManual((v) => ({ ...v, description: e.target.value }))} disabled={manualLoading} />
                {manualError && <p className="text-sm text-red-600">{manualError}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary" disabled={manualLoading}>
                    {manualLoading ? "جارٍ الحفظ..." : "حفظ"}
                  </button>
                  <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" onClick={() => setManual(getManualTemplate(settings))} disabled={manualLoading}>
                    إعادة تعيين
                  </button>
                </div>
              </form>
            </div>

            {editTarget && (
              <div ref={editRef} className="rounded-md border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">تعديل الموعد</h3>
                  <button className="text-sm text-red-600" onClick={() => setEditTarget(null)}>
                    إغلاق
                  </button>
                </div>
                <form className="mt-3 space-y-2" onSubmit={handleEditSubmit}>
                  <input className="input" placeholder="عنوان الموعد" value={editForm.title} onChange={(e) => setEditForm((v) => ({ ...v, title: e.target.value }))} disabled={editLoading} />
                  <input className="input" type="text" placeholder="الموقع" value={editForm.location} onChange={(e) => setEditForm((v) => ({ ...v, location: e.target.value }))} disabled={editLoading} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" type="date" value={editForm.date} onChange={(e) => setEditForm((v) => ({ ...v, date: e.target.value }))} disabled={editLoading} />
                    <input className="input" type="time" value={editForm.time} onChange={(e) => setEditForm((v) => ({ ...v, time: e.target.value }))} disabled={editLoading} />
                    <input className="input" type="time" value={editForm.endTime} onChange={(e) => setEditForm((v) => ({ ...v, endTime: e.target.value }))} placeholder="انتهاء (اختياري)" disabled={editLoading} />
                    <select className="select" value={editForm.tag} onChange={(e) => setEditForm((v) => ({ ...v, tag: e.target.value }))} disabled={editLoading}>
                      <option value="">بدون وسم</option>
                      {settings.tags.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      type="number"
                      min={5}
                      max={240}
                      placeholder="دقائق التذكير"
                      value={editForm.reminderMinutes}
                      onChange={(e) => setEditForm((v) => ({ ...v, reminderMinutes: e.target.value }))}
                      disabled={editLoading}
                    />
                    <select className="select" value={editForm.priority} onChange={(e) => setEditForm((v) => ({ ...v, priority: e.target.value as Priority }))} disabled={editLoading}>
                      <option value="critical">حرجة</option>
                      <option value="high">عالية</option>
                      <option value="medium">متوسطة</option>
                      <option value="low">منخفضة</option>
                    </select>
                    <select className="select" value={editForm.status} onChange={(e) => setEditForm((v) => ({ ...v, status: e.target.value as Status }))} disabled={editLoading}>
                      <option value="scheduled">مجدول</option>
                      <option value="done">منجز</option>
                      <option value="canceled">ملغي</option>
                    </select>
                  </div>
                  <textarea className="textarea min-h-[80px]" placeholder="ملاحظات" value={editForm.description} onChange={(e) => setEditForm((v) => ({ ...v, description: e.target.value }))} disabled={editLoading} />
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary" disabled={editLoading}>
                      {editLoading ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                    </button>
                    <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" onClick={() => setEditTarget(null)} disabled={editLoading}>
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-slate-900">إضافة موعد بالذكاء الاصطناعي</h3>
              <p className="text-sm text-slate-600">اكتب وصف الموعد وسيتم تحليله وإضافته تلقائيًا.</p>
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                مثال: موعد فحص روتيني يوم 12-05-2025 الساعة 4:30 مساءً في عيادة الأسرة مع الدكتور أحمد. تذكير قبل 30 دقيقة وتصنيف طبي.
              </div>
              <form className="mt-3 space-y-2" onSubmit={handleAiSubmit}>
                <textarea
                  className="textarea min-h-[100px]"
                  placeholder="اكتب تفاصيل الموعد: نوعه، التاريخ، الوقت، المكان، الأشخاص، الإجراءات..."
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  disabled={aiLoading}
                />
                {aiError && <p className="text-sm text-red-600">{aiError}</p>}
                {aiSuccess && <p className="text-sm text-emerald-600">{aiSuccess}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary" disabled={aiLoading}>
                    {aiLoading ? "جارٍ التحليل..." : "إضافة تلقائية"}
                  </button>
                  <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" onClick={() => setAiText("")} disabled={aiLoading}>
                    مسح
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
