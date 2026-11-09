interface Props { url?: string | null; name?: string | null; size?: number }

export default function Avatar({ url, name, size = 40 }: Props) {
  const initials = (name ?? "?").trim().slice(0, 2).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (url) return <img className="avatar" src={url} alt={name ?? ""} style={style} />;
  return <span className="avatar" style={style}>{initials}</span>;
}
