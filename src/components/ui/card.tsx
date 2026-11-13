import { cn } from "@/lib/utils";

type Div = React.HTMLAttributes<HTMLDivElement>;
export const Card = ({ className, ...p }: Div) => <div className={cn("rounded-xl border bg-card text-foreground shadow-sm", className)} {...p} />;
export const CardHeader = ({ className, ...p }: Div) => <div className={cn("flex flex-col gap-1 p-5", className)} {...p} />;
export const CardTitle = ({ className, ...p }: Div) => <div className={cn("text-lg font-semibold", className)} {...p} />;
export const CardContent = ({ className, ...p }: Div) => <div className={cn("p-5 pt-0", className)} {...p} />;
