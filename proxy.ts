import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hostnameOf, isAppHost, linkDomainRewritePath } from "@/lib/hosts";

export async function proxy(request: NextRequest) {
  const host = hostnameOf(request.headers);
  const { pathname } = request.nextUrl;

  // A brand's short-link domain: every path is a short link.
  if (!isAppHost(host, process.env.APP_HOSTS)) {
    const url = request.nextUrl.clone();
    url.pathname = linkDomainRewritePath(pathname);
    return NextResponse.rewrite(url);
  }

  // The redirect route is public on the app host too, and the sign-in link
  // has to land somewhere before there is a session.
  if (pathname.startsWith("/r/") || pathname === "/auth/callback") return NextResponse.next();

  // Everything else needs a signed-in user. Refresh the session cookie here,
  // because Server Components cannot write cookies.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
