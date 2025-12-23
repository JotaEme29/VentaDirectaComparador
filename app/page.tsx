'use client';

import { useState } from 'react';
import { Sparkles, Upload, Check, Zap, Phone, Mail } from 'lucide-react';
import { FormData, ResultadoTarifa, Region, TariffType } from '@core/tipos';
import { calcularComparativa } from '@core/calculoTarifas';

const REGIONES: Region[] = ['PENINSULA', 'BALEARES', 'CANARIAS', 'CEUTA_MELILLA'];
const TARIFAS_LUZ: TariffType[] = ['2.0TD', '3.0TD', '6.1TD'];

const formInicial: FormData = {
    energyType: 'electricidad',
    tariffType: '2.0TD',
    region: 'PENINSULA',
    gasTariffBand: 'RL2',
    clientName: '',
    address: '',
    cups: '',
    billingDays: 30,
    currentBill: 0,
    cae: 0,
    equipmentRental: 0,
    otherCosts: 0,
    discountEnergy: 0,
    discountPower: 0,
    reactiveEnergy: 0,
    excessPower: 0,
    socialBonus: 0,
    gasMonthlyConsumption: 0,
    gasFixedDaily: 0,
    gasVariableKwh: 0,
    consumptionP1: 0,
    consumptionP2: 0,
    consumptionP3: 0,
    consumptionP4: 0,
    consumptionP5: 0,
    consumptionP6: 0,
    potenciaP1: 0,
    potenciaP2: 0,
    potenciaP3: 0,
    potenciaP4: 0,
    potenciaP5: 0,
    potenciaP6: 0
};

function formatPeriodos(map?: Record<string, number>): string {
    if (!map) return '-';
    const entries = Object.entries(map).filter(([, v]) => (v ?? 0) > 0);
    if (!entries.length) return '-';
    return entries
        .map(([p, v]) => `${p} ${v.toFixed(3)} €`)
        .join(' · ');
}

