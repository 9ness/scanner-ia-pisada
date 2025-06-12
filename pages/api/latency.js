// pages/api/latency.js
import { kv } from 'lib/kv.js';

export default async function handler(_, res) {
    const list = (await kv.lrange('openai_latencies', 0, -1)).map(Number);
    if (!list.length) return res.json({ mean: 4000 });  // fallback 4 s

    // media exponencial (α = 0.3)
    let ewma = list[0], alpha = 0.3;
    for (let i = 1; i < list.length; i++) ewma = alpha * list[i] + (1 - alpha) * ewma;

    res.json({ mean: Math.round(ewma) });
}
