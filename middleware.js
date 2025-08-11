// middleware.js
import { NextResponse } from "next/server";

const FRAME_ANCESTORS = [
    "'self'",
    "https://pisadaviva.com",
    "https://www.pisadaviva.com",
    "https://*.myshopify.com",
    "https://admin.shopify.com"
].join(" ");

export function middleware() {
    const res = NextResponse.next();

    // Quita cualquier header que bloquee iframes
    res.headers.delete("x-frame-options");
    res.headers.delete("X-Frame-Options");

    // Garantiza frame-ancestors en la CSP (respetando el resto si existiera)
    const existing =
        res.headers.get("content-security-policy") ||
        res.headers.get("Content-Security-Policy") ||
        "";

    const cleaned = existing.replace(/frame-ancestors[^;]*;?/gi, "").trim();
    const value =
        (cleaned ? cleaned.replace(/;?$/, "; ") : "") +
        `frame-ancestors ${FRAME_ANCESTORS};`;
    res.headers.set("Content-Security-Policy", value);

    return res;
}

export const config = { matcher: "/:path*" };
