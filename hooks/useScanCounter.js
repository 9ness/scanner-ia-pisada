import { useState, useEffect } from 'react';

export function useScanCounter() {
    const [count, setCount] = useState(null);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch('/api/stats');
                const { total } = await res.json();
                setCount(total);
            } catch (e) {
                console.error('scan counter', e);
            }
        };
        fetchCount();                     // primera carga
        const id = setInterval(fetchCount, 30_000);
        return () => clearInterval(id);
    }, []);

    const refreshNow = async () => {
        try {
            const res = await fetch('/api/stats');
            const { total } = await res.json();
            setCount(total);
        } catch (e) {
            console.error('refresh scan counter', e);
        }
    };

    return { count, refreshNow };
}
