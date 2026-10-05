import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getContext } from "@/lib/context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, brand } = await getContext();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-widest text-accent">
            DMS
          </Link>
          {brand && <span className="text-sm font-medium">{brand.name}</span>}
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-muted hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/links" className="text-muted hover:text-foreground">
              Links
            </Link>
          </nav>
          <form action={signOut} className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">{user.email}</span>
            <button type="submit" className="btn-quiet">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {brand ? (
          children
        ) : (
          <div className="card p-6">
            <h1 className="text-lg font-semibold">No brand yet</h1>
            <p className="mt-2 text-sm text-muted">
              Your account is not a member of an organization with a brand. Ask an administrator
              to add you.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
