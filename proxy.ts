export { middleware as proxy } from "@/auth.edge";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/settings/:path*",
    "/upload/:path*",
    "/style-selection/:path*",
    "/preview/:path*",
    "/result/:path*",
  ],
};
