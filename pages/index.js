import { useState, useRef, useEffect } from 'react';
import PieSVG from '../components/PieSVG';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [buttonText, setButtonText] = useState('Analizar pisada con IA');
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [imageAnalyzed, setImageAnalyzed] = useState(false);
  const [zonasDetectadas, setZonasDetectadas] = useState([]);
  const fileInputRef = useRef(null);

  const steps = [
    'Analizando imagen...',
    'Detectando zonas de presión...',
    'Identificando tipo de pisada...',
    'Generando recomendación personalizada...'
  ];

  useEffect(() => {
    if (loading) {
      let stepIndex = 0;
      const interval = setInterval(() => {
        setButtonText(steps[stepIndex]);
        setProgressStep(stepIndex + 1);
        stepIndex++;
        if (stepIndex === steps.length) clearInterval(interval);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const compressImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            },
            'image/jpeg',
            0.7
          );
        };
      };
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setResult('');
      setButtonText('Analizar pisada con IA');
      setButtonDisabled(false);
      setProgressStep(0);
      setImageAnalyzed(false);
      setZonasDetectadas([]);
    } else {
      setPreview(null);
    }
  };

  const normalizarTexto = (texto) =>
    texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const extraerZonas = (texto) => {
    const zonas = ['dedos', 'metatarsos', 'arco', 'talon'];
    const textoPlano = normalizarTexto(texto);
    return zonas.filter((zona) => textoPlano.includes(zona.replace('-', ' ')));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const originalFile = fileInputRef.current?.files[0];
    if (!originalFile) return;

    setLoading(true);
    setResult('');
    setButtonDisabled(true);
    setProgressStep(0);
    setZonasDetectadas([]);

    try {
      const compressedFile = await compressImage(originalFile);
      const formData = new FormData();
      formData.append('image', compressedFile);

      await new Promise((resolve) => setTimeout(resolve, 8000));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.result) {
        setResult(data.result);
        setZonasDetectadas(extraerZonas(data.result));
        setButtonText('Análisis completado');
        setImageAnalyzed(true);
      } else {
        setResult('Error al analizar la imagen.');
        setButtonText('Error en el análisis');
      }
    } catch (err) {
      console.error(err);
      setResult('Error en la conexión con el servidor.');
      setButtonText('Error en la conexión');
    } finally {
      setLoading(false);
      setButtonDisabled(true);
      setProgressStep(steps.length);
    }
  };

  const renderResultWithBold = (text) => {
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return { __html: html };
  };

  return (
    <>
      <style jsx>{`
        body {
          font-family: 'Segoe UI', sans-serif;
          background: #f1f4f9;
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          background: white;
          padding: 2rem;
          border-radius: 1rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          text-align: center;
          width: 100%;
          max-width: 800px;
        }
        h1 {
          color: #2c3e50;
          margin-bottom: 1rem;
        }
        input[type='file'] {
          display: none;
        }
        .custom-file-upload {
          display: inline-block;
          padding: 10px 20px;
          cursor: pointer;
          background-color: #3498db;
          color: white;
          border-radius: 5px;
          margin-bottom: 0.5rem;
          transition: background 0.3s ease;
        }
        .custom-file-upload:hover {
          background-color: #2980b9;
        }
        .info-text {
          font-size: 0.9rem;
          color: #555;
          margin-bottom: 1rem;
        }
        .preview {
          margin: 1rem auto;
          max-width: 150px;
          max-height: 150px;
          border: 1px solid #ccc;
          border-radius: 5px;
          display: block;
        }
        .steps {
          display: flex;
          justify-content: space-between;
          margin: 1rem 0;
        }
        .step {
          flex: 1;
          height: 6px;
          margin: 0 3px;
          background: #ccc;
          border-radius: 3px;
          transition: background 0.3s ease;
        }
        .step.active {
          background: #2ecc71;
        }
        button {
          background: #2ecc71;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: background 0.3s ease;
          margin-top: 1rem;
        }
        button:hover {
          background: #27ae60;
        }
        button:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        .resultado-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-top: 2rem;
          align-items: start;
        }
        .resultado-texto ul {
          text-align: left;
          padding-left: 1.2rem;
        }
        .resultado-grafico {
          display: flex;
          justify-content: center;
        }

        .lista-zonas {
        margin: 0.5rem 0 0 0;
        padding-left: 0;         
        list-style-position: inside;
        text-align: left;
        }

        .bloque-zonas {
        padding-left: 1.2rem;
        text-align: left;
      }

      .bloque-zonas ul {
        margin: 0.5rem 0 0 0;
        padding-left: 1rem;
        list-style-type: disc;
      }
        .titulo-analisis {
        width: 100%;
        text-align: center;
        font-size: 1.5rem;
        margin-bottom: 1rem;
        color: #1b1b1b;
      }

      `}</style>

      <div className="container">
        <h1>Analizador de Pisada IA</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="file-upload" className="custom-file-upload">
            {imageAnalyzed ? 'Seleccionar nueva imagen' : 'Seleccionar imagen'}
          </label>
          <input
            id="file-upload"
            type="file"
            name="image"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <p className="info-text">
            * La imagen debe ser de una plantilla del pie usada (con marca de pisada visible).
          </p>

          {preview && <img src={preview} alt="preview" className="preview" />}

          {preview && (
            <>
              <button type="submit" disabled={buttonDisabled}>
                {buttonText}
              </button>

              {loading && (
                <div className="steps">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`step ${index < progressStep ? 'active' : ''}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </form>

        {result && (
  <div className="resultado-container">
    <div className="resultado-texto">
      <h2>🧠 Resultado del análisis</h2>
      <div className="bloque-zonas">
        <p><strong>📌 Zonas de presión detectadas:</strong></p>
        <ul className="lista-zonas">
          {zonasDetectadas.map((zona) => (
            <li key={zona}>{zona.replace('-', ' ')}</li>
          ))}
        </ul>
      </div>
    </div>
    <div className="resultado-grafico">
      <PieSVG zonasActivadas={zonasDetectadas} />
    </div>
  </div>
)}
      </div>
    </>
  );
}
