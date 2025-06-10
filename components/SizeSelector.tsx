'use client';

import { Listbox } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';

interface Props {
    sizes: string[];   // ej. ['37-38', '38-39', '40-41', ...]
    onChange: (value: string) => void;
}

export default function SizeSelector({ sizes, onChange }: Props) {
    const [selected, setSelected] = useState(sizes[0]);

    const handleChange = (value: string) => {
        setSelected(value);
        onChange(value);
    };

    return (
        <div className="w-full max-w-xs">
            <Listbox value={selected} onChange={handleChange}>
                {({ open }) => (
                    <>
                        <Listbox.Button
                            className="relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left
                         border focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <span className="block">{selected}</span>
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <ChevronUpDownIcon className="h-5 text-gray-400" />
                            </span>
                        </Listbox.Button>

                        <Transition
                            show={open}
                            enter="transition ease-out duration-100"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="transition ease-in duration-75"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Listbox.Options
                                className="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base
                           shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm"
                            >
                                {sizes.map(size => (
                                    <Listbox.Option
                                        key={size}
                                        value={size}
                                        className={({ active }) =>
                                            `relative cursor-pointer select-none py-2 pl-10 pr-4
                       ${active ? 'bg-sky-600 text-white' : 'text-gray-900'}`
                                        }
                                    >
                                        {({ selected }) => (
                                            <>
                                                <span className={`block ${selected ? 'font-medium' : 'font-normal'}`}>
                                                    {size}
                                                </span>
                                                {selected && (
                                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                                        <CheckIcon className="h-5" />
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </Listbox.Option>
                                ))}
                            </Listbox.Options>
                        </Transition>
                    </>
                )}
            </Listbox>
        </div>
    );
}
