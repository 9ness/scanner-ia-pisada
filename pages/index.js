import { useState, useRef, useEffect } from 'react';
import PieSVG from '../components/PieSVG';
import { Camera, Plus, Scan } from 'lucide-react';
import { Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { ArrowDown } from 'lucide-react';
import { Footprints } from 'lucide-react';
import BuyButtonCavo from '../components/BuyButtonCavo';
import BuyButtonPlano from '../components/BuyButtonPlano';
import { motion, AnimatePresence } from "framer-motion";



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
  const refCargaInicio = useRef(null);
  const [esPieIzquierdo, setEsPieIzquierdo] = useState(false);

  const [tiempoRestante, setTiempoRestante] = useState(null);
  const [tendenciaTexto, setTendenciaTexto] = useState('');

  const steps = [
    'Analizando imagen...',
    'Detectando zonas de presión...',
    'Identificando tipo de pisada...',
    'Generando recomendación personalizada...'
  ];

  useEffect(() => {
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
    if (!persistenciaActiva) {
      console.log('[Persistencia] Desactivada por configuración.');

      const inicioTemporal = Date.now();
      const duracionTemporal = 2 * 60 * 60 * 1000; // 2h
      const expiry = inicioTemporal + duracionTemporal;

      const actualizarTiempo = () => {
        const diff = expiry - Date.now();
        if (diff <= 0) {
          setTiempoRestante(null);
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
      const saved = localStorage.getItem('analisisPisada');
      if (saved) {
        try {
          const { result, zonasDetectadas, expiry, compressedPreview, tendenciaTexto } = JSON.parse(saved);

          if (Date.now() < expiry) {
            console.log('[Persistencia] Restaurando estado completo...');
            setResult(result);
            setZonasDetectadas(zonasDetectadas);
            setTendenciaTexto(tendenciaTexto);
            setTipoPisada(tendenciaTexto);
            setImageAnalyzed(true);
            setCompressedPreview(compressedPreview || null);
            setButtonText('Seleccionar imagen');
            setButtonDisabled(true);
            setProgressStep(steps.length);

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
  }, [persistenciaActiva]);

  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ height }, '*');
    };

    sendHeight(); // inicial
    const observer = new MutationObserver(sendHeight); // cuando cambie el DOM
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);


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
      setTendenciaTexto('');
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
    setTendenciaTexto('');

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

        // 🔹 1. Calcular correctamente la tendencia
        let tendencia = '';
        if (zonas.length > 0) {

          let tendencia = '';
          if (zonas.includes('arco')) {
            tendencia = 'Pie plano pronador';
          } else if (
            zonas.includes('metatarsos') ||
            zonas.includes('talon') ||
            zonas.includes('talón') ||
            zonas.includes('dedos') ||
            zonas.includes('exterior')
          ) {
            tendencia = 'Pie cavo supinador';
          }

          // 🔹 2. Asignar ambos estados
          setTendenciaTexto(tendencia);
          setTipoPisada(tendencia);

          // 🔹 3. Guardar en localStorage
          if (persistenciaActiva) {
            const expiry = Date.now() + 2 * 60 * 60 * 1000; // 2 h
            localStorage.setItem('analisisPisada', JSON.stringify({
              result: data.result,
              zonasDetectadas: zonas,
              expiry,
              compressedPreview,
              tendenciaTexto: tendencia
            }));
          }

          setButtonText('Seleccionar imagen');
          setButtonDisabled(true);
          setImageAnalyzed(true);
          window.parent.postMessage({ type: 'scrollToIframe', step: 'resultado' }, '*');
        } else {
          // Resultado incorrecto
          setButtonText('Analizar pisada con IA');
          setButtonDisabled(false);
        }


        setImageAnalyzed(true);
        window.parent.postMessage({ type: 'scrollToIframe', step: 'resultado' }, '*');
      } else {
        setResult('Error al analizar la imagen.');
        setButtonText('Error en el análisis');
      }
      // Detectar si es izquierdo o derecho
      const textoPlano = normalizarTexto(data.result || '');
      if (textoPlano.includes('izquierdo')) {
        setEsPieIzquierdo(true);
      } else {
        setEsPieIzquierdo(false); // Por defecto derecho
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
                <Lightbulb size={18} color="#007442" style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                Recomendaciones:
              </h3>
              <ol className="recomendaciones-grid">
                <li><span className="numero">1.</span><span className="texto">Foto de plantilla usada</span></li>
                <li><span className="numero">2.</span><span className="texto">Marca de pisada visible</span></li>
                <li><span className="numero">3.</span><span className="texto">Sacar foto a favor de luz</span></li>
              </ol>
            </div>

          )}


          {!preview && !compressedPreview && !result && (
            <div className="ejemplos-subida">
              <div className="ejemplo">
                <div className="imagen-wrapper">
                  <img src="/ejemplo_plantilla_valida.webp" alt="Ejemplo plantilla correcta" />
                </div>
                <p className="texto-ejemplo correcto">
                  <CheckCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                  <strong>Correcto</strong>
                </p>
              </div>
              <div className="ejemplo">
                <div className="imagen-wrapper">
                  <img src="/ejemplo_plantilla_no_valida.webp" alt="Ejemplo plantilla incorrecta" />
                </div>
                <p className="texto-ejemplo incorrecto">
                  <XCircle size={16} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                  <strong>No válido</strong>
                </p>
              </div>
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
                  <Scan size={18} />
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
            <h3 className="titulo-analisis">
              <CheckCircle size={30} color="#28a745" style={{ marginRight: '0.5rem' }} />
              Análisis completado
            </h3>
            <div className="bloque-resultado-final">
              <div className="bloque-superior">
                {/* 1. ZONAS DE PRESIÓN */}
                <motion.div
                  className="bloque-zonas-presion-final"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <div className="grupo-zonas-texto">
                    <p className="titulo-analisis-bloque">
                      Zonas de presión detectadas:
                    </p>
                    <ul className="zonas-detectadas-lista">
                      {zonasDetectadas.map((zona, i) => {
                        const zonaFormateada = zona === 'talon' ? 'talón' : zona;
                        return (
                          <li key={i} className="zona-item">{zonaFormateada}</li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.div>


                {/* 2. PIE SVG */}
                <motion.div
                  className={`bloque-svg-final ${esPieIzquierdo ? 'invertido-horizontal' : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <PieSVG zonasActivadas={zonasDetectadas} />
                </motion.div>

              </div>

              {/* 3. TENDENCIA + IMAGEN */}
              <motion.div
                className="bloque-tendencia-final"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <div className="texto-tendencia-final">
                  <p className="titulo-analisis-bloque">
                    <Footprints size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
                    Tendencia del pie:
                  </p>
                  <p className="texto-pisada-final">{tendenciaTexto}</p>
                </div>
                <img
                  src={tendenciaTexto.toLowerCase().includes('cavo') ? '/supinador.webp' : '/pronador.webp'}
                  alt="Imagen pisada"
                  className="imagen-elegimetro"
                />
              </motion.div>
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
                <div className="bloque-producto-animado">
                  <hr className="linea-separadora" />

                  <div className="recomendacion-container">
                    <ArrowDown color="#1f2937" size={18} />
                    <span className="recomendacion-texto">Nuestro Producto recomendado</span>
                    <ArrowDown color="#1f2937" size={18} />
                  </div>

                  {tiempoRestante && (
                    <div className="bloque-tiempo-restante">
                      <p className="tiempo-label">
                        <span className="tiempo-linea1">¡APROVECHA!</span><br />
                        <span className="tiempo-linea2">Oferta por tu primer escaneo</span>
                      </p>
                      <div className="tiempo-contador">
                        {tiempoRestante.split(" ").map((unidad, i) => {
                          const valor = unidad.slice(0, -1).padStart(2, '0');
                          const tipo = unidad.slice(-1);
                          const label = tipo === 'h' ? 'horas' : tipo === 'm' ? 'minutos' : 'segundos';

                          return (
                            <div key={tipo} className="bloque-tiempo-unidad">
                              <AnimatePresence mode="wait">
                                <motion.span
                                  key={valor}
                                  initial={{ y: -20, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  exit={{ y: 20, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="tiempo-numero"
                                >
                                  {valor}
                                </motion.span>
                              </AnimatePresence>
                              <span className="tiempo-etiqueta">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}


                  <div className="bloque-producto-wrapper">
                    {typeof tipoPisada === 'string' && tipoPisada.toLowerCase().includes('cavo') && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <div className="cuadro-producto">
                            <BuyButtonCavo />
                          </div>
                        </div>
                        <div className="enlace-producto">
                          <a
                            href="https://www.pisadaviva.com/products/plantilla-pie-cavo"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver producto
                          </a>
                        </div>
                      </>
                    )}

                    {typeof tipoPisada === 'string' && tipoPisada.toLowerCase().includes('plano') && (
                      <>
                        <BuyButtonPlano />
                        <div className="enlace-producto">
                          <a
                            href="https://www.pisadaviva.com/products/plantilla-pie-plano"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver producto
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>

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
