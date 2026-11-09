import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Avatar from "../components/Avatar";
import type { Profile } from "../types";

export default function Profil() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);
      setEmail(auth.user.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("user_id", auth.user.id).maybeSingle();
      const p = data as Profile | null;
      if (p) { setDisplayName(p.display_name); setBio(p.bio ?? ""); setAvatarUrl(p.avatar_url); }
    })();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(""); setSaved(false);
    if (!userId) return;
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || "Utilisateur",
      bio: bio.trim() || null,
    }).eq("user_id", userId);
    if (error) return setMsg(error.message);
    setSaved(true);
  }

  async function uploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 2 * 1024 * 1024) return setMsg("Image trop lourde (2 Mo maximum).");
    setUploading(true); setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return setMsg(upErr.message); }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", userId);
    setUploading(false);
    if (dbErr) return setMsg(dbErr.message);
    setAvatarUrl(url);
  }

  return (
    <>
      <h1>Mon profil</h1>
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <Avatar url={avatarUrl} name={displayName} size={72} />
          <div>
            <label>Photo de profil
              <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
            </label>
            {uploading && <p className="hint">Envoi en cours…</p>}
          </div>
        </div>
        <form onSubmit={save}>
          <label>E-mail<input value={email} disabled /></label>
          <label>Nom affiché<input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} maxLength={100} /></label>
          <label>Bio
            <textarea rows={3} value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false); }} maxLength={500} placeholder="Quelques mots sur vous…" />
          </label>
          <button type="submit">Enregistrer</button>
        </form>
        {msg && <p className="msg">{msg}</p>}
        {saved && <p className="ok">Profil enregistré.</p>}
      </div>
    </>
  );
}
