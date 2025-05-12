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

      // Comprimir imagen para optimizar tokens
      const resizedBuffer = await sharp(originalBuffer)
        .resize({ width: 512 }) // tamaño reducido
        .jpeg({ quality: 70 }) // compresión
        .toBuffer();

      const base64Image = resizedBuffer.toString('base64');

      const prompt = `
Analiza esta imagen y responde con la siguiente estructura clara y breve:
- Tipo de Pisada: (pronadora, supinadora o neutra)
- Zonas donde se hace más carga: (solo menciona las zonas específicas del pie donde se nota mayor presión, mostrando un listado)
- Plantilla recomendada: (describe exactamente el tipo de plantilla que se recomienda para esta pisada, en una respuesta de una linea).
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

      const result = response.choices[0]?.message?.content || 'No se recibió respuesta.';
      res.status(200).json({ result });

    } catch (error) {
      console.error('Error al procesar la imagen con OpenAI:', error.message);
      res.status(500).json({ error: error.message || 'Error desconocido' });
    }
  });
}
