import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fileInput = e.target.image;
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setLoading(true);
    setResult('');

    try {
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
    }
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
            onChange={handleFileChange}
            required
          />
          <p className="info-text">
            * La imagen debe ser de una plantilla del pie usada (con marca de pisada visible).
          </p>

          {preview && <img src={preview} alt="preview" className="preview" />}

          {preview && (
            <button type="submit" disabled={loading}>
              {loading ? 'Analizando...' : 'Analizar Imagen'}
            </button>
          )}
        </form>

        {loading && <div className="loading-bar"></div>}
        {result && <div className="result">{result}</div>}
      </div>
    </>
  );
}
