import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className={cn("min-h-screen transition-all duration-300", collapsed ? "ml-[68px]" : "ml-[240px]")}>
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
