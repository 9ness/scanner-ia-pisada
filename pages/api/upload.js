import formidable from 'formidable';
import { OpenAI } from 'openai';
import fs from 'fs/promises';

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

      const fileBuffer = await fs.readFile(file.filepath);
      const base64Image = fileBuffer.toString('base64');
      console.log('Imagen comprimida correctamente');
      console.log('Imagen convertida a base64 correctamente');

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo', // Asegúrate de tener este modelo con capacidad visual
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analiza esta imagen y responde con la siguiente estructura clara:
Tipo de Pisada: (elige entre pronadora, supinadora o neutra)
Zonas donde se hace más carga: (explica las partes donde se nota más presión)
Tipo de plantilla: (indica qué tipo de plantilla se recomienda para este tipo de pisada).`,
              },
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
