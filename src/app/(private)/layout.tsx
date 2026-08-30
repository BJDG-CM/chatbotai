import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import HistorySync from "@/components/HistorySync";
import { isAuthenticated } from "@/lib/auth";
import { appPath } from "@/lib/paths";

export default async function PrivateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAuthenticated())) redirect(appPath("/login"));

  return (
    <>
      <HistorySync />
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </>
  );
}
