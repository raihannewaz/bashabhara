import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "destructive" };
const variants = {
  default: "bg-primary text-primary-foreground",
  outline: "border border-input bg-card text-foreground hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground",
};

export function Button({ className, variant = "default", ...props }: Props) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition", variants[variant], className)} {...props} />;
}
