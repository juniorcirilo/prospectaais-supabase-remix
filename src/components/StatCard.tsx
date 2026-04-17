import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React, { ReactNode } from "react";

interface StatCardProps {
  label?: string;
  title?: string;
  value: string;
  change?: string;
  subtitle?: string;
  changeType?: "up" | "down" | "neutral";
  icon: LucideIcon | ReactNode;
  iconColor?: string;
}

export default function StatCard({ label, title, value, change, subtitle, changeType = "neutral", icon, iconColor }: StatCardProps) {
  const displayLabel = label || title || "";
  const displayChange = change || subtitle;

  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    const Icon = icon as LucideIcon;
    return <Icon className={cn("w-5 h-5", iconColor ? "text-foreground" : "text-primary")} />;
  };

  return (
    <div className="glass-card p-5 animate-fade-in-up">
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          iconColor || "bg-primary/10"
        )}>
          {renderIcon()}
        </div>
        {displayChange && (
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            changeType === "up" && "bg-success/10 text-success",
            changeType === "down" && "bg-destructive/10 text-destructive",
            changeType === "neutral" && "bg-muted text-muted-foreground"
          )}>
            {displayChange}
          </span>
        )}
      </div>
      <p className="stat-value">{value}</p>
      <p className="stat-label mt-1">{displayLabel}</p>
    </div>
  );
}
