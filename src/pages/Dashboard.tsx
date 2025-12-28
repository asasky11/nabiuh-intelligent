import { useEffect } from "react";
import { useAppointments } from "../store/useAppointments";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { items, fetch, remove, loading } = useAppointments();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">لوحة المواعيد</h1>
        <Link to="/appointments/new" className="btn-primary">
          + إضافة موعد
        </Link>
      </header>

      {loading ? (
        <div>جارِ التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">لا توجد مواعيد بعد</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border bg-white p-4 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{a.title}</h2>
                  <span className="tag">{a.priority}</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{a.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(a.start_at).toLocaleString()}
                </p>
              </div>
              <div className="mt-3 flex gap-3">
                <Link
                  to={`/appointments/${a.id}`}
                  className="text-brand hover:underline"
                >
                  تفاصيل
                </Link>
                <button
                  className="text-red-600 hover:underline"
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
  );
}