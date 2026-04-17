import { useState } from "react";
import { Database, Copy, Check, ExternalLink, Shield, AlertTriangle, Server, Key, Code2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

const PROJECT_REF = "jhqmuzysahzpollsewgo";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocW11enlzYWh6cG9sbHNld2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMTQyNDAsImV4cCI6MjA5MTg5MDI0MH0.p_LjxQcIFejG3IEFVxxYIfW0QFkhB1ZxlOMl6Husu9E";

const DB_HOST_DIRECT = `db.${PROJECT_REF}.supabase.co`;
const DB_HOST_POOLER = `aws-0-us-east-1.pooler.supabase.com`; // padrão, validar região
const DB_PORT_DIRECT = "5432";
const DB_PORT_POOLER_TX = "6543";
const DB_PORT_POOLER_SESSION = "5432";
const DB_NAME = "postgres";
const DB_USER_DIRECT = "postgres";
const DB_USER_POOLER = `postgres.${PROJECT_REF}`;

const CONN_DIRECT = `postgresql://${DB_USER_DIRECT}:[YOUR-PASSWORD]@${DB_HOST_DIRECT}:${DB_PORT_DIRECT}/${DB_NAME}`;
const CONN_POOLER_TX = `postgresql://${DB_USER_POOLER}:[YOUR-PASSWORD]@${DB_HOST_POOLER}:${DB_PORT_POOLER_TX}/${DB_NAME}`;
const CONN_POOLER_SESSION = `postgresql://${DB_USER_POOLER}:[YOUR-PASSWORD]@${DB_HOST_POOLER}:${DB_PORT_POOLER_SESSION}/${DB_NAME}`;

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className={mono ? "font-mono text-xs bg-secondary/40" : "text-sm bg-secondary/40"}
        />
        <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function DatabaseInfo() {
  const { isAdmin, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in-up max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Conexão com Banco de Dados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Credenciais e instruções para a equipe de desenvolvimento conectar ao Postgres gerenciado.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Shield className="w-3 h-3" /> Apenas Admins
        </Badge>
      </div>

      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertTitle>Atenção — informações sensíveis</AlertTitle>
        <AlertDescription>
          Não compartilhe a senha do banco em código, repositórios públicos ou canais sem criptografia.
          A senha não é exibida aqui — siga as instruções abaixo para obtê-la com segurança.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="postgres">Postgres (Backend)</TabsTrigger>
          <TabsTrigger value="sdk">SDK (Frontend)</TabsTrigger>
          <TabsTrigger value="tools">Ferramentas</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" /> Identificação do Projeto
              </CardTitle>
              <CardDescription>Dados públicos de identificação do backend (Lovable Cloud / Supabase).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyField label="Project Ref" value={PROJECT_REF} />
              <CopyField label="API URL" value={SUPABASE_URL} />
              <CopyField label="Região" value="AWS — us-east-1 (validar no painel)" mono={false} />
              <CopyField label="Versão Postgres" value="15.x (gerenciado)" mono={false} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquitetura de Acesso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Frontend (browser):</strong> usa o SDK <code className="px-1 py-0.5 rounded bg-secondary text-xs">@supabase/supabase-js</code> com a <code className="px-1 py-0.5 rounded bg-secondary text-xs">anon key</code>.
                Acesso aos dados é restringido por <strong className="text-foreground">RLS (Row-Level Security)</strong>.
              </p>
              <p>
                <strong className="text-foreground">Backend (servidores externos / scripts):</strong> conexão direta ao Postgres via <code className="px-1 py-0.5 rounded bg-secondary text-xs">psql</code>, Prisma, Drizzle, etc., usando a senha do banco.
              </p>
              <p>
                <strong className="text-foreground">Edge Functions (Lovable Cloud):</strong> usam <code className="px-1 py-0.5 rounded bg-secondary text-xs">SUPABASE_SERVICE_ROLE_KEY</code> (já injetada como variável de ambiente).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POSTGRES */}
        <TabsContent value="postgres" className="space-y-4">
          <Alert>
            <Key className="w-4 h-4" />
            <AlertTitle>Como obter a senha do banco</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>A senha do Postgres não é armazenada na plataforma. Para obtê-la:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Acesse o painel da Lovable Cloud (Cloud → Database).</li>
                <li>Clique em <strong>Connect</strong> → aba <strong>Database password</strong>.</li>
                <li>Gere uma nova senha (a anterior será invalidada) e armazene em um cofre (1Password, Vault, etc.).</li>
              </ol>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conexão Direta (Postgres)</CardTitle>
              <CardDescription>Use para migrations, scripts administrativos e ferramentas de BI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyField label="Host" value={DB_HOST_DIRECT} />
              <div className="grid grid-cols-2 gap-3">
                <CopyField label="Porta" value={DB_PORT_DIRECT} />
                <CopyField label="Database" value={DB_NAME} />
              </div>
              <CopyField label="Usuário" value={DB_USER_DIRECT} />
              <CopyField label="Connection String" value={CONN_DIRECT} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connection Pooler — Transaction Mode</CardTitle>
              <CardDescription>
                Recomendado para aplicações serverless / edge (Vercel, Cloudflare Workers, AWS Lambda).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyField label="Host" value={DB_HOST_POOLER} />
              <div className="grid grid-cols-2 gap-3">
                <CopyField label="Porta" value={DB_PORT_POOLER_TX} />
                <CopyField label="Database" value={DB_NAME} />
              </div>
              <CopyField label="Usuário" value={DB_USER_POOLER} />
              <CopyField label="Connection String" value={CONN_POOLER_TX} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connection Pooler — Session Mode</CardTitle>
              <CardDescription>
                Use para conexões persistentes (workers de longa duração, ORMs com prepared statements).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyField label="Host" value={DB_HOST_POOLER} />
              <div className="grid grid-cols-2 gap-3">
                <CopyField label="Porta" value={DB_PORT_POOLER_SESSION} />
                <CopyField label="Database" value={DB_NAME} />
              </div>
              <CopyField label="Usuário" value={DB_USER_POOLER} />
              <CopyField label="Connection String" value={CONN_POOLER_SESSION} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SDK */}
        <TabsContent value="sdk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credenciais Públicas (Frontend)</CardTitle>
              <CardDescription>
                Estas chaves podem ser expostas no client. A segurança é garantida por RLS no banco.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyField label="VITE_SUPABASE_URL" value={SUPABASE_URL} />
              <CopyField label="VITE_SUPABASE_PUBLISHABLE_KEY (anon key)" value={ANON_KEY} />
              <CopyField label="VITE_SUPABASE_PROJECT_ID" value={PROJECT_REF} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="w-4 h-4" /> Exemplo de uso (TypeScript)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-secondary/40 p-4 rounded-lg overflow-x-auto font-mono">
{`import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const { data, error } = await supabase
  .from("contacts")
  .select("*")
  .limit(10);`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">REST / GraphQL Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyField label="REST (PostgREST)" value={`${SUPABASE_URL}/rest/v1/`} />
              <CopyField label="GraphQL (pg_graphql)" value={`${SUPABASE_URL}/graphql/v1`} />
              <CopyField label="Realtime (WebSocket)" value={`wss://${PROJECT_REF}.supabase.co/realtime/v1`} />
              <CopyField label="Storage" value={`${SUPABASE_URL}/storage/v1`} />
              <CopyField label="Auth" value={`${SUPABASE_URL}/auth/v1`} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOOLS */}
        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comandos úteis</CardTitle>
              <CardDescription>Substitua <code className="text-xs">[YOUR-PASSWORD]</code> pela senha obtida no painel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">psql (CLI)</p>
                <pre className="text-xs bg-secondary/40 p-3 rounded-lg overflow-x-auto font-mono">
{`psql "${CONN_DIRECT}"`}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">pg_dump (backup)</p>
                <pre className="text-xs bg-secondary/40 p-3 rounded-lg overflow-x-auto font-mono">
{`pg_dump "${CONN_DIRECT}" \\
  --schema=public --no-owner --no-acl \\
  -f backup_$(date +%Y%m%d).sql`}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Prisma (.env)</p>
                <pre className="text-xs bg-secondary/40 p-3 rounded-lg overflow-x-auto font-mono">
{`DATABASE_URL="${CONN_POOLER_TX}?pgbouncer=true"
DIRECT_URL="${CONN_DIRECT}"`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clientes GUI recomendados</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                { name: "TablePlus", url: "https://tableplus.com" },
                { name: "DBeaver", url: "https://dbeaver.io" },
                { name: "Postico (macOS)", url: "https://eggerapps.at/postico2/" },
                { name: "pgAdmin", url: "https://www.pgadmin.org" },
              ].map((tool) => (
                <a
                  key={tool.name}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors"
                >
                  <span className="font-medium text-foreground">{tool.name}</span>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              ))}
            </CardContent>
          </Card>

          <Alert>
            <Shield className="w-4 h-4" />
            <AlertTitle>Boas práticas de segurança</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                <li>Use sempre <strong>SSL</strong> (sslmode=require) em conexões externas.</li>
                <li>Nunca use a <code className="text-xs">service_role key</code> no frontend.</li>
                <li>Rotacione a senha do banco periodicamente (a cada 90 dias).</li>
                <li>Restrinja IPs no painel (Network Restrictions) em produção.</li>
                <li>Mantenha RLS ativada em todas as tabelas com dados sensíveis.</li>
              </ul>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
