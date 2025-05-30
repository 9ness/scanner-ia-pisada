import { useState, useRef, useEffect } from 'react';
import PieSVG from '../components/PieSVG';
import { Camera, Plus, WandSparkles } from 'lucide-react';
import { Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { MapPin  } from 'lucide-react';
import { ArrowDown } from 'lucide-react';
import { AlarmClock  } from 'lucide-react';
import { Footprints } from 'lucide-react';


export default function Home() {
  const imagenTest = false;
  const persistenciaActiva = false; // ← cambiar a false si quiero desactivar persistencia de cuenta atrás
  const mostrarBotonReset = false; // Cambiar a false para ocultarlo
  const [loading, setLoading] = useState(false);
  const [buttonText, setButtonText] = useState('Analizar pisada con IA');
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(null);
  const [compressedPreview, setCompressedPreview] = useState(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [imageAnalyzed, setImageAnalyzed] = useState(false);
  const [zonasDetectadas, setZonasDetectadas] = useState([]);
  const [estadoAnalisis, setEstadoAnalisis] = useState('');
  const fileInputRef = useRef(null);
  const analizarRef = useRef(null);
  const analisisRef = useRef(null);
  const progresoRef = useRef(null);
  const refSpinner = useRef(null);
  const refSteps = useRef(null);
  const refCargaInicio = useRef(null);
  const [tiempoRestante, setTiempoRestante] = useState(null);
  const [tendenciaTexto, setTendenciaTexto] = useState('');

  const steps = [
    'Analizando imagen...',
    'Detectando zonas de presión...',
    'Identificando tipo de pisada...',
    'Generando recomendación personalizada...'
  ];

useEffect(() => {
  if (!persistenciaActiva) {
    console.log('[Persistencia] Desactivada por configuración.');
  } else if (!loading) {
    const saved = localStorage.getItem('analisisPisada');
    if (saved) {
      try {
        const { result, zonasDetectadas, expiry, compressedPreview } = JSON.parse(saved);
        if (Date.now() < expiry) {
          console.log('[Persistencia] Restaurando estado completo...');

          // Restaurar estado visual
          setResult(result);
          setZonasDetectadas(zonasDetectadas);
          setImageAnalyzed(true);
          setCompressedPreview(compressedPreview || null);
          setButtonText('Seleccionar imagen');
          setButtonDisabled(true);
          setProgressStep(steps.length);

          // Contador activo
          const actualizarTiempo = () => {
            const diff = expiry - Date.now();
            if (diff <= 0) {
              setTiempoRestante(null);
              localStorage.removeItem('analisisPisada');
              return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTiempoRestante(`${h}h ${m}m ${s}s`);
          };

          actualizarTiempo();
          const interval = setInterval(actualizarTiempo, 1000);
          return () => clearInterval(interval);
        } else {
          localStorage.removeItem('analisisPisada');
          console.log('[Persistencia] Expirada, eliminada.');
        }
      } catch (e) {
        console.error('[Persistencia] Error:', e);
        localStorage.removeItem('analisisPisada');
      }
    }
  }

  if (loading) {
    let stepIndex = 0;
    setEstadoAnalisis(steps[stepIndex]);
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setProgressStep(stepIndex + 1);
        setEstadoAnalisis(steps[stepIndex]);
        analisisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
  progresoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, 100);
      } else {
        setProgressStep(steps.length);
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  } else {
    setEstadoAnalisis('');
  }
}, [loading]);

useEffect(() => {
  const enviarAltura = () => {
    if (window.parent) {
      const altura = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: 'setIframeHeight', height: altura }, '*');
    }
  };

  enviarAltura();
  window.addEventListener('resize', enviarAltura);
  return () => window.removeEventListener('resize', enviarAltura);
}, []);

useEffect(() => {
  if (loading) {
    setTimeout(() => {
      refCargaInicio.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300); // espera ligera para asegurar que se renderizó
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
    const zonas = ['dedos', 'metatarsos', 'arco', 'exterior', 'talon'];
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
      setCompressedPreview(URL.createObjectURL(compressedFile));
      const formData = new FormData();
      formData.append('image', compressedFile);

      await new Promise((resolve) => setTimeout(resolve, 6000));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.result) {
  setResult(data.result);
  const zonas = extraerZonas(data.result);
  // Si no incluye ni metatarsos ni exterior, forzar agregar arco
if (zonas.length > 0 && !zonas.includes('metatarsos') && !zonas.includes('exterior') && !zonas.includes('arco')) {
  zonas.push('arco');
}
  setZonasDetectadas(zonas);

  if (zonas.includes('arco')) {
  setTendenciaTexto('Plano (Pronador)');
} else if (zonas.includes('metatarsos') || zonas.includes('talon') || zonas.includes('talón') || zonas.includes('dedos') || zonas.includes('exterior')) {
  setTendenciaTexto('Cavo (supinador)');
}

  if (zonas.length > 0) {
    if (persistenciaActiva) {
  const existing = localStorage.getItem('analisisPisada');
  if (!existing) {
    const expiry = Date.now() + 2 * 60 * 60 * 1000; // 2 horas
    localStorage.setItem('analisisPisada', JSON.stringify({
      result: data.result,
      zonasDetectadas: zonas,
      expiry,
      compressedPreview: data.preview
    }));
    console.log('[Persistencia] Resultado guardado.');
  } else {
    console.log('[Persistencia] Ya existía, no se sobrescribe.');
  }
}


    // Resultado correcto: mantener botón deshabilitado y texto original
    setButtonText('Seleccionar imagen');
    setButtonDisabled(true);
  } else {
    // Resultado incorrecto: permitir reintento
    setButtonText('Analizar pisada con IA');
    setButtonDisabled(false);
  }

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
  html, body {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    width: 100%;
  }

  * {
    box-sizing: border-box;
  }

  body {
    background: #f1f4f9;
  }

  .header-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    margin-bottom: 1rem;
  }

  .linea-separadora {
    border: none;
    height: 1px;
    background-color: #e5e7eb;
    margin: 2rem auto 1rem auto;
    width: 90%;
  }

  .ejemplos-subida {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    max-width: 320px;
    margin: 0 auto 2rem auto;
  }

  @media (max-width: 480px) {
    .ejemplos-subida {
      padding-bottom: 3rem;
    }
  }

  .ejemplo {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    text-align: center;
    border: 1px solid #eee;
  }

  .ejemplo img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
    border-bottom: 1px solid #eee;
  }

  @media (max-width: 480px) {
    .ejemplo img {
      max-width: 90%;
      margin: 0 auto;
    }
  }

  .etiqueta {
    padding: 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.4rem;
    background: white;
  }

  .texto-ejemplo {
    margin-top: 0.6rem;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .incorrecto {
    color: #e74c3c;
  }

  .correcto {
    color: #007442;
  }

  .recomendacion-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .recomendacion-texto {
    font-size: 1.3rem;
    font-weight: 600;
    color: #1f2937;
  }

  .logo-izquierda {
    width: 70px;
    height: 70px;
    object-fit: contain;
    display: inline-block;
  }

  .recomendaciones-titulo {
    font-size: 1.05rem;
    font-weight: 600;
    color: #1f2937;
    font-family: 'Poppins', sans-serif;
    text-align: center;
    margin-top: 1.2rem;
    margin-bottom: 0.5rem;
  }

  .recomendaciones-grid {
    display: grid;
    row-gap: 0.5rem;
    justify-content: center;
    padding: 0;
    margin: 0 auto 1.5rem auto;
    font-family: 'Poppins', sans-serif;
    counter-reset: item;
  }

  .recomendaciones-grid li {
    display: flex;
    align-items: center;
    font-size: 1rem;
    color: #1f2937;
  }

  .recomendaciones-grid li::before {
    counter-increment: item;
    content: counter(item) ".";
    font-weight: 600;
    width: 1.2rem;
    margin-right: 0.75rem;
    text-align: right;
    color: #1f2937;
  }

  .titulo-logo {
    font-size: 1.7rem;
    text-align: center;
  }

  @media (min-width: 640px) {
    .titulo-logo {
      font-size: 2.7rem;
    }
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #6a994e;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .estado-progreso {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: #333;
    font-family: 'Poppins', sans-serif;
  }

  .estado-analisis {
    font-size: 0.95rem;
    font-weight: 500;
    color: #333;
    font-family: 'Poppins', sans-serif;
  }

  .container {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    text-align: center;
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
  }

  h1 {
    color: #2c3e50;
    margin-bottom: 2rem;
  }

  input[type='file'] {
    display: none;
  }

  .custom-file-upload {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    background-color: #007442;
    color: white;
    border-radius: 12px;
    font-weight: 500;
    font-size: 1rem;
    border: none;
    transition: background 0.3s ease;
  }

  .custom-file-upload:hover {
    background-color: #007442;
  }

  .info-text {
    font-size: 1.1rem;
    color: #555;
    margin-bottom: 1rem;
    margin-left: 2rem;
    margin-right: 2rem;
    text-align: center;
  }

  .info-tip {
    font-size: 0.95rem;
    color: #4a4a4a;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
    text-align: center;
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
    background: #6a994e;
  }

  button {
    background: #6a994e;
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
    background: #6a994e;
  }

  button:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }

  .resultado-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 0rem;
    align-items: start;
  }

  .resultado-texto ul {
    text-align: left;
    padding-left: 1.2rem;
  }

  .resultado-texto {
    margin-top: 1.5rem;
    margin-left: 1rem;
  }

  .resultado-grafico {
    margin-top: 1.5rem;
    display: flex;
    justify-content: center;
  }

  .lista-zonas {
    margin: 0.5rem 0 0 0;
    padding-left: 0;
    list-style-position: inside;
    text-align: left;
  }

  .steps-container {
    max-width: 400px;
    margin: 0 auto;
  }

  .resultado-center {
    max-width: 700px;
    margin: 0 auto;
  }

  .preview-wrapper {
    position: relative;
    width: fit-content;
    margin: 1rem auto;
  }

  .scan-line {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(to right, transparent, rgba(0, 255, 0, 0.7), transparent);
    animation: scan 2s ease-in-out infinite;
    border-radius: 4px;
    box-shadow: 0 0 12px rgba(0, 255, 0, 0.6);
    z-index: 5;
  }

  @keyframes scan {
    0% { top: 0; }
    50% { top: calc(100% - 4px); }
    100% { top: 0; }
  }

  .error-texto {
    font-weight: 500;
    font-size: 1rem;
    text-align: center;
    max-width: 600px;
    margin: 1.5rem auto 0 auto;
    padding: 0 1rem;
  }

  .bloque-tendencia {
    margin-top: 1.5rem;
    text-align: center;
  }

  .texto-tendencia {
    font-size: 1rem;
    color: #1f2937;
    margin-top: 0.5rem;
    line-height: 1.4;
  }

  .bloque-zonas {
    padding-left: 0.5rem;
    text-align: center;
    font-size: 13px;
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
    margin-top: 2.5rem;
    color: #1b1b1b;
  }

  .encabezado-upload {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .texto-upload {
    font-size: 1rem;
    color: #2c3e50;
    font-weight: 600;
  }
`}</style>

      <div className="container">       
             
        <form onSubmit={handleSubmit}>
          {!(result && zonasDetectadas.length > 0) && (
  <label
  htmlFor="file-upload"
  className="custom-file-upload"
  style={{
    opacity: result && zonasDetectadas.length > 0 ? 0.5 : 1,
    cursor: result && zonasDetectadas.length > 0 ? 'not-allowed' : 'pointer',
  }}
  onClick={(e) => {
    if (result && zonasDetectadas.length > 0) {
      e.preventDefault(); // Bloquea el clic
    }
  }}
>
  {imageAnalyzed && zonasDetectadas.length === 0 ? (
    <>
      <Plus size={18} style={{ marginRight: '8px' }} />
      Seleccionar nueva imagen
    </>
  ) : (
    <>
      <Camera size={18} style={{ marginRight: '8px' }} />
      Seleccionar imagen
    </>
  )}
</label>

)}



          <input
  id="file-upload"
  type="file"
  name="image"
  accept="image/*"
  ref={fileInputRef}
  onChange={handleFileChange}
/>
          {!(result && zonasDetectadas.length > 0) && (
  <div className="info-text">
  <h3 className="recomendaciones-titulo">
    <Lightbulb size={18} color="#f5c518" style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
    Recomendaciones:
  </h3>
  <ol className="recomendaciones-grid">
    <li><span>Foto de plantilla usada</span></li>
    <li><span>Marca de pisada visible</span></li>
    <li><span>Sacar foto a favor de luz</span></li>
  </ol>
</div>

)}


          {!preview && !compressedPreview && !result && (
  <div className="ejemplos-subida">
    <div className="ejemplo">
      <img src="/plantillavalida2.png" alt="Ejemplo correcto 1" />
      <p className="texto-ejemplo correcto">
        <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
        <strong>Correcto</strong>
      </p>
    </div>
    <div className="ejemplo">
      <img src="/plantillanovalida2.png" alt="Ejemplo incorrecto 1" />
      <p className="texto-ejemplo incorrecto">
        <XCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
        <strong>No válido</strong>
      </p>
    </div>
    {/*
  <div className="ejemplo">
    <img src="/plantillavalida1.png" alt="Ejemplo correcto 2" />
    <p className="texto-ejemplo correcto">
      <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
      <strong>Correcto</strong>
    </p>
  </div>
  <div className="ejemplo">
    <img src="/plantillanovalida1.png" alt="Ejemplo incorrecto 2" />
    <p className="texto-ejemplo incorrecto">
      <XCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
      <strong>No válido</strong>
    </p>
  </div>
*/} 
  </div>
)}


{(preview || compressedPreview) && (
  <div className="preview-wrapper">
    <img
      src={preview || compressedPreview}
      alt="preview"
      className="preview"
    />
    {loading && <div className="scan-line" />}
  </div>
)}


          {preview && !result && (
            <>
            <div ref={analizarRef} style={{ paddingTop: '1rem' }}></div>
              <button type="submit" disabled={buttonDisabled}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <WandSparkles size={18} />
                  {buttonText}
                </span>
              </button>
              {loading && (
  <>
    <div ref={refCargaInicio}></div>
    <div className="estado-progreso">
      <span className="spinner" />
      <span className="estado-analisis">{estadoAnalisis}</span>
    </div>
  </>
)}



              {loading && (
  <div className="steps-container">
    <div className="steps">
      {steps.map((_, index) => (
        <div
          key={index}
          className={`step ${(index < progressStep || (index === 0 && loading)) ? 'active' : ''}`}
        />
      ))}
    </div>
  </div>
)}

            </>
          )}
        </form>

        {result && zonasDetectadas.length > 0 ? (
          <>
            <div className="resultado-wrapper">
              <h2 className="titulo-analisis" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle size={30} color="#28a745" />
                Resultado del análisis
              </h2>
               <div className="resultado-center">
              <div className="resultado-container">
                <div className="resultado-texto">
                  <div className="bloque-zonas">
                    <p>
                      <strong>
                        <MapPin  size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                        Zonas de presión detectadas:
                      </strong>
                    </p>
                    <ul className="lista-zonas">
                      {zonasDetectadas.map((zona) => (
                        <li key={zona}>
                          {zona === 'talon' ? 'talón' : zona.replace('-', ' ')}
                        </li>
                      ))}

                    </ul>

                    <p>
                      <strong>
                        <Footprints size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                        Tendencia del pie:
                      </strong>
                    </p>
                    <ul className="lista-zonas">
                     {tendenciaTexto}
                    </ul>
                  </div>
                </div>
                <div className="resultado-grafico">
                  <PieSVG zonasActivadas={zonasDetectadas} />
                </div>
              </div>
              </div>
            </div>
          </>
        ) : (
          result && zonasDetectadas.length === 0 && (
            <div className="error-texto">
    {result}
  </div>
          )
        )}

        {result && zonasDetectadas.length > 0 && (
  <>

   {result && zonasDetectadas.length > 0 && (
  <>
    <hr className="linea-separadora" />
    <div className="recomendacion-container">
      <ArrowDown color="#1f2937" size={18} />
      <span className="recomendacion-texto">Nuestro Producto recomendado</span>
      <ArrowDown color="#1f2937" size={18} />
    </div>

    {tiempoRestante && (
      <p style={{
  textAlign: 'center',
  color: '#555',
  fontSize: '1rem',
  marginBottom: '2rem',
  fontWeight: '500',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '0.5rem'
}}>
  <AlarmClock  size={18} strokeWidth={2} />
  La oferta termina en: {tiempoRestante}
</p>
    )}
  </>
)}
  </>
)}

      </div>

      {(imagenTest || mostrarBotonReset) && (
  <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
    {imagenTest && compressedPreview && (
      <button
        onClick={() => {
          const link = document.createElement('a');
          link.href = compressedPreview;
          link.download = 'imagen_comprimida.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
        style={{
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '0.95rem'
        }}
      >
        Descargar imagen comprimida (test)
      </button>
    )}

    {mostrarBotonReset && (
      <button
        onClick={() => {
          localStorage.removeItem('analisisPisada');
          window.location.reload();
        }}
        style={{
          backgroundColor: '#d32f2f',
          color: 'white',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '0.95rem'
        }}
      >
        🔄 Reiniciar análisis (test)
      </button>
    )}
  </div>
)}

    </>
  );
}
