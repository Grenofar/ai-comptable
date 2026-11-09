import { supabase } from "./supabase";

export interface MemberProfile { user_id: string; display_name: string; avatar_url: string | null }

// Les tables organization_members et profiles n'ont pas de clé étrangère directe entre
// elles (toutes deux référencent auth.users) : on les combine côté client plutôt que de
// compter sur l'imbrication automatique de PostgREST.
export async function loadOrgMemberProfiles(orgId: string): Promise<MemberProfile[]> {
  const { data: mems } = await supabase.from("organization_members").select("user_id").eq("organization_id", orgId);
  const ids = (mems ?? []).map((m) => m.user_id as string);
  if (!ids.length) return [];
  const { data: profs } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
  return (profs ?? []) as MemberProfile[];
}
