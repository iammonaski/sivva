import { CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";

export function MaterialStatus({ status }: { status: string }) {
  if (status === "ready") return <Badge className="bg-accent text-primary"><CheckCircle size={14} aria-hidden="true" />Ready</Badge>;
  if (status === "error") return <Badge className="bg-destructive/10 text-foreground [&_svg]:text-destructive"><WarningCircle size={14} aria-hidden="true" />Failed</Badge>;
  return <Badge className="bg-warning/10"><Clock size={14} aria-hidden="true" />{["extracted", "analyzing"].includes(status) ? "Analyzing" : "Processing"}</Badge>;
}
