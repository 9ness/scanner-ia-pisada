import { SizeRow } from '../data/sizeGuide'

interface Props {
    rows: SizeRow[];
    unit: 'cm' | 'in';
}

export default function GuideTable({ rows, unit }: Props) {
    const toIn = (cm: number) => +(cm / 2.54).toFixed(1);

    return (
        <div className="overflow-x-auto">
            <table className="min-w-[640px] border-collapse text-sm">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="th">Talla marca</th>
                        <th className="th">US</th>
                        <th className="th">{unit === 'cm' ? 'Talón-punta (cm)' : 'Heel-toe (in)'}</th>
                        <th className="th">EU</th>
                        <th className="th">UK</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.brand} className="text-center even:bg-gray-50">
                            <td className="td">{r.brand}</td>
                            <td className="td">{r.us}</td>
                            <td className="td">
                                {unit === 'cm' ? r.heelToeCm : toIn(r.heelToeCm)}
                            </td>
                            <td className="td">{r.eu}</td>
                            <td className="td">{r.uk}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* estilos de celda reutilizables */}
            <style jsx>{`
        .th { @apply px-4 py-2 border font-semibold whitespace-nowrap; }
        .td { @apply px-4 py-2 border whitespace-nowrap; }
      `}</style>
        </div>
    );
}
