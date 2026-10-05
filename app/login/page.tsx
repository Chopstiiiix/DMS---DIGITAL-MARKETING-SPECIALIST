import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-sm font-semibold tracking-widest text-accent">DMS</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 mb-8 text-sm text-muted">Digital Marketing Specialist</p>
        <LoginForm linkError={error === "link"} />
        <p className="mt-6 text-xs text-muted">
          Accounts are created by an administrator. There is no public sign-up.
        </p>
      </div>
    </main>
  );
}