export default function Page() {
    const [form, setForm] = useState<FormData>(formInicial);
    const [resultados, setResultados] = useState<ResultadoTarifa[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [iaStatus, setIaStatus] = useState<string>('');

    const [selectedIdx, setSelectedIdx] = useState<number>(0);

    function update<K extends keyof FormData>(key: K, value: FormData[K]) {
        setForm(prev => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // no calcular si no hay consumo
        const consumoTotal =
            form.consumptionP1 +
            form.consumptionP2 +
            form.consumptionP3 +
            form.consumptionP4 +
            form.consumptionP5 +
            form.consumptionP6;
        if (consumoTotal <= 0) {
            alert('Introduce al menos algún kWh de consumo en los periodos.');
            return;
        }

        setLoading(true);
        try {
            // si no hay CAE, lo aproximamos a partir del consumo actual
            const consumoMensual = consumoTotal;
            const caeAprox =
                form.billingDays && form.billingDays > 0
                    ? (consumoMensual * 365) / form.billingDays
                    : consumoMensual * 12;
            const formConCae = { ...form, cae: form.cae > 0 ? form.cae : Math.round(caeAprox) };
            setForm(formConCae);
            const res = calcularComparativa(formConCae, null, { limit: 20 });
            // Sort by Score (Equilibrium) as requested for Client Area
            res.sort((a, b) => (b.score || 0) - (a.score || 0));

            setResultados(res);
            setSelectedIdx(0);
        } finally {
            setLoading(false);
        }
    }

    async function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setIaStatus('Leyendo factura con IA…');

        // TODO: sustituir por llamada real a tu endpoint de IA
        setTimeout(() => {
            // ejemplo: solo rellenamos algunos campos base
            setForm(prev => ({
                ...prev,
                billingDays: prev.billingDays || 30,
                currentBill: prev.currentBill || 80,
                // estos valores deben venir de la IA en tu integración real:
                consumptionP1: prev.consumptionP1 || 100,
                consumptionP2: prev.consumptionP2 || 80,
                consumptionP3: prev.consumptionP3 || 60,
                potenciaP1: prev.potenciaP1 || 3.45,
                potenciaP2: prev.potenciaP2 || 3.45
            }));
            setIaStatus(
                'Factura leída. Hemos rellenado algunos campos, revisa los datos antes de comparar.'
            );
        }, 800);
    }

    const isTwoTd = form.tariffType === '2.0TD';
    const periodosConsumo = isTwoTd ? ['P1', 'P2', 'P3'] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const periodosPotencia = isTwoTd ? ['P1', 'P2'] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

    // Helper para obtener el resultado seleccionado con seguridad
    const selectedResult = resultados ? resultados[selectedIdx] || resultados[0] : null;

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 64 }}>
            <style jsx global>{`
                * { box-sizing: border-box; }
                body { overflow-x: hidden; }
                @media (min-width: 1024px) {
                    .sticky-form {
                        position: sticky;
                        top: 88px;
                        max-height: calc(100vh - 120px);
                        overflow-y: auto;
                        scrollbar-width: thin;
                    }
                }
            `}</style>
            <header
                style={{
                    background: 'white',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '16px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    position: 'sticky',
                    top: 0,
                    zIndex: 50
                }}
            >
                <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>
                    Soluciones Vivivan <span style={{ color: '#cbd5e1', margin: '0 8px' }}>/</span>{' '}
                    <span style={{ color: '#3b82f6' }}>Comparador</span>
                </div>
            </header>

            <main
                style={{
                    // FIX: quitamos width: 100% que sumaba padding y causaba scroll
                    // Al ser block, ocupa el 100% disponible por defecto
                    maxWidth: 1600,
                    margin: '0 auto',
                    width: '100%',
                    padding: '24px 32px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 32
                }}
            >
                {/* HERO */}
                <section
                    style={{
                        textAlign: 'center',
                        padding: '20px 0'
                    }}
                >
                    <h1
                        style={{
                            fontSize: 36,
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            color: '#1e293b',
                            marginBottom: 12
                        }}
                    >
                        Analiza tu factura de luz en segundos
                    </h1>
                    <p style={{ color: '#64748b', maxWidth: 640, margin: '0 auto', fontSize: 16 }}>
                        Sube tu factura o rellena los datos por periodos y te mostraremos las mejores tarifas
                        según tu consumo real, <strong style={{ color: '#0f172a' }}>ordenadas por recomendación</strong>.
                    </p>
                </section>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                        gap: 32,
                        alignItems: 'start'
                    }}
                >
                    {/* FORMULARIO */}
                    <div
                        className="sticky-form"
                        style={{
                            background: 'white',
                            borderRadius: 24,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                            padding: 32,
                            border: '1px solid #f1f5f9'
                        }}
                    >
                        {/* Bloque IA */}
                        <div
                            style={{
                                borderRadius: 16,
                                background: 'linear-gradient(to right, #eff6ff, #f8fafc)',
                                padding: 20,
                                marginBottom: 24,
                                border: '1px solid #bfdbfe'
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginBottom: 8
                                }}
                            >
                                <Sparkles size={20} className="text-blue-600" style={{ color: '#2563eb' }} />
                                <div style={{ fontWeight: 700, color: '#1e40af' }}>Autocompletar con IA</div>
                            </div>
                            <p style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 1.5 }}>
                                Sube un PDF de tu factura reciente. Nuestra IA leerá los periodos de consumo y
                                potencia por ti.
                            </p>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                <label
                                    style={{
                                        padding: '10px 18px',
                                        background: '#2563eb',
                                        color: 'white',
                                        borderRadius: 12,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: '1px solid #1d4ed8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <span>Subir factura (PDF/Img)</span>
                                    <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleInvoiceUpload}
                                    />
                                </label>
                                <div style={{ fontSize: 13, color: '#64748b' }}>
                                    {fileName ? (
                                        <span style={{ color: '#059669', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Check size={16} /> {fileName}
                                        </span>
                                    ) : (
                                        'Máx. 5MB'
                                    )}
                                </div>
                            </div>
                            {iaStatus && (
                                <div
                                    style={{
                                        marginTop: 12,
                                        fontSize: 13,
                                        color: '#0f172a',
                                        background: 'rgba(255,255,255,0.6)',
                                        padding: '8px 12px',
                                        borderRadius: 8
                                    }}
                                >
                                    {iaStatus}
                                </div>
                            )}
                        </div>

                        {/* Formulario manual */}
                        <form
                            onSubmit={handleSubmit}
                            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                        >
                            {/* Zona + Tarifa */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))',
                                    gap: 16
                                }}
                            >
                                <div>
                                    <label
                                        style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' }}
                                    >
                                        Zona Geográfica
                                    </label>
                                    <select
                                        value={form.region}
                                        onChange={e => update('region', e.target.value as Region)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: 12,
                                            border: '1px solid #e2e8f0',
                                            fontSize: 14,
                                            background: '#f8fafc',
                                            color: '#0f172a'
                                        }}
                                    >
                                        {REGIONES.map(r => (
                                            <option key={r} value={r}>
                                                {r === 'PENINSULA' && 'Península'}
                                                {r === 'BALEARES' && 'Baleares'}
                                                {r === 'CANARIAS' && 'Canarias'}
                                                {r === 'CEUTA_MELILLA' && 'Ceuta y Melilla'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label
                                        style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6, display: 'block' }}
                                    >
                                        Tipo de tarifa
                                    </label>
                                    <select
                                        value={form.tariffType}
                                        onChange={e => update('tariffType', e.target.value as TariffType)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: 12,
                                            border: '1px solid #e2e8f0',
                                            fontSize: 14,
                                            background: '#f8fafc',
                                            color: '#0f172a'
                                        }}
                                    >
                                        {TARIFAS_LUZ.map(t => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Potencias */}
                            <div>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                                    Potencias Contratadas (kW)
                                </h3>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`,
                                        gap: 12
                                    }}
                                >
                                    {periodosPotencia.map(p => {
                                        const key = ('potencia' + p) as keyof FormData;
                                        return (
                                            <div key={p}>
                                                <label
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        color: '#64748b',
                                                        marginBottom: 4,
                                                        display: 'block',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {p}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    value={Number(form[key]) === 0 ? '' : Number(form[key])}
                                                    onChange={e =>
                                                        update(key, (e.target.value === '' ? 0 : Number(e.target.value)) as any)
                                                    }
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px',
                                                        borderRadius: 10,
                                                        border: '1px solid #cbd5e1',
                                                        textAlign: 'center',
                                                        fontSize: 14,
                                                        fontWeight: 500
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Consumos */}
                            <div>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                                    Consumo Facturado (kWh)
                                </h3>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(auto-fill, minmax(80px, 1fr))`,
                                        gap: 12
                                    }}
                                >
                                    {periodosConsumo.map(p => {
                                        const key = ('consumption' + p) as keyof FormData;
                                        return (
                                            <div key={p}>
                                                <label
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        color: '#64748b',
                                                        marginBottom: 4,
                                                        display: 'block',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {p}
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    value={Number(form[key]) === 0 ? '' : Number(form[key])}
                                                    onChange={e =>
                                                        update(key, (e.target.value === '' ? 0 : Number(e.target.value)) as any)
                                                    }
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px',
                                                        borderRadius: 10,
                                                        border: '1px solid #cbd5e1',
                                                        textAlign: 'center',
                                                        fontSize: 14,
                                                        fontWeight: 500
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Facturación */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                    gap: 16,
                                    background: '#f8fafc',
                                    padding: 16,
                                    borderRadius: 16
                                }}
                            >
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>
                                        Importe Factura (€)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.currentBill === 0 ? '' : form.currentBill}
                                        onChange={e => {
                                            const v = e.target.value;
                                            update('currentBill', v === '' ? 0 : Number(v));
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: '1px solid #d1d5db',
                                            fontSize: 14
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>
                                        Días Facturados
                                    </label>
                                    <input
                                        type="number"
                                        value={form.billingDays}
                                        onChange={e => update('billingDays', Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: '1px solid #d1d5db',
                                            fontSize: 14
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4, display: 'block' }}>
                                        Alquiler Equipos (€)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.equipmentRental === 0 ? '' : form.equipmentRental}
                                        onChange={e => {
                                            const v = e.target.value;
                                            update('equipmentRental', v === '' ? 0 : Number(v));
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: '1px solid #d1d5db',
                                            fontSize: 14
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '16px',
                                        borderRadius: 16,
                                        background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: 700,
                                        fontSize: 16,
                                        cursor: loading ? 'wait' : 'pointer',
                                        boxShadow: '0 10px 25px -5px rgba(37,99,235,0.4)',
                                        transition: 'transform 0.1s',
                                        opacity: loading ? 0.7 : 1
                                    }}
                                >
                                    {loading ? 'Calculando mejores tarifas…' : 'COMPARAR OFERTAS'}
                                </button>
                                <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                                    Calculamos impuestos, peajes y costes ocultos para darte el precio final real.
                                </p>
                            </div>
                        </form>
                    </div>

                    {/* RESULTADOS O INTRO */}
                    <div style={{ minWidth: 0 }}>
                        {!resultados || !selectedResult ? (
                            <div
                                style={{
                                    height: '100%',
                                    minHeight: 400,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    background: 'white',
                                    borderRadius: 24,
                                    padding: 40,
                                    border: '2px dashed #e2e8f0'
                                }}
                            >
                                <div style={{ marginBottom: 16, color: '#cbd5e1' }}>
                                    <Zap size={48} strokeWidth={1.5} />
                                </div>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                                    Esperando datos
                                </h3>
                                <p style={{ color: '#64748b', maxWidth: 300 }}>
                                    Rellena el formulario de la izquierda o sube tu factura para ver la comparativa aquí.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {/* Resumen destacado */}
                                <div
                                    style={{
                                        position: 'sticky',
                                        top: 88, // dejar espacio para el header
                                        zIndex: 30,
                                        background: '#0f172a',
                                        color: 'white',
                                        borderRadius: 24,
                                        padding: '24px 32px',
                                        marginBottom: 32,
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 24,
                                        boxShadow: '0 20px 40px -10px rgba(15,23,42,0.3)',
                                        border: '1px solid #1e293b',
                                        minHeight: 140, // Avoid jumping when content changes
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                                        <div>
                                            <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.05em', opacity: 0.7, marginBottom: 4, fontWeight: 600 }}>
                                                Ahorro anual estimado
                                            </div>
                                            <div style={{ fontSize: 36, fontWeight: 800, color: '#4ade80' }}>
                                                {selectedResult.annualSavings.toFixed(2)} €
                                            </div>
                                        </div>

                                        <div style={{ height: 40, width: 1, background: 'rgba(255,255,255,0.1)' }}></div>

                                        <div>
                                            <div style={{ textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.05em', opacity: 0.7, marginBottom: 4, fontWeight: 600 }}>
                                                Tu ahorro / factura
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: '#86efac' }}>
                                                {selectedResult.savings.toFixed(2)} €
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>
                                            Pagarías <strong>{selectedResult.total.toFixed(2)} €</strong> en vez de {form.currentBill.toFixed(2)} €
                                        </div>
                                        <div style={{ fontSize: 13, color: '#94a3b8' }}>
                                            {selectedResult.productName}
                                        </div>
                                    </div>
                                </div>

                                <section>
                                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Mejores ofertas
                                        <span style={{ fontSize: 12, background: '#e2e8f0', padding: '2px 8px', borderRadius: 99, color: '#475569', fontWeight: 600 }}>
                                            {resultados.length}
                                        </span>
                                    </h2>

                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                            gap: 20
                                        }}
                                    >
                                        {resultados.map((r, idx) => {
                                            const isSelected = idx === selectedIdx;
                                            const isBest = idx === 0;

                                            // Lógica de borde: Azul fuerte si está seleccionado, azul suave si es mejor opción pero no seleccionada, gris si nada.
                                            let borderColor = '#e2e8f0';
                                            if (isSelected) borderColor = '#2563eb';
                                            else if (isBest) borderColor = '#93c5fd';

                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedIdx(idx)}
                                                    style={{
                                                        background: isSelected ? '#eff6ff' : 'white',
                                                        borderRadius: 24, // más redondeado
                                                        border: `2px solid ${borderColor}`,
                                                        padding: 28, // más grande
                                                        position: 'relative',
                                                        transition: 'all 0.2s ease-in-out',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',
                                                        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                                                        boxShadow: isSelected ? '0 10px 40px -5px rgba(37, 99, 235, 0.3)' : '0 4px 6px -1px rgba(0,0,0,0.05)'
                                                    }}
                                                >
                                                    {isBest && (
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                top: -12,
                                                                left: 20,
                                                                background: '#2563eb',
                                                                color: 'white',
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                padding: '4px 12px',
                                                                borderRadius: 99,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em'
                                                            }}
                                                        >
                                                            Mejor opción
                                                        </div>
                                                    )}

                                                    <div style={{ marginBottom: 16 }}>
                                                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
                                                            {r.supplier}
                                                        </div>
                                                        <div style={{ fontSize: 13, color: '#64748b' }}>{r.productName}</div>
                                                    </div>

                                                    <div
                                                        style={{
                                                            padding: '16px 0',
                                                            borderTop: '1px solid ' + (isSelected ? '#bfdbfe' : '#f1f5f9'),
                                                            borderBottom: '1px solid ' + (isSelected ? '#bfdbfe' : '#f1f5f9'),
                                                            marginBottom: 16,
                                                            display: 'flex',
                                                            alignItems: 'baseline',
                                                            justifyContent: 'space-between'
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Estimado</div>
                                                            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{r.total.toFixed(2)} €</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Ahorro Factura</div>
                                                            <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{Math.abs(r.savings).toFixed(2)} €</div>
                                                            <div style={{ fontSize: 11, color: '#15803d', marginTop: 2, fontWeight: 600 }}>
                                                                {r.annualSavings.toFixed(0)} € / año
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Impuesto Eléctrico:</span>
                                                            <span style={{ fontWeight: 600 }}>{r.electricityTax.toFixed(2)} €</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Alquiler Equipos:</span>
                                                            <span style={{ fontWeight: 600 }}>{r.equipmentRental.toFixed(2)} €</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>IVA:</span>
                                                            <span style={{ fontWeight: 600 }}>{r.vat.toFixed(2)} €</span>
                                                        </div>
                                                        <div style={{ height: 1, background: isSelected ? '#bfdbfe' : '#f1f5f9', margin: '4px 0' }}></div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                            <span>Energía:</span>
                                                            <span style={{ fontWeight: 600 }}>{formatPeriodos(r.preciosEnergia)}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                            <span>Potencia:</span>
                                                            <span style={{ fontWeight: 600 }}>{formatPeriodos(r.preciosPotencia)}</span>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); console.log('Contratar', r.supplier); }}
                                                            style={{
                                                                background: '#2563eb',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: 12,
                                                                padding: '12px',
                                                                fontWeight: 700,
                                                                fontSize: 14,
                                                                cursor: 'pointer',
                                                                gridColumn: 'span 2'
                                                            }}
                                                        >
                                                            Contratar Online
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); }}
                                                            style={{
                                                                background: 'transparent',
                                                                color: '#334155',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: 12,
                                                                padding: '10px',
                                                                fontWeight: 600,
                                                                fontSize: 13,
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 8
                                                            }}
                                                        >
                                                            <Phone size={14} /> Te llamamos
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); }}
                                                            style={{
                                                                background: 'transparent',
                                                                color: '#334155',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: 12,
                                                                padding: '10px',
                                                                fontWeight: 600,
                                                                fontSize: 13,
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 8
                                                            }}
                                                        >
                                                            <Mail size={14} />  Por correo
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </main >
        </div >
    );
}
