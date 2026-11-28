import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UploadDocument } from "@/features/materials/components/upload-document";

export function DashboardNavbar({ hasLectures }: { hasLectures: boolean }) {
  return <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
    <h1 className="text-2xl font-medium leading-8 tracking-tight sm:text-[32px] sm:leading-10"><span className="sm:hidden">Study desk</span><span className="hidden sm:inline">Your study desk</span></h1>
    <div className="flex items-center gap-1.5">
      {hasLectures && <UploadDocument label="Add notes" variant="outline" showFileHint />}
      <ThemeToggle className="hidden sm:inline-flex" />
    </div>
  </header>;
}
