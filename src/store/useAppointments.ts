import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type Priority = "low" | "medium" | "high" | "critical";
export type Status = "scheduled" | "done" | "canceled";

export type Appointment = {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  priority: Priority;
  status: Status;
  location?: string;
  tag?: string | null;
  reminder_minutes_before?: number | null;
};

type State = {
  items: Appointment[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (a: Omit<Appointment, "id" | "status"> & Partial<Pick<Appointment, "status">>) => Promise<void>;
  update: (id: string, a: Partial<Appointment>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useAppointments = create<State>((set, get) => ({
  items: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    // نحدد المستخدم لجلب مواعيده فقط (متوافق مع RLS)
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    const query = supabase.from("appointments").select("*").order("start_at", { ascending: true });
    const { data, error } = userId ? await query.eq("user_id", userId) : await query;
    if (!error && data) {
      set({ items: data as Appointment[] });
    } else if (error) {
      console.error("Fetch appointments error:", error.message);
    }
    set({ loading: false });
  },
  add: async (a) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    const payload = {
      ...a,
      status: a.status ?? "scheduled",
      user_id: userId,
    };
    const { error } = await supabase.from("appointments").insert(payload);
    if (error) {
      console.error("Insert appointment error:", error.message);
      throw error;
    }
    await get().fetch();
  },
  update: async (id, a) => {
    const { error } = await supabase.from("appointments").update(a).eq("id", id);
    if (!error) await get().fetch();
  },
  remove: async (id) => {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (!error) await get().fetch();
  },
}));
