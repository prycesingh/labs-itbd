import { auth } from "@/auth";
import { db } from "@/DB/drizzle";
import { users } from "@/DB/schema";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <main className="mx-auto flex w-full max-w-xl flex-col">
      <header>
        <h1 className="text-3xl">
          {hasPassword ? "Change Password" : "Set Password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mustChange
            ? "You're using a temporary password. Set a new one to continue."
            : hasPassword
              ? "Update your admin credential password."
              : "Set a credential password so you can sign in without SSO."}
        </p>
      </header>
      <Separator className="my-4" />
      <Card>
        <CardHeader>
          <CardTitle>
            {hasPassword ? "Change your password" : "Set your password"}
          </CardTitle>
          <CardDescription>
            Minimum 8 characters, with at least one letter and one number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm hasPassword={hasPassword} />
        </CardContent>
      </Card>
    </main>
  );
}
