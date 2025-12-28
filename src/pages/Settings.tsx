// src/pages/Settings.tsx
import { useForm } from "react-hook-form";
import { supabase } from "../lib/supabase";

type SettingsForm = {
  default_reminder_minutes: number;
  timezone: string;
  week_start: "saturday" | "sunday" | "monday";
  theme: "dark" | "light" | "auto";
};

export default function SettingsPage() {
  const { register, handleSubmit } = useForm<SettingsForm>({
    defaultValues: {
      default_reminder_minutes: 30,
      timezone: "Asia/Riyadh",
      week_start: "sunday",
      theme: "auto",
    },
  });

  const onSubmit = async (data: SettingsForm) => {
    await supabase.from("settings").upsert(data);
    alert("تم حفظ الإعدادات ✅");
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">إعدادات التطبيق</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <label>التذكير الافتراضي (بالدقائق)</label>
        <input type="number" {...register("default_reminder_minutes")} className="input" />

        <label>المنطقة الزمنية</label>
        <input type="text" {...register("timezone")} className="input" />

        <label>بداية الأسبوع</label>
        <select {...register("week_start")} className="select">
          <option value="saturday">السبت</option>
          <option value="sunday">الأحد</option>
          <option value="monday">الاثنين</option>
        </select>

        <label>المظهر</label>
        <select {...register("theme")} className="select">
          <option value="dark">داكن</option>
          <option value="light">فاتح</option>
          <option value="auto">تلقائي</option>
        </select>

        <button className="btn-primary">حفظ</button>
      </form>
    </div>
  );
}