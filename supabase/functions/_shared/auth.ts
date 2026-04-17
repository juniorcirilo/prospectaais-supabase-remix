// Shared auth helpers for edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface AuthResult {
  userId: string;
  email?: string;
  isAdmin: boolean;
}

/**
 * Validates JWT from Authorization header.
 * Returns { userId, isAdmin } on success, or a Response on failure.
 */
export async function requireAuth(
  req: Request,
  opts: { requireAdmin?: boolean } = {}
): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, error: "Não autenticado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return jsonResponse({ success: false, error: "Token inválido" }, 401);
  }

  const userId = data.claims.sub as string;
  const email = data.claims.email as string | undefined;

  // Check role using service-role client (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = !!roleData;

  if (opts.requireAdmin && !isAdmin) {
    return jsonResponse({ success: false, error: "Acesso restrito a administradores" }, 403);
  }

  return { userId, email, isAdmin };
}
