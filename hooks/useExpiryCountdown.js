import { useEffect, useState } from 'react';

/**
 * Devuelve `true` cuando han pasado `durationMs` milisegundos
 * desde la propiedad `timestamp` guardada en localStorage[storageKey].
 *
 * Re-evalúa automáticamente:
 *   • Cada `checkEveryMs` (intervalo)
 *   • Al volver a la pestaña (`visibilitychange`)
 *   • Cuando cambia el almacenamiento (`storage`) —útil si hay varias pestañas
 */
export default function useExpiryCountdown(
    storageKey = 'analisisPisada',
    durationMs = 30 * 60 * 1000,   // 30 min
    checkEveryMs = 30 * 1000       // 30 s
) {
    const [expired, setExpired] = useState(false);

    const compute = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
            if (saved.timestamp) {
                setExpired(Date.now() - saved.timestamp >= durationMs);
            } else {
                setExpired(false);
            }
        } catch {
            setExpired(false);
        }
    };

    useEffect(() => {
        compute();                                    // primera comprobación inmediata
        const id = setInterval(compute, checkEveryMs);

        document.addEventListener('visibilitychange', compute);
        window.addEventListener('storage', compute);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', compute);
            window.removeEventListener('storage', compute);
        };
    }, [storageKey, durationMs, checkEveryMs]);

    return expired;
}
