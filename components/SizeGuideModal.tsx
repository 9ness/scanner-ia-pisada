'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import { SizeRow } from '../data/sizeGuide'
import GuideTable from './GuideTable';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function SizeGuideModal({ open, onClose }: Props) {
    const [unit, setUnit] = useState<'cm' | 'in'>('cm');

    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" className="fixed inset-0 z-50" onClose={onClose}>
                <div className="min-h-screen px-4 text-center">
                    <Transition.Child
                        enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
                        leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
                    >
                        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
                    </Transition.Child>

                    {/* Truco para centrar verticalmente */}
                    <span className="inline-block h-screen align-middle" aria-hidden="true">&#8203;</span>

                    <Transition.Child
                        enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                        leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
                        className="inline-block w-[90vw] max-w-md max-h-[80vh] overflow-hidden align-middle transition-all
                       transform bg-white shadow-xl rounded-2xl text-left"
                    >
                        {/* Cabecera */}
                        <div className="flex items-center justify-between px-6 py-4 border-b">
                            <Dialog.Title className="text-lg font-medium">Guía de tallas</Dialog.Title>
                            <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
                                <XMarkIcon className="w-6" />
                            </button>
                        </div>

                        {/* Toggle cm/in */}
                        <div className="flex justify-end gap-3 px-6 py-3">
                            {(['cm', 'in'] as const).map(u => (
                                <button
                                    key={u}
                                    onClick={() => setUnit(u)}
                                    className={`px-3 py-1.5 rounded-full border text-sm
                             ${unit === u ? 'bg-sky-600 text-white' : 'bg-white text-sky-600'}`}
                                >
                                    {u.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {/* Tabla (contenido desplazable vertical + horizontal) */}
                        <div className="px-6 pb-6 overflow-y-auto">
                            <GuideTable rows={sizeGuide} unit={unit} />
                        </div>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
}
