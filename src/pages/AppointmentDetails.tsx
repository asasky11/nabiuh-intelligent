// src/pages/AppointmentDetails.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Appointment } from "../types";

export default function AppointmentDetails() {
  const { id } = useParams<{ id: string }>();
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    supabase.from("appointments").select("*").eq("id", id).single().then(({ data }) => setAppointment(data));
  }, [id]);

  if (!appointment) return <div>جارِ التحميل...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">{appointment.title}</h1>
      <p>{appointment.description}</p>
      <p>📍 {appointment.location}</p>
      <p>⏰ {new Date(appointment.start_at).toLocaleString()}</p>
      <p>🔑 الأهمية: {appointment.priority}</p>
      <div className="flex gap-2 mt-4">
        <button className="btn-primary">تعديل</button>
        <button className="text-red-600">حذف</button>
      </div>
    </div>
  );
}
