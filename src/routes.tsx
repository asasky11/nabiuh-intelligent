import { BrowserRouter, Routes, Route } from "react-router-dom";

// الصفحات
import Dashboard from "./pages/Dashboard";
import AppointmentDetails from "./pages/AppointmentDetails";
import SettingsPage from "./pages/Settings";
import TagsManager from "./pages/TagsManager";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* الصفحة الرئيسية: لوحة المواعيد */}
        <Route path="/" element={<Dashboard />} />

        {/* تفاصيل موعد محدد */}
        <Route path="/appointments/:id" element={<AppointmentDetails />} />

        {/* صفحة الإعدادات */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* إدارة الوسوم */}
        <Route path="/tags" element={<TagsManager />} />
      </Routes>
    </BrowserRouter>
  );
}