// أنواع المواعيد
export type Priority = "low" | "medium" | "high" | "critical";
export type Status = "scheduled" | "done" | "canceled";

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_at: string;   // ISO Date string
  end_at?: string;    // ISO Date string
  priority: Priority;
  status: Status;
  location?: string;
  keys?: Record<string, string>; // مفاتيح إضافية
  created_at?: string;
  updated_at?: string;
}

// أنواع الوسوم
export interface Tag {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at?: string;
}

// ربط المواعيد بالوسوم
export interface AppointmentTag {
  appointment_id: string;
  tag_id: string;
}

// إعدادات المستخدم
export type WeekStart = "saturday" | "sunday" | "monday";
export type Theme = "dark" | "light" | "auto";

export interface Settings {
  id: string;
  user_id: string;
  default_reminder_minutes: number;
  timezone: string;
  week_start: WeekStart;
  theme: Theme;
}

// التذكيرات
export type ReminderChannel = "app" | "email" | "webpush";

export interface Reminder {
  id: string;
  appointment_id: string;
  remind_at: string; // ISO Date string
  channel: ReminderChannel;
  sent: boolean;
}