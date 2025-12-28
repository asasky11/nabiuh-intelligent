import { useForm } from "react-hook-form";

type FormData = {
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  priority: "low" | "medium" | "high" | "critical";
};

export function AppointmentForm({ onSubmit }: { onSubmit: (v: FormData) => void }) {
  const { register, handleSubmit } = useForm<FormData>({ defaultValues: { priority: "medium" } });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input className="input" placeholder="عنوان الموعد" {...register("title", { required: true })} />
      <textarea className="textarea" placeholder="وصف (اختياري)" {...register("description")} />
      <div className="grid grid-cols-2 gap-4">
        <input type="datetime-local" className="input" {...register("start_at", { required: true })} />
        <input type="datetime-local" className="input" {...register("end_at")} />
      </div>
      <select className="select" {...register("priority")}>
        <option value="low">منخفض</option>
        <option value="medium">متوسط</option>
        <option value="high">مرتفع</option>
        <option value="critical">حرج</option>
      </select>
      <button className="btn-primary" type="submit">حفظ</button>
    </form>
  );
}