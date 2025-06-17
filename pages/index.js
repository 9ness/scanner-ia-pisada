import dynamic from 'next/dynamic';
import CustomSelectTalla from 'components/CustomSelectTalla.js';
import { useState, useRef, useEffect } from 'react';
import PieSVG from '../components/PieSVG';
import { Camera, Plus, ScanLine, Lightbulb, CheckCircle, XCircle, Footprints, RefreshCcw } from 'lucide-react';
import { motion } from "framer-motion";
import { useOptimisticProgress } from 'hooks/useOptimisticProgress';
import LiquidBar from 'components/LiquidBar';

export default function Home() {
  const imagenTest = false;
  const persistenciaActiva = true; // ← cambiar a false si quiero desactivar persistencia de cuenta atrás
  const mostrarBotonReset = false; // Cambiar a false para ocultarlo
  const mostrarBotonReinicioExpirado = true; // ⬅️ Puedes poner en false para ocultar el botón aunque expire
  const [loading, setLoading] = useState(false);
  const [buttonText, setButtonText] = useState('Analizar pisada con IA');
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(null);
  const [compressedPreview, setCompressedPreview] = useState(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [imageAnalyzed, setImageAnalyzed] = useState(false);
  const [escaneoEnCurso, setEscaneoEnCurso] = useState(false); // ✅ NUEVO
  const [zonasDetectadas, setZonasDetectadas] = useState([]);
  const [estadoAnalisis, setEstadoAnalisis] = useState('');
  const [tipoPisada, setTipoPisada] = useState('');
  const fileInputRef = useRef(null);
  const analizarRef = useRef(null);
  const analisisRef = useRef(null);
  const progresoRef = useRef(null);
  const scrollDestinoRef = useRef(null);
  const refCargaInicio = useRef(null);
  const [esPieIzquierdo, setEsPieIzquierdo] = useState(false);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);
  const [tendenciaTexto, setTendenciaTexto] = useState('');
  const [idVarianteCavo, setIdVarianteCavo] = useState('');
  const [idVariantePlano, setIdVariantePlano] = useState('');
  const [tallaSeleccionada, setTallaSeleccionada] = useState(null);
  const [analisisExpirado, setAnalisisExpirado] = useState(false);
  // ─── Barra de progreso adaptativa  ────────────────────────
  const [avgLatency, setAvgLatency] = useState(4000);   // 4 s de arranque
  const { pct: progressPct, finish } = useOptimisticProgress(loading, avgLatency, 1);


  // Estado para bloquear render de UI principal antes de restaurar:
  const [isHydrated, setIsHydrated] = useState(!persistenciaActiva);

  const steps = [
    'Analizando imagen...',
    'Detectando zonas de presión...',
    'Identificando tipo de pisada...',
    'Generando recomendación personalizada...'
  ];

  const variantesPorTalla = {
    "37": {
      cavo: "54578030707014",
      plano: "54581077934406",
    },
    "38": {
      cavo: "54578030772550",
      plano: "54581077999942",
    },
    "39": {
      cavo: "54578030838086",
      plano: "54581078065478",
    },
    "40": {
      cavo: "54578030903622",
      plano: "54581078131014",
    },
    "41": {
      cavo: "54578030969158",
      plano: "54581078196550",
    },
    "42": {
      cavo: "54578031034694",
      plano: "54598890455366",
    },
    "43": {
      cavo: "54578031100230",
      plano: "54598898319686",
    },
    "44": {
      cavo: "54578031165766",
      plano: "54598899335494",
    },
    "45": {
      cavo: "54578031231302",
      plano: "54598899827014",
    },
    "46": {
      cavo: "54578031296838",
      plano: "54598900252998",
    },
    "47": {
      cavo: "54578031362374",
      plano: "54598901563718",
    },
    "48": {
      cavo: "54578031427910",
      plano: "54598904447302",
    },
  };
  /*
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
  */
  // ─── Sincroniza pasos con el porcentaje ──────────────────
  useEffect(() => {
    if (!loading) return;

    const thresholds = [20, 40, 60, 80];          // % por paso
    // Encuentra el índice del paso actual
    let idx = thresholds.findIndex(t => progressPct < t);
    if (idx === -1) idx = steps.length - 1;       // 80-100 % → último paso

    setEstadoAnalisis(steps[idx]);
    setProgressStep(idx + 1);                     // para las “pastillas”
  }, [progressPct, loading]);

  useEffect(() => {
    if (mostrarDetalles) {
      const timeout = setTimeout(() => {
        scrollDestinoRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 400); // Ajusta el tiempo según la duración de tu animación
      return () => clearTimeout(timeout);
    }
  }, [mostrarDetalles]);


  useEffect(() => {
    if (!persistenciaActiva) {
      console.log('[Persistencia] Desactivada por configuración.');
      setIsHydrated(true);
      return;
    }
    console.log('[Persistencia] Intentando restaurar estado de análisis previo...');
    const saved = localStorage.getItem('analisisPisada');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const tiempoActual = Date.now();
        const mediaHora = 30 * 60 * 1000;
        //const mediaHora = 3 * 1000; // 3 segundos (para pruebas);

        if (parsed.timestamp && tiempoActual - parsed.timestamp > mediaHora) {
          console.log('[Persistencia] Datos expirados (más de 3 horas)');
          if (mostrarBotonReinicioExpirado) {
            setAnalisisExpirado(true); // ⬅️ Solo marcamos como expirado si se habilita el botón
          }
        }
      } catch (e) {
        console.error('[Persistencia] Error al validar expiración:', e);
        localStorage.removeItem('analisisPisada');
      }
      try {
        const {
          result: savedResult,
          zonasDetectadas: savedZonas,
          tendenciaTexto: savedTendencia,
          compressedPreviewDataUrl: savedCompressedPreview,
          esPieIzquierdo: savedEsPieIzq,
          idVarianteCavo: savedIdVarianteCavo,
          idVariantePlano: savedIdVariantePlano,
        } = JSON.parse(saved);


        console.log('[Persistencia] Restaurando estado:', { savedResult, savedZonas, savedTendencia, savedEsPieIzq });
        // 1. Resultado y bloques
        setResult(savedResult);
        setZonasDetectadas(savedZonas);
        setTendenciaTexto(savedTendencia);
        setTipoPisada(savedTendencia);
        setEsPieIzquierdo(!!savedEsPieIzq);
        setImageAnalyzed(true);
        setEscaneoEnCurso(true); // ✅ Oculta selector si ya había análisis al recargar
        setIdVarianteCavo(savedIdVarianteCavo || '');
        setIdVariantePlano(savedIdVariantePlano || '');

        // 2. Imagen subida (comprimida) en DataURL
        if (savedCompressedPreview) {
          setCompressedPreview(savedCompressedPreview);
          // No seteamos preview con URL.createObjectURL, sino DataURL, así muestra al recargar:
          setPreview(null);
        }

        // 3. Ajustes de UI: botón en “Seleccionar imagen” deshabilitado, progreso final, etc.
        setButtonText('Seleccionar imagen');
        setButtonDisabled(true);
        setProgressStep(steps.length);
      } catch (e) {
        console.error('[Persistencia] Error al parsear localStorage, borrando clave:', e);
        localStorage.removeItem('analisisPisada');
      }
    }
    setIsHydrated(true);
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

  useEffect(() => {
    if (result && zonasDetectadas.length > 0) {
      const timeout = setTimeout(() => {
        if (window.parent) {
          const altura = document.documentElement.scrollHeight;
          window.parent.postMessage({ type: 'setIframeHeight', height: altura }, '*');
          console.log('[Iframe] Altura reenviada tras mostrar resultado:', altura);
        }
      }, 600); // Espera a que termine la animación y render completo

      return () => clearTimeout(timeout);
    }
  }, [result, zonasDetectadas]);

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
      if (persistenciaActiva) {
        localStorage.removeItem('analisisPisada');
        console.log('[Persistencia] Estado previo eliminado al seleccionar nueva imagen');
      }
      // limpiamos estados de análisis previo:
      setPreview(URL.createObjectURL(file));
      setCompressedPreview(null);
      setResult('');
      setZonasDetectadas([]);
      setTendenciaTexto('');
      setTipoPisada('');
      setEsPieIzquierdo(false);
      setImageAnalyzed(false);
      setButtonText('Analizar pisada con IA');
      setButtonDisabled(false);
      setProgressStep(0);
      // Scroll si hacía falta:
      window.parent.postMessage({ type: 'scrollToIframe', step: 'boton' }, '*');
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

    /* ─── Duración fija barra 4,3 s (1,3 s media + 3 s colchón) ── */
    const TOTAL_MS = 4300;
    setAvgLatency(TOTAL_MS);      // el hook ya sabe la duración

    /* marca de tiempo para medir lo que tarda la API */
    const t0 = Date.now();

    /* ahora sí: activa la carga y bloquea el botón */
    setLoading(true);
    setButtonDisabled(true);
    setEscaneoEnCurso(true);      // oculta selector

    /* ─── Resetea estados previos ───────────────────────────────── */
    setResult('');
    setProgressStep(0);
    setZonasDetectadas([]);
    setTendenciaTexto('');
    setTipoPisada('');
    setEsPieIzquierdo(false);
    setCompressedPreview(null);

    try {
      // 1. Comprimir imagen
      const compressedFile = await compressImage(originalFile);

      // 2. Obtener DataURL para persistencia y preview
      const dataUrl = await new Promise((resolve) => {
        const reader2 = new FileReader();
        reader2.readAsDataURL(compressedFile);
        reader2.onload = () => resolve(reader2.result);
        reader2.onerror = () => {
          console.error('Error leyendo Blob a DataURL');
          resolve(null);
        };
      });
      if (dataUrl) {
        setCompressedPreview(dataUrl);
        // NO usamos URL.createObjectURL, usamos DataURL para que persista tras recarga
        setPreview(null);
      } else {
        // Fallback: si falla DataURL, podemos usar URL.createObjectURL para preview inmediato,
        // pero no persistirá. Mejor notificar en consola.
        setCompressedPreview(URL.createObjectURL(compressedFile));
        console.warn('No se pudo generar DataURL para persistencia, preview inmediato con blob URL');
      }

      // 3. Lógica de “espera” o petición a API
      const formData = new FormData();
      formData.append('image', compressedFile);
      /* -------- sube la imagen y cronómetro en paralelo -------- */
      const uploadPromise = (async () => {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        return await res.json();          // devuelve el JSON
      })();

      const delayPromise = new Promise(r => {
        const elapsed = Date.now() - t0;
        /* espera lo que falte para TOTAL_MS, nunca < 0 */
        setTimeout(r, Math.max(0, TOTAL_MS - elapsed));
      });

      /* espera a que terminen AMBAS cosas */
      const [data] = await Promise.all([uploadPromise, delayPromise]);

      finish();                            // barra 98 % → 100 %


      /***** PROCESAR EL RESULTADO *****/
      if (data.result) {
        setResult(data.result);

        /* extraer zonas tal como ya tenías */
        let zonas = extraerZonas(data.result);
        if (zonas.length > 0 && !zonas.includes('metatarsos') && !zonas.includes('arco')) {
          zonas.push('metatarsos');
        }

        if (zonas.length > 0 && zonas.includes('metatarsos') && zonas.includes('arco')) {
          const idx = zonas.indexOf('arco');
          zonas.splice(idx, 1);
        }

        setZonasDetectadas(zonas);

        /* tendencia, lado, UI …  (todo igual que antes) */
        let tendencia = '';
        if (zonas.length > 0) {
          if (zonas.includes('metatarsos')) {
            tendencia = 'Pie cavo supinador';
          } else if (zonas.includes('arco')) {
            tendencia = 'Pie plano pronador';
          } else {
            tendencia = 'Pie cavo supinador';
          }
        }
        setTendenciaTexto(tendencia);
        setTipoPisada(tendencia);

        const textoPlano = normalizarTexto(data.result || '');
        const esIzq = textoPlano.includes('izquierdo');
        setEsPieIzquierdo(esIzq);

        setButtonText('Seleccionar imagen');
        setButtonDisabled(true);
        setImageAnalyzed(true);
        setProgressStep(steps.length);
        window.parent.postMessage({ type: 'scrollToIframe', step: 'resultado' }, '*');

        /* persistencia en localStorage … */
        if (persistenciaActiva) {
          try {
            const payload = {
              result: data.result,
              zonasDetectadas: zonas,
              tendenciaTexto: tendencia,
              compressedPreviewDataUrl: dataUrl || null,
              esPieIzquierdo: esIzq,
              idVarianteCavo,
              idVariantePlano,
              timestamp: Date.now()
            };
            localStorage.setItem('analisisPisada', JSON.stringify(payload));
          } catch (e) {
            console.error('[Persistencia] Error guardando estado:', e);
          }
        }
      } else {
        setResult('Error al analizar la imagen.');
        setButtonText('Analizar pisada con IA');
        setButtonDisabled(false);
      }
      /***** FIN PROCESADO RESULTADO *****/


    } catch (err) {
      console.error(err);
      setResult('Error en la conexión con el servidor.');
      setButtonText('Error en la conexión');
      setButtonDisabled(false);
    } finally {
      setLoading(false);
      // En caso de éxito ya pusimos progressStep = steps.length; en error dejamos listo para reintentar.
    }
  };

  if (!isHydrated) return null;

  return (
    <>

      <div className="container">

        <form onSubmit={handleSubmit}>
          {!(result && zonasDetectadas.length > 0) && (
            <button
              type="button"
              style={{
                opacity: (result && zonasDetectadas.length > 0) || loading ? 0.5 : 1,
                cursor: (result && zonasDetectadas.length > 0) || loading ? 'not-allowed' : 'pointer',
              }}
              onClick={(e) => {
                if (!(result && zonasDetectadas.length > 0) && !loading) {
                  fileInputRef.current.click();
                  //e.preventDefault(); // Bloquea el clic
                }
              }}
              className="custom-file-upload"
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
            </button>

          )}



          <input
            id="file-upload"
            type="file"
            name="image"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={loading}
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


          {(preview || compressedPreview) && !result && (
            <>
              {/* ─── Selector de talla ó barra de carga ────────────────── */}
              <div style={{ minHeight: 56 /* alto del select, ajusta si cambia */ }}>
                {loading ? (
                  /* Muestra la barra SOLO mientras loading === true */
                  <LiquidBar pct={progressPct} />
                ) : (
                  /* Si no está cargando y no existe análisis previo,
                     muestra el selector */
                  !escaneoEnCurso && (
                    <CustomSelectTalla
                      onSelect={(tallaElegida) => {
                        const variantes = variantesPorTalla[tallaElegida];
                        if (variantes) {
                          setIdVarianteCavo(variantes.cavo);
                          setIdVariantePlano(variantes.plano);
                          setTallaSeleccionada(tallaElegida);
                        }
                      }}
                    />
                  )
                )}
              </div>




              <div ref={analizarRef} style={{ paddingTop: '1rem' }}></div>
              <button
                type="submit"
                disabled={loading || buttonDisabled || !tallaSeleccionada}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ScanLine size={18} />
                  {buttonText}
                </span>
              </button>
              {/*
              {loading && (
                <>
                  <div ref={refCargaInicio}></div>
                  <div className="estado-progreso">
                    <span className="spinner" />
                    <span className="estado-analisis">{estadoAnalisis}</span>
                  </div>
                </>
              )}
              {/*
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

              {loading && <LiquidBar pct={progressPct} />}
*/}

            </>
          )}
        </form>

        {result && zonasDetectadas.length > 0 ? (
          <>
            <h3 className="titulo-analisis">
              <CheckCircle size={22} color="#28a745" style={{ marginRight: '0.1rem' }} />
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
                <hr className="linea-separadora" />
                <div className="recomendacion-container">
                  <span className="recomendacion-texto">Tu plantilla personalizada ya está lista</span><br />
                  <span className="recomendacion-texto2">
                    Basado en tu escaneo, esta plantilla es ideal para ti.
                  </span>

                  <p
                    onClick={() => {
                      if (tipoPisada.toLowerCase().includes('cavo')) {
                        window.open(`https://www.pisadaviva.com/products/plantilla-pie-cavo?variant=${idVarianteCavo}`, '_blank');
                      } else if (tipoPisada.toLowerCase().includes('plano')) {
                        window.open(`https://www.pisadaviva.com/products/plantilla-pie-plano?variant=${idVariantePlano}`, '_blank');
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      color: '#007442',
                      fontSize: '14px',
                      marginTop: '4px',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      width: 'fit-content',
                      textDecoration: 'underline'
                    }}
                  >
                    <span>Ver mi plantilla</span>
                    <span style={{ fontSize: '10px' }}></span>
                  </p>

                  {analisisExpirado && mostrarBotonReinicioExpirado && (
                    <button
                      onClick={() => {
                        localStorage.removeItem('analisisPisada');
                        window.location.reload();
                      }}
                      style={{
                        backgroundColor: '#007442',
                        color: '#fff',
                        padding: '0.6rem 1.5rem',
                        border: 'none',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem', // ⬅️ ESPACIADO ENTRE ICONO Y TEXTO
                        marginTop: '1rem',
                        width: '100%',
                        maxWidth: '300px'
                      }}
                    > <RefreshCcw size={18} />
                      Nuevo análisis GRATIS
                    </button>
                  )}
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
                padding: '0.6rem 1.2rem',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '1rem'
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
