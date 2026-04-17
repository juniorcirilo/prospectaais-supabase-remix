import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Search, Users, Megaphone, Zap, MessageSquare, Brain, Shield,
  BarChart3, FlaskConical, Smartphone, Settings, ChevronLeft, MessageCircle, Volume2, Kanban, GitBranch, LogOut, Database,
} from "lucide-react";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";

const navGroups = [
  {
    label: "Geral",
    icon: LayoutDashboard,
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Prospecção",
    icon: Search,
    items: [
      { path: "/scraping", label: "Geração de Listas", icon: Search },
      { path: "/contacts", label: "Contatos", icon: Users },
    ],
  },
  {
    label: "Canais",
    icon: Smartphone,
    items: [
      { path: "/instances", label: "Instâncias WhatsApp", icon: Smartphone },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function AppSidebar({ collapsed, onToggle }: Props) {
  const location = useLocation();
  const { signOut, isAdmin, user } = useAuth();
  const { branding } = useBranding();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-50 backdrop-blur-xl",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 overflow-hidden">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.platform_name} className="w-full h-full object-contain" />
          ) : (
            <MessageCircle className="w-4 h-4 text-primary-foreground" />
          )}
        </div>
        {!collapsed && (
          <span className="font-bold text-foreground text-sm tracking-tight animate-slide-in">
            {branding.platform_name}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-4")}>
            {/* Group label */}
            {!collapsed ? (
              <div className="flex items-center gap-2 px-3 mb-1">
                <group.icon className="w-3.5 h-3.5 text-muted-foreground/70" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold select-none">
                  {group.label}
                </span>
              </div>
            ) : (
              gi > 0 && <div className="mx-3 mb-2 border-t border-sidebar-border" />
            )}

            {/* Sub-items */}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "sidebar-item",
                    !collapsed && "pl-4",
                    location.pathname === item.path && "active"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-0.5">
        {!collapsed && user && (
          <div className="px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">{user.email}</p>
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                isAdmin ? "text-primary" : "text-muted-foreground"
              )}>
                {isAdmin ? "Admin" : "Usuário"}
              </span>
            </div>
          </div>
        )}
        {isAdmin && (
          <>
            <NavLink
              to="/users"
              className={cn(
                "sidebar-item",
                location.pathname === "/users" && "active"
              )}
            >
              <Shield className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>Usuários</span>}
            </NavLink>
            <NavLink
              to="/database-info"
              className={cn(
                "sidebar-item",
                location.pathname === "/database-info" && "active"
              )}
            >
              <Database className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>Banco de Dados</span>}
            </NavLink>
            <NavLink
              to="/branding"
              className={cn(
                "sidebar-item",
                location.pathname === "/branding" && "active"
              )}
            >
              <Palette className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>Identidade Visual</span>}
            </NavLink>
          </>
        )}
        <NavLink
          to="/settings"
          className={cn(
            "sidebar-item",
            location.pathname === "/settings" && "active"
          )}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </NavLink>
        <button
          onClick={signOut}
          className="sidebar-item w-full text-destructive hover:text-destructive"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
        <button
          onClick={onToggle}
          className="sidebar-item w-full"
        >
          <ChevronLeft
            className={cn(
              "w-[18px] h-[18px] shrink-0 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
