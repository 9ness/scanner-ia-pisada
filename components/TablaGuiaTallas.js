import React, { useState, useRef, useEffect } from 'react';

const columnas = [
    { key: 'marca', label: 'Tallas de la marca' },
    { key: 'usa', label: 'Talla de calzado estadounidense' },
    { key: 'cm', label: 'Talón a punta (cm)' },
    { key: 'eu', label: 'Talla de calzado de la UE' },
    { key: 'uk', label: 'Talla de calzado del Reino Unido' },
];

const datos = {
    cm: [
        { marca: 'EU 37\n(25.5cm)', usa: '5', cm: '25.5', eu: '37', uk: '4.5' },
        { marca: 'EU 38\n(26cm)', usa: '5.5', cm: '26', eu: '38', uk: '5' },
        { marca: 'EU 39\n(26.5cm)', usa: '6', cm: '26.5', eu: '39', uk: '5.5' },
        { marca: 'EU 40\n(27cm)', usa: '7', cm: '27', eu: '40', uk: '6.5' },
        { marca: 'EU 41\n(27.5cm)', usa: '8', cm: '27.5', eu: '41', uk: '7' },
        { marca: 'EU 42\n(28cm)', usa: '8.5', cm: '28', eu: '42', uk: '7.5' },
        { marca: 'EU 43\n(28.5cm)', usa: '9.5', cm: '28.5', eu: '43', uk: '8.5' },
        { marca: 'EU 44\n(29cm)', usa: '10', cm: '29', eu: '44', uk: '9' },
        { marca: 'EU 45\n(29.5cm)', usa: '11', cm: '29.5', eu: '45', uk: '10' },
        { marca: 'EU 46\n(30cm)', usa: '11.5', cm: '30', eu: '46', uk: '10.5' },
        { marca: 'EU 47\n(30.5cm)', usa: '12', cm: '30.5', eu: '47', uk: '11' },
        { marca: 'EU 48\n(31cm)', usa: '13', cm: '31', eu: '48', uk: '12' }
    ],

    in: [
        { marca: 'EU 37\n(25.5cm)', usa: '5', cm: '10.0"', eu: '37', uk: '4.5' },
        { marca: 'EU 38\n(26cm)', usa: '5.5', cm: '10.2"', eu: '38', uk: '5' },
        { marca: 'EU 39\n(26.5cm)', usa: '6', cm: '10.4"', eu: '39', uk: '5.5' },
        { marca: 'EU 40\n(27cm)', usa: '7', cm: '10.6"', eu: '40', uk: '6.5' },
        { marca: 'EU 41\n(27.5cm)', usa: '8', cm: '10.8"', eu: '41', uk: '7' },
        { marca: 'EU 42\n(28cm)', usa: '8.5', cm: '11.0"', eu: '42', uk: '7.5' },
        { marca: 'EU 43\n(28.5cm)', usa: '9.5', cm: '11.2"', eu: '43', uk: '8.5' },
        { marca: 'EU 44\n(29cm)', usa: '10', cm: '11.4"', eu: '44', uk: '9' },
        { marca: 'EU 45\n(29.5cm)', usa: '11', cm: '11.6"', eu: '45', uk: '10' },
        { marca: 'EU 46\n(30cm)', usa: '11.5', cm: '11.8"', eu: '46', uk: '10.5' },
        { marca: 'EU 47\n(30.5cm)', usa: '12', cm: '12.0"', eu: '47', uk: '11' },
        { marca: 'EU 48\n(31cm)', usa: '13', cm: '12.2"', eu: '48', uk: '12' }
    ]

};

export default function TablaGuiaTallas({ onClose }) {
    const [unidad, setUnidad] = useState('cm');
    const filaRefs = useRef([]);

    useEffect(() => {
        // Igualamos alturas
        const filasIzq = document.querySelectorAll('.columna-izq .celda');
        const columnasDer = document.querySelectorAll('.columna-der');
        columnasDer.forEach((col, colIdx) => {
            const celdas = col.querySelectorAll('.celda');
            celdas.forEach((celda, idx) => {
                const refAltura = filasIzq[idx];
                if (refAltura && refAltura.offsetHeight) {
                    celda.style.height = `${refAltura.offsetHeight}px`;
                }
            });
        });
    }, [unidad]);

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem'
        }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    padding: '1rem',
                    maxWidth: '90%',
                    maxHeight: '90%',
                    overflowY: 'auto',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
                    position: 'relative'
                }}
            >
                <h3 style={{
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '1.1rem',
                    marginBottom: '0.2rem'
                }}>Guía de tallas</h3>

                <p style={{
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    marginBottom: '1rem',
                    color: '#555'
                }}>PisadaViva Tabla De Tallas</p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <button
                        type='button'
                        onClick={() => setUnidad('in')}
                        style={{
                            padding: '0.4rem 1rem',
                            borderRadius: '6px',
                            border: '1px solid #007442',
                            backgroundColor: unidad === 'in' ? '#007442' : '#fff',
                            color: unidad === 'in' ? '#fff' : '#007442',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}>in</button>
                    <button
                        type='button'
                        onClick={() => setUnidad('cm')}
                        style={{
                            padding: '0.4rem 1rem',
                            borderRadius: '6px',
                            border: '1px solid #007442',
                            backgroundColor: unidad === 'cm' ? '#007442' : '#fff',
                            color: unidad === 'cm' ? '#fff' : '#007442',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}>cm</button>
                </div>

                <div style={{ display: 'flex', overflowX: 'auto' }}>
                    {/* Columna izquierda fija */}
                    <div className="columna-izq" style={{
                        flexShrink: 0,
                        minWidth: '110px',
                        maxWidth: '110px',
                        position: 'sticky',
                        left: 0,
                        backgroundColor: '#fff',
                        zIndex: 2,
                        borderRight: '1px solid #ccc'
                    }}>
                        {columnas.map((col, idx) => (
                            <div
                                ref={el => filaRefs.current[idx] = el}
                                key={col.key}
                                className="celda"
                                style={{
                                    padding: '0.6rem 0.5rem',
                                    fontWeight: 500,
                                    fontSize: '0.75rem',
                                    borderBottom: '1px solid #eee',
                                    whiteSpace: 'normal',
                                    textAlign: 'center',
                                    lineHeight: '1.1'
                                }}
                            >
                                {col.label}
                            </div>
                        ))}
                    </div>

                    {/* Columnas desplazables */}
                    {datos[unidad].map((fila, idx) => (
                        <div key={idx} className="columna-der" style={{
                            minWidth: '17vw',         // mínimo 20% del ancho de pantalla
                            maxWidth: '20vw',         // máximo 25% del ancho
                            width: '20vw',
                            textAlign: 'center',
                            borderRight: '1px solid #eee',
                            flexShrink: 0
                        }}>
                            {columnas.map(col => (
                                <div key={col.key} className="celda" style={{
                                    padding: '0.6rem 0.4rem',
                                    fontSize: '0.75rem',
                                    borderBottom: '1px solid #eee',
                                    height: '100%',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    lineHeight: '1.2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center'
                                }}>

                                    {col.key === 'marca'
                                        ? (
                                            <>
                                                {fila[col.key].split('\n')[0]}<br />
                                                {fila[col.key].split('\n')[1]}

                                            </>
                                        )
                                        : fila[col.key]
                                    }
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
