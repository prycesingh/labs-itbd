import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function AdminPasswordPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const rows = await db
    .select({
      password: users.password,
      mustChangePassword: users.mustChangePassword,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const hasPassword = Boolean(rows[0]?.password);
  const mustChange = Boolean(rows[0]?.mustChangePassword);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          {hasPassword ? "Change" : "Set"} <span className="text-itbd-blue">Password</span>
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {mustChange
            ? "You're using a temporary password. Set a new one to continue."
            : hasPassword
              ? "Update your admin credential password."
              : "Set a credential password so you can sign in without SSO."}
        </p>
      </div>
      <div className="itbd-glow-border relative overflow-hidden rounded-2xl bg-black/40 p-6 backdrop-blur-md">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-itbd-blue to-transparent"
        />
        <div className="relative z-10">
          <h2 className="text-lg font-bold text-white">
            {hasPassword ? "Change your password" : "Set your password"}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Minimum 8 characters, with at least one letter and one number.
          </p>
          <div className="mt-4">
            <ChangePasswordForm hasPassword={hasPassword} />
          </div>
        </div>
      </div>
    </main>
  );
}
