import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Avatar from "../components/Avatar";
import type { Profile } from "../types";

const AVATAR_SIZE = 256;

// Recadre l'image en carré (centré) et la redimensionne, pour des avatars propres et uniformes.
async function cropToSquare(file: File, size = AVATAR_SIZE): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image illisible."));
      el.src = url;
    });
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Recadrage impossible.");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Conversion impossible."))), "image/jpeg", 0.9);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
    e.target.value = "";
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) return setMsg("Choisissez un fichier image.");
    if (file.size > 8 * 1024 * 1024) return setMsg("Image trop lourde (8 Mo maximum).");
    setMsg(""); setUploading(true);
    try {
      const blob = await cropToSquare(file);
      const preview = URL.createObjectURL(blob);
      setAvatarUrl(preview);
      const path = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
        upsert: true, contentType: "image/jpeg",
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", userId);
      if (dbErr) throw dbErr;
      setAvatarUrl(url);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <h1>Mon profil</h1>
      <div className="card">
        <div className="profile-photo-row">
          <Avatar url={avatarUrl} name={displayName} size={88} />
          <div>
            <label className="file-btn">
              {uploading ? "Envoi en cours…" : "Changer la photo"}
              <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
            </label>
            <p className="hint">Recadrée automatiquement en carré. JPG/PNG, 8 Mo maximum.</p>
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
