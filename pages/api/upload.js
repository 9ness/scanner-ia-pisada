// upload.js
//import analisisPisada from 'prompts/analisisPisadaV1.js';
import analisisPisada from 'prompts/analisisPisadaV1o4.js';
//import analisisPisada from 'prompts/analisisPisadaV3_4-1-mini.js';
//import analisisPisada from 'prompts/analisisPisadaV2_1_gpt4o.js';
import formidable from 'formidable';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import sharp from 'sharp';
import { kv } from 'lib/kv.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const prompt = analisisPisada;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Only POST requests allowed');
    return;
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error al parsear el formulario:', err);
      res.status(500).json({ error: 'Form parsing error' });
      return;
    }

    try {
      const file = files.image?.[0];
      if (!file) {
        res.status(400).json({ error: 'No se recibió ninguna imagen' });
        return;
      }
      // Validación de tipo y tamaño de imagen
      if (!file.mimetype.startsWith('image/')) {
        res.status(400).json({ error: 'El archivo debe ser una imagen válida (jpeg, png, etc).' });
        return;
      }

      const maxSizeMB = 10;
      if (file.size > maxSizeMB * 1024 * 1024) {
        res.status(400).json({ error: `La imagen no puede superar los ${maxSizeMB}MB.` });
        return;
      }

      const originalBuffer = await fs.readFile(file.filepath);

      // ── CAMBIO mínimo: robustez a sombras/orientación ──────────────────────────
      const resizedBuffer = await sharp(originalBuffer)
        .rotate()                                  // respeta orientación EXIF
        .normalize()                               // mejora contraste en sombras
        .resize({ width: 512 })                    // mantenemos tu tamaño original
        .jpeg({ quality: 70, mozjpeg: true })      // mismo quality, con mozjpeg
        .toBuffer();

      const t0 = Date.now();

      const base64Image = resizedBuffer.toString('base64');

      // ── CAMBIO mínimo: modelo + temperature + system anti-sombras ─────────────
      const response = await openai.chat.completions.create({
        model: 'o4-mini',                 // antes: 'gpt-4.1-mini'
        temperature: 0.2,                 // más cumplimiento de formato
        messages: [
          {
            role: 'system',
            content:
              'Sigue EXACTAMENTE el formato pedido por el usuario. ' +
              'No descartes por sombras suaves, brillos o compresión. ' +
              'Si hay duda pero parece real, analiza igual y reduce "confianza".'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      });

      // ─── Registramos latencia (máx 50 valores) ───────────────
      const latency = Date.now() - t0;             // ms
      await kv.lpush('openai_latencies', latency);
      await kv.ltrim('openai_latencies', 0, 49);
      await kv.incr('total_scans');
      console.log('[latency ms]', latency);

      let result = response.choices[0]?.message?.content || '';
      console.log(`[OpenAI (${response.model}) respuesta completa]:`, result);

      // ── CAMBIO mínimo: validación tolerante con acentos/singulares ────────────
      const zonasValidas = ['dedos', 'dedo', 'metatarsos', 'metatarso', 'arco', 'exterior', 'talón', 'talon'];
      const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const contieneZonas = zonasValidas.some((zona) => norm(result).includes(norm(zona)));

      if (!contieneZonas) {
        result =
          '❌ La imagen no corresponde con una plantilla de pie usada o no tiene la calidad suficiente para analizarla correctamente.';
      }

      res.status(200).json({
        result,
        preview: `data:image/jpeg;base64,${base64Image}`,
      });
    } catch (error) {
      console.error('Error al procesar la imagen con OpenAI:', error.message);
      res.status(500).json({ error: error.message || 'Error desconocido' });
    }
  });
}
