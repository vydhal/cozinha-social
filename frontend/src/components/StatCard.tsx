import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon, label, value, hint, accent = "primary", delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "accent" | "warning" | "destructive" | "muted";
  delay?: number;
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-foreground",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={cn("grid h-12 w-12 place-items-center rounded-xl", accentMap[accent])}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-2xl font-bold tracking-tight">{value}</div>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
