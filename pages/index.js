import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

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
          margin: 1rem 0;
        }
        button {
          background: #3498db;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: background 0.3s ease;
        }
        button:hover {
          background: #2980b9;
        }
        .loading {
          margin-top: 1rem;
          font-style: italic;
          color: #888;
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
        <h1>Analizador de Pisada</h1>
        <form onSubmit={handleSubmit}>
          <input type="file" name="image" accept="image/*" required />
          <br />
          <button type="submit" disabled={loading}>
            {loading ? 'Analizando...' : 'Analizar Imagen'}
          </button>
        </form>

        {loading && <div className="loading">Analizando imagen, por favor espera...</div>}
        {result && <div className="result">{result}</div>}
      </div>
    </>
  );
}
