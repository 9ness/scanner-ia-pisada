import { useState, useEffect, useRef } from 'react';

export function useActiveScanners() {
    const random04 = () => Math.floor(Math.random() * 4) + 1;
    const [active, setActive] = useState(random04());
    const lastValRef = useRef(active);

    useEffect(() => {
        const id = setInterval(() => {
            let next;
            // si el valor anterior fue 1, fuerza un 2
            if (lastValRef.current === 1) {
                next = 2;
            } else {
                next = random04();
            }

            lastValRef.current = next;
            setActive(next);
        }, 15_000);
        return () => clearInterval(id);
    }, []);

    return active;
}
