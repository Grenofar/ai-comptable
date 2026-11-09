import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { OrgMembership, OrgRole } from "../types";

const STORAGE_KEY = "ai-comptable:org-id";

interface OrgContextValue {
  orgs: OrgMembership[];
  orgId: string | null;
  orgName: string | null;
  role: OrgRole | null;
  loading: boolean;
  setOrgId: (id: string) => void;
  reload: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

function readStoredOrgId(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const load = useCallback(async (): Promise<OrgMembership[]> => {
    const { data } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name)")
      .order("created_at");
    const list = (data ?? []) as unknown as OrgMembership[];
    setOrgs(list);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await load();
      if (cancelled) return;
      setOrgIdState((current) => {
        if (current && list.some((o) => o.organization_id === current)) return current;
        const stored = readStoredOrgId();
        const valid = list.find((o) => o.organization_id === stored);
        return valid ? stored! : (list[0]?.organization_id ?? null);
      });
      setLoading(false);
      setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, [load]);

  function setOrgId(id: string) {
    setOrgIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible */ }
  }

  const current = orgs.find((o) => o.organization_id === orgId) ?? null;

  const value = useMemo<OrgContextValue>(() => ({
    orgs,
    orgId,
    orgName: current?.organizations?.name ?? null,
    role: current?.role ?? null,
    loading: loading || !initialized,
    setOrgId,
    reload: async () => { await load(); },
  }), [orgs, orgId, current, loading, initialized, load]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg doit être utilisé à l'intérieur de <OrgProvider>.");
  return ctx;
}
