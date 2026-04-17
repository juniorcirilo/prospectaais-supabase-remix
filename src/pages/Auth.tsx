import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/hooks/useBranding";

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const { branding } = useBranding();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRegistrationSetting = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings' as any)
          .select('id, registration_enabled')
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.warn("Could not fetch system_settings:", error);
          setRegistrationEnabled(true);
          return;
        }
        
        if (data) {
          setRegistrationEnabled((data as any).registration_enabled ?? true);
        } else {
          setRegistrationEnabled(true);
        }
      } catch (err) {
        console.warn("Error fetching registration setting:", err);
        setRegistrationEnabled(true);
      }
    };
    fetchRegistrationSetting();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!isLogin && !registrationEnabled) {
      toast({ title: "Registro desabilitado", description: "Novos registros estão desabilitados no momento.", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else if (data.user) {
        // Profile + role are created server-side via the handle_new_user() database trigger.
        // NEVER assign roles client-side — that would allow privilege escalation.
        if (data.session) {
          toast({ title: "Conta criada!", description: "Cadastro concluído. Você já está logado." });
        } else {
          toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar o cadastro." });
        }
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.auth_title} className="w-full h-full object-contain" />
            ) : (
              <MessageCircle className="w-6 h-6 text-primary-foreground" />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">{branding.auth_title}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isLogin ? "Entre na sua conta" : "Crie sua conta"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLogin ? "Entrar" : "Cadastrar"}
            </Button>
          </form>
          {registrationEnabled && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
              </button>
            </div>
          )}
          {!registrationEnabled && !isLogin && (
            <div className="mt-4 text-center">
              <p className="text-sm text-destructive">Novos registros estão desabilitados.</p>
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors mt-1"
              >
                Voltar para login
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
