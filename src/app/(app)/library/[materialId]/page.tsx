import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialWorkspace } from "@/features/materials/components/material-workspace";

async function Workspace({ params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params;
  return <MaterialWorkspace key={materialId} materialId={materialId} />;
}

export default function MaterialPage({ params }: { params: Promise<{ materialId: string }> }) {
  return <Suspense fallback={<Skeleton className="h-64 w-full" />}><Workspace params={params} /></Suspense>;
}
