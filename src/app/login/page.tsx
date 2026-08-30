import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isAuthenticated } from "@/lib/auth";
import { appPath } from "@/lib/paths";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect(appPath("/"));

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-5 py-10">
      <LoginForm />
    </main>
  );
}
