// next.config.js
const FRAME_ANCESTORS = [
    "'self'",
    "https://pisadaviva.com",
    "https://www.pisadaviva.com",
    "https://*.myshopify.com",
    "https://admin.shopify.com"
].join(' ');

const csp = `frame-ancestors ${FRAME_ANCESTORS};`;

module.exports = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    // IMPORTANTE: no pongas X-Frame-Options aquí
                    { key: "Content-Security-Policy", value: csp },
                ],
            },
        ];
    },
};
