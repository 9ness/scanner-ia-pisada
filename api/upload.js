import { Readable } from 'stream';
import { Buffer } from 'buffer';
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
      res.status(500).send('Form parsing error');
      return;
    }

    const file = files.image;
    const fileBuffer = await fs.readFile(file[0].filepath);

    try {
      const result = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
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
                  url: `data:image/jpeg;base64,${fileBuffer.toString('base64')}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const responseText = result.choices[0].message.content;
      res.status(200).json({ result: responseText });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
