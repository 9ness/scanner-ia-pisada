// hooks/useOptimisticProgress.js  (reemplaza todo el archivo)
import { useEffect, useRef, useState } from 'react';

export const useOptimisticProgress = (
    active,
    estMs = 4000,   // duración total calculada
    rampFactor = 1.00    // hasta dónde llega antes de la respuesta
) => {
    const [pct, setPct] = useState(0);
    const idRef = useRef(null);

    useEffect(() => {
        if (!active) { setPct(0); return; }

        const start = Date.now();
        idRef.current = setInterval(() => {
            const elapsed = Date.now() - start;
            const next = Math.min((elapsed / (estMs * rampFactor)) * 100,
                rampFactor * 100);
            setPct(next);
        }, 60);

        return () => clearInterval(idRef.current);
    }, [active, estMs, rampFactor]);

    // ‼️ Para que no vuelva a 98 %
    const finish = () => {
        clearInterval(idRef.current);  // detén el intervalo
        setPct(100);                   // fija al 100 %
    };

    return { pct, finish };
};
