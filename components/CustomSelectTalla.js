// components/CustomSelectTalla.js
import React, { useState, useEffect } from 'react';
import TablaGuiaTallas from 'components/TablaGuiaTallas.js';

const tallas = [
  { label: 'Talla: EU 37 (25.5 cm)', value: '37' },
  { label: 'Talla: EU 38 (26 cm)', value: '38' },
  { label: 'Talla: EU 39 (26.5 cm)', value: '39' },
  { label: 'Talla: EU 40 (27 cm)', value: '40' },
  { label: 'Talla: EU 41 (27.5 cm)', value: '41' },
  { label: 'Talla: EU 42 (28 cm)', value: '42' },
  { label: 'Talla: EU 43 (28.5 cm)', value: '43' },
  { label: 'Talla: EU 44 (29 cm)', value: '44' },
  { label: 'Talla: EU 45 (29.5 cm)', value: '45' },
  { label: 'Talla: EU 46 (30 cm)', value: '46' },
  { label: 'Talla: EU 47 (30.5 cm)', value: '47' },
  { label: 'Talla: EU 48 (31 cm)', value: '48' },
];

export default function CustomSelectTalla({ onSelect }) {
  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mostrarGuiaTallas, setMostrarGuiaTallas] = useState(false); // ✅ Estado para el modal de guía

  const selectedLabel = tallas.find((t) => t.value === selected)?.label || 'Talla: ';

  const handleSelect = (value) => {
    setSelected(value);
    onSelect(value);
    setIsModalOpen(false);
  };

  useEffect(() => {
    const closeOnEsc = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    document.addEventListener('keydown', closeOnEsc);
    return () => document.removeEventListener('keydown', closeOnEsc);
  }, []);

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end', // ✅ alinea los dos abajo
        marginTop: '1rem',
        marginBottom: '0.3rem',
        width: '100%'
      }}>
        <div style={{
          width: '80%', // ✅ le damos más espacio real
          fontWeight: '500',
          fontSize: '0.85rem',
          lineHeight: '1.1',
          textAlign: 'left',
          color: '#000'
        }}>
          Selecciona tu talla *
        </div>

        <button
          type="button"
          onClick={() => setMostrarGuiaTallas(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#007442',
            fontWeight: '500',
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: 0,
            margin: 0,
            textAlign: 'right'
          }}
        >
          Guía de tallas
        </button>
      </div>


      <button
        type="button"
        className="selector-talla-boton"
        onClick={() => setIsModalOpen(true)}
        style={{
          width: '100%',
          padding: '0.35rem 0.75rem',
          fontSize: '0.95rem',
          borderRadius: '8px',
          border: '1px solid #ccc',
          backgroundColor: '#f2f2f2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: '#1f2937', // SIEMPRE negro
        }}
      >
        <span>{selectedLabel}</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#333"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              width: '90%',
              maxHeight: '60%',
              borderRadius: '10px',
              overflowY: 'auto',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              padding: '0.5rem 0',
            }}
          >
            {tallas.map((talla) => (
              <div
                key={talla.value}
                onClick={() => handleSelect(talla.value)}
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontSize: '1rem',
                  color: '#000',
                  backgroundColor: talla.value === selected ? '#e6f0ff' : '#fff',
                  borderBottom: '1px solid #eee',
                }}
              >
                {talla.label}
              </div>
            ))}
          </div>
        </div>
      )}
      {mostrarGuiaTallas && (
        <TablaGuiaTallas onClose={() => setMostrarGuiaTallas(false)} />
      )}
    </>
  );
}
