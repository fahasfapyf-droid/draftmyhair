export { middleware } from "@/auth.edge";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/settings/:path*",
  ],
};