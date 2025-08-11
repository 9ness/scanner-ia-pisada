// next.config.js
const FRAME_ANCESTORS = [
    "'self'",
    "https://pisadaviva.com",
    "https://www.pisadaviva.com",
    "https://*.myshopify.com",
    "https://admin.shopify.com"
].join(" ");

module.exports = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "Content-Security-Policy", value: `frame-ancestors ${FRAME_ANCESTORS};` }
                ]
            }
        ];
    }
};
