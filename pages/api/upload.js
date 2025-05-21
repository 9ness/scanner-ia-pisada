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

      const resizedBuffer = await sharp(originalBuffer)
        .resize({ width: 512 })
        .jpeg({ quality: 70 })
        .toBuffer();

      const base64Image = resizedBuffer.toString('base64');

      const prompt = `
Analiza la imagen de una pisada y responde únicamente si se trata de una fotografía real de una plantilla de pisada con evidencia clara de uso y desgaste. Si la imagen es un dibujo, una ilustración digital, una simulación generada por IA, o no muestra señales físicas claras de presión, no nombres ninguna zona.
En caso de que sí detectes una imagen real con evidencia visible de uso (como marcas, suciedad o hundimientos), responde solo con las zonas de mayor presión, una por línea.
Formato de salida obligatorio:
📌 Zonas de presión detectadas:
(zona 1)
(zona 2)
(zona 3, si hay más)
Zonas posibles (no inventar ni deducir): dedos, metatarsos, arco, exterior, talón.
❌ No respondas nada si no estás completamente seguro de que la imagen representa una pisada real con desgaste visible. No supongas. No rellenes. No interpretes imágenes abstractas o esquemáticas como pisadas reales.
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

      const zonasValidas = ['dedos', 'metatarsos', 'exterior', 'arco', 'talón'];
      const contieneZonas = zonasValidas.some((zona) =>
        result.toLowerCase().includes(zona)
      );

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
