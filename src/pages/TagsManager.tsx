// src/pages/TagsManager.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Tag = { id: string; name: string; color: string };

export default function TagsManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    supabase.from("tags").select("*").then(({ data }) => setTags(data ?? []));
  }, []);

  const addTag = async () => {
    const { data } = await supabase.from("tags").insert({ name: newTag, color: "#0F62FE" }).select();
    if (data) setTags([...tags, ...data]);
    setNewTag("");
  };

  const deleteTag = async (id: string) => {
    await supabase.from("tags").delete().eq("id", id);
    setTags(tags.filter((t) => t.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">إدارة الوسوم</h1>
      <div className="flex gap-2">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          className="input"
          placeholder="اسم الوسم"
        />
        <button className="btn-primary" onClick={addTag}>إضافة</button>
      </div>
      <ul className="space-y-2">
        {tags.map((tag) => (
          <li key={tag.id} className="flex justify-between items-center border p-2 rounded">
            <span className="tag" style={{ borderColor: tag.color }}>{tag.name}</span>
            <button className="text-red-600" onClick={() => deleteTag(tag.id)}>حذف</button>
          </li>
        ))}
      </ul>
    </div>
  );
}