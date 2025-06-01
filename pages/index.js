import { useState, useRef, useEffect } from 'react';
import PieSVG from '../components/PieSVG';
import { Camera, Plus, WandSparkles } from 'lucide-react';
import { Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { ArrowDown } from 'lucide-react';
import { AlarmClock } from 'lucide-react';
import { Footprints } from 'lucide-react';
import BuyButtonCavo from '../components/BuyButtonCavo';
import BuyButtonPlano from '../components/BuyButtonPlano';



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
  const [tipoPisada, setTipoPisada] = useState('');
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
    if (tendenciaTexto) {
      setTipoPisada(tendenciaTexto);
    }
  }, [tendenciaTexto]);


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
      window.parent.postMessage({ type: 'scrollToIframe', step: 'boton' }, '*');
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
        window.parent.postMessage({ type: 'scrollToIframe', step: 'resultado' }, '*');
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
                <img src="/ejemplo_valido.png" alt="Ejemplo correcto 1" />
                <p className="texto-ejemplo correcto">
                  <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                  <strong>Correcto</strong>
                </p>
              </div>
              <div className="ejemplo">
                <img src="/ejemplo_novalido.png" alt="Ejemplo incorrecto 1" />
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
                      {/* BLOQUE DE ZONAS */}
                      <div>
                        <p>
                          <strong>
                            <MapPin size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
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
                      </div>

                      {/* BLOQUE DE TENDENCIA */}
                      <div>
                        <p>
                          <strong>
                            <Footprints size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                            Tendencia del pie:
                          </strong>
                        </p>
                        <p style={{ margin: 0 }}>{tendenciaTexto}</p>
                      </div>
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
                    <AlarmClock size={18} strokeWidth={2} />
                    La oferta termina en: {tiempoRestante}
                  </p>
                )}


                {tipoPisada.toLowerCase().includes('cavo') && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <BuyButtonCavo />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                      <a
                        href="https://www.pisadaviva.com/products/plantilla-pie-cavo"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '10px 20px',
                          backgroundColor: '#007442',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                        }}
                      >
                        Ver producto
                      </a>
                    </div>
                  </>
                )}

                {tipoPisada.toLowerCase().includes('plano') && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <BuyButtonPlano />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                      <a
                        href="https://www.pisadaviva.com/products/plantilla-pie-plano"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '10px 20px',
                          backgroundColor: '#007442',
                          color: 'white',
                          textDecoration: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                        }}
                      >
                        Ver producto
                      </a>
                    </div>
                  </>
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
