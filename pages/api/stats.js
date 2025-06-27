import { kv } from 'lib/kv.js';

export default async function handler(req, res) {
    const total = (await kv.get('total_scans')) || 0;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ total });
}