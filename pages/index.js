import { useState, useRef } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [buttonText, setButtonText] = useState('Analizar pisada con IA');
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setResult('');
      setButtonText('Analizar pisada con IA');
      setButtonDisabled(false);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setLoading(true);
    setResult('');
    setButtonDisabled(true);

    const steps = [
      'Analizando imagen...',
      'Detectando zonas de presión...',
      'Identificando tipo de pisada...',
      'Generando recomendación personalizada...',
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      setButtonText(steps[stepIndex]);
      stepIndex++;
      if (stepIndex === steps.length) clearInterval(interval);
    }, 2000);

    try {
      // Esperamos los 8 segundos antes de la llamada a la API
      await new Promise((resolve) => setTimeout(resolve, 8000));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.result) {
        setResult(data.result);
      } else {
        setResult('Error al analizar la imagen.');
      }
    } catch (err) {
      setResult('Error en la conexión con el servidor.');
    } finally {
      setLoading(false);
      setButtonText('Analizar Imagen');
      setButtonDisabled(true); // queda deshabilitado tras el análisis
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
          max-width: 500px;
        }
        h1 {
          color: #2c3e50;
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
        .loading-bar {
          height: 4px;
          background: #3498db;
          animation: loading 1.5s infinite;
          margin-top: 1rem;
        }
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 50%; }
          100% { width: 100%; }
        }
        .result {
          margin-top: 1.5rem;
          background: #ecf0f1;
          padding: 1rem;
          border-radius: 0.5rem;
          text-align: left;
          white-space: pre-wrap;
        }
      `}</style>

      <div className="container">
        <h1>Analizador de Pisada IA</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="file-upload" className="custom-file-upload">
            Seleccionar imagen
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
            <button type="submit" disabled={buttonDisabled}>
              {buttonText}
            </button>
          )}
        </form>

        {loading && <div className="loading-bar"></div>}

        {result && (
          <div
            className="result"
            dangerouslySetInnerHTML={renderResultWithBold(result)}
          />
        )}
      </div>
    </>
  );
}
