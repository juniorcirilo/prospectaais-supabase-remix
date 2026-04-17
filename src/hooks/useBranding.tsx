import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingConfig {
  platform_name: string;
  auth_title: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_hsl: string; // e.g. "187 85% 53%"
  accent_hsl: string;
}

const DEFAULTS: BrandingConfig = {
  platform_name: "Prospecta AI",
  auth_title: "Evo Disparo",
  logo_url: null,
  favicon_url: null,
  primary_hsl: "187 85% 53%",
  accent_hsl: "263 70% 50%",
};

const BRANDING_KEY = "branding_config";

interface Ctx {
  branding: BrandingConfig;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (next: BrandingConfig) => Promise<void>;
}

const BrandingContext = createContext<Ctx | null>(null);

function applyToDocument(b: BrandingConfig) {
  const root = document.documentElement;
  root.style.setProperty("--primary", b.primary_hsl);
  root.style.setProperty("--ring", b.primary_hsl);
  root.style.setProperty("--sidebar-primary", b.primary_hsl);
  root.style.setProperty("--sidebar-ring", b.primary_hsl);
  root.style.setProperty("--accent", b.accent_hsl);

  document.title = b.platform_name;

  if (b.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = b.favicon_url;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", BRANDING_KEY)
      .maybeSingle();
    if (data?.value) {
      try {
        const parsed = { ...DEFAULTS, ...JSON.parse(data.value) };
        setBranding(parsed);
        applyToDocument(parsed);
      } catch {
        applyToDocument(DEFAULTS);
      }
    } else {
      applyToDocument(DEFAULTS);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (next: BrandingConfig) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: BRANDING_KEY, value: JSON.stringify(next) }, { onConflict: "key" });
    if (error) throw error;
    setBranding(next);
    applyToDocument(next);
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh, save }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
