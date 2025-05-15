// upload.js
import formidable from 'formidable';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

      const originalBuffer = await fs.readFile(file.filepath);

      const resizedBuffer = await sharp(originalBuffer)
        .resize({ width: 512 })
        .jpeg({ quality: 70 })
        .toBuffer();

      const base64Image = resizedBuffer.toString('base64');

      const prompt = `
Analiza la imagen de la pisada y responde con las zonas de mayor carga **en este formato exacto**:
Tipo de Pisada: (pronadora, supinadora o neutra)

Zonas de presión detectadas:

(Solo menciona las zonas reales detectadas en esta imagen. Usa exactamente los siguientes nombres para cada zona posible: Dedos, Metatarso interno, Metatarso externo, Arco plantar interno, Borde lateral del pie, Talón).
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
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
        max_tokens: 500,
      });

      let result = response.choices[0]?.message?.content || '';

      const pisadaValida = ['pronadora', 'supinadora', 'neutra'];
      const contienePisadaValida = pisadaValida.some((pisada) =>
        result.toLowerCase().includes(pisada)
      );

      if (!contienePisadaValida) {
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
