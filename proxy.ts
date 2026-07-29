import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 renamed Middleware to Proxy. This guards the admin dashboard:
 * it refreshes the Supabase auth session on every request and redirects
 * unauthenticated visitors away from /admin (except the login page).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with Supabase; do not trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPortal = pathname.startsWith("/portal");
  const loginPath = isPortal ? "/portal/login" : "/admin/login";
  const homePath = isPortal ? "/portal" : "/admin";
  const isLogin = pathname === loginPath;

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Guard the two signed-in areas. The public widget, chat API, and embed
  // script are deliberately untouched so visitors never hit auth.
  matcher: ["/admin/:path*", "/portal/:path*"],
};
