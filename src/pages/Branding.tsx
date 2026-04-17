import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBranding, BrandingConfig } from "@/hooks/useBranding";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, Save, RotateCcw, Palette, Image as ImageIcon, Type } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [
  { name: "Cyan / Roxo (padrão)", primary: "187 85% 53%", accent: "263 70% 50%" },
  { name: "Verde WhatsApp", primary: "142 70% 45%", accent: "160 60% 40%" },
  { name: "Azul Corporativo", primary: "217 91% 60%", accent: "262 83% 58%" },
  { name: "Laranja Energia", primary: "24 95% 53%", accent: "0 84% 60%" },
  { name: "Rosa Moderno", primary: "330 81% 60%", accent: "262 83% 58%" },
];

function hslToHex(hslStr: string): string {
  const [h, s, l] = hslStr.split(" ").map((p) => parseFloat(p));
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function Branding() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { branding, save } = useBranding();
  const [form, setForm] = useState<BrandingConfig>(branding);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

  useEffect(() => {
    setForm(branding);
  }, [branding]);

  if (authLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const update = <K extends keyof BrandingConfig>(key: K, value: BrandingConfig[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleUpload = async (file: File, kind: "logo" | "favicon") => {
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `branding/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("message-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("message-media").getPublicUrl(path);
      update(kind === "logo" ? "logo_url" : "favicon_url", data.publicUrl);
      toast.success(`${kind === "logo" ? "Logo" : "Favicon"} enviado`);
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(form);
      toast.success("Identidade visual salva");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({
      platform_name: "Prospecta AI",
      auth_title: "Evo Disparo",
      logo_url: null,
      favicon_url: null,
      primary_hsl: "187 85% 53%",
      accent_hsl: "263 70% 50%",
    });
    toast.info("Restaurado para padrão. Clique em Salvar para aplicar.");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identidade Visual</h1>
          <p className="text-muted-foreground mt-1">
            Personalize o nome, logo, favicon e cores da plataforma.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Restaurar padrão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      <Tabs defaultValue="text" className="space-y-4">
        <TabsList>
          <TabsTrigger value="text"><Type className="w-4 h-4 mr-2" />Nome & Textos</TabsTrigger>
          <TabsTrigger value="images"><ImageIcon className="w-4 h-4 mr-2" />Logo & Favicon</TabsTrigger>
          <TabsTrigger value="colors"><Palette className="w-4 h-4 mr-2" />Cores</TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Nome e Textos</CardTitle>
              <CardDescription>Aparece na sidebar, título do navegador e tela de login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da plataforma (sidebar / título da aba)</Label>
                <Input value={form.platform_name} onChange={(e) => update("platform_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Título exibido na tela de login</Label>
                <Input value={form.auth_title} onChange={(e) => update("auth_title", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Logo & Favicon</CardTitle>
              <CardDescription>Recomendado: PNG/SVG transparente. Logo: 256x256+. Favicon: 64x64.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Logo</Label>
                  <div className="aspect-square w-full max-w-[180px] rounded-xl bg-secondary flex items-center justify-center overflow-hidden border border-border">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-muted-foreground text-xs">Sem logo</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" disabled={uploading === "logo"}>
                      <label className="cursor-pointer">
                        {uploading === "logo" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Enviar
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")}
                        />
                      </label>
                    </Button>
                    {form.logo_url && (
                      <Button variant="ghost" size="sm" onClick={() => update("logo_url", null)}>Remover</Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Favicon</Label>
                  <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border border-border">
                    {form.favicon_url ? (
                      <img src={form.favicon_url} alt="Favicon" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-muted-foreground text-[10px]">Padrão</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" disabled={uploading === "favicon"}>
                      <label className="cursor-pointer">
                        {uploading === "favicon" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        Enviar
                        <input
                          type="file"
                          accept="image/png,image/svg+xml,image/x-icon"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon")}
                        />
                      </label>
                    </Button>
                    {form.favicon_url && (
                      <Button variant="ghost" size="sm" onClick={() => update("favicon_url", null)}>Remover</Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="colors">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Paleta de Cores</CardTitle>
              <CardDescription>Cor primária (botões, links) e accent (gradientes, destaques).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setForm((f) => ({ ...f, primary_hsl: p.primary, accent_hsl: p.accent }))}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-secondary transition"
                    >
                      <div className="flex">
                        <span className="w-4 h-4 rounded-l" style={{ background: `hsl(${p.primary})` }} />
                        <span className="w-4 h-4 rounded-r" style={{ background: `hsl(${p.accent})` }} />
                      </div>
                      <span className="text-xs">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={hslToHex(form.primary_hsl)}
                      onChange={(e) => update("primary_hsl", hexToHsl(e.target.value))}
                      className="w-14 h-10 rounded-md cursor-pointer bg-transparent border border-border"
                    />
                    <Input
                      value={form.primary_hsl}
                      onChange={(e) => update("primary_hsl", e.target.value)}
                      placeholder="187 85% 53%"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Accent</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={hslToHex(form.accent_hsl)}
                      onChange={(e) => update("accent_hsl", hexToHsl(e.target.value))}
                      className="w-14 h-10 rounded-md cursor-pointer bg-transparent border border-border"
                    />
                    <Input
                      value={form.accent_hsl}
                      onChange={(e) => update("accent_hsl", e.target.value)}
                      placeholder="263 70% 50%"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-6 border border-border" style={{ background: `linear-gradient(135deg, hsl(${form.primary_hsl}), hsl(${form.accent_hsl}))` }}>
                <p className="text-white font-bold text-lg">Pré-visualização do gradiente</p>
                <p className="text-white/80 text-sm">Botões, logos e destaques usarão essas cores.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
