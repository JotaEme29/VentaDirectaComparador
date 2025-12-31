'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, HandCoins, Laptop, Users, Building2, ChevronRight, Mail, Search, MousePointer2, CheckCircle2 } from 'lucide-react';
import { FormData, ResultadoTarifa } from '../core/tipos';
import { ComparisonForm } from '../components/shared/ComparisonForm';
import { ResultCard } from '../components/client/ResultCard';
import { Button, Badge, Card } from '../components/ui';
import { PdfExportButton } from '../components/shared/PdfExportButton';

const initialForm: FormData = {
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
    equipmentRental: 0.80,
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
    potenciaP6: 0,
    invoiceFile: null
};

export default function ClientPage() {
    const [resultados, setResultados] = useState<ResultadoTarifa[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'hub' | 'form' | 'results'>('hub');
    const [formDataForPdf, setFormDataForPdf] = useState<FormData>(initialForm);
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    const [leadModalOpen, setLeadModalOpen] = useState(false);
    const [leadEmail, setLeadEmail] = useState('');
    const [leadPhone, setLeadPhone] = useState('');
    const [leadSending, setLeadSending] = useState(false);
    const [leadError, setLeadError] = useState('');
    const [leadSuccess, setLeadSuccess] = useState(false);
    const formatMoney = (val: number, decimals = 2) =>
        (val ?? 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    const getSupplierLogo = (supplier: string) => {
        const s = supplier.toLowerCase();
        if (s.includes('endesa')) return '/logos/endesa.png';
        if (s.includes('greening')) return '/logos/greening.png';
        if (s.includes('ignis')) return '/logos/ignis.png';
        if (s.includes('localuz')) return '/logos/localuz.png';
        if (s.includes('iberdrola')) return '/logos/iberdrola.png';
        if (s.includes('naturgy')) return '/logos/naturgy.png';
        if (s.includes('polaris')) return '/logos/polaris.png';
        if (s.includes('logos')) return '/logos.png';
        if (s.includes('total')) return '/total.png';
        if (s.includes('acciona')) return '/acciona.png';
        if (s.includes('repsol')) return '/logos/repsol.png';
        if (s.includes('eleia')) return '/logos/eleia.png';
        return null;
    };

    const handleCompare = async (data: FormData) => {
        setFormDataForPdf(data);
        setLoading(true);
        try {
            const resp = await fetch('/api/calcular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ form: data, limit: 20 })
            });
            const payload = await resp.json().catch(() => ({}));
            if (!resp.ok || !payload?.ok) throw new Error(payload?.error || 'No se pudo calcular la comparativa');

            const res: ResultadoTarifa[] = (payload.resultados || []).sort((a: ResultadoTarifa, b: ResultadoTarifa) => (b.savings || 0) - (a.savings || 0));
            setResultados(res);
            setSelectedResultIndex(0);
            setLeadSuccess(false);
            setView('results');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            console.error(err);
            setLeadError(err?.message || 'Error calculando la comparativa');
            setView('form');
        } finally {
            setLoading(false);
        }
    };

    const handleLeadRequest = (res: ResultadoTarifa) => {
        const idx = resultados?.findIndex(r => r === res) ?? 0;
        setSelectedResultIndex(idx >= 0 ? idx : 0);
        setLeadModalOpen(true);
        setLeadSuccess(false);
        setLeadError('');
    };

    useEffect(() => {
        if (leadSuccess) {
            const t = setTimeout(() => setLeadSuccess(false), 6000);
            return () => clearTimeout(t);
        }
    }, [leadSuccess]);

    const submitLead = async () => {
        if (!resultados) return;
        const oferta = resultados[selectedResultIndex];
        setLeadSending(true);
        setLeadError('');
        try {
            const payload = {
                email: leadEmail,
                phone: leadPhone,
                supplier: oferta.supplier,
                productName: oferta.productName,
                tariffType: oferta.tariffType,
                savings: oferta.annualSavings,
                clientName: formDataForPdf.clientName,
                address: formDataForPdf.address,
                cups: formDataForPdf.cups,
                region: formDataForPdf.region,
                energyType: formDataForPdf.energyType,
                invoiceFile: formDataForPdf.invoiceFile
            };
            const resp = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data?.ok) throw new Error(data?.error || 'No se pudo enviar la solicitud');
            setLeadSuccess(true);
            setLeadModalOpen(false);
            setLeadEmail('');
            setLeadPhone('');
        } catch (err: any) {
            setLeadError(err?.message || 'Error enviando la solicitud');
        } finally {
            setLeadSending(false);
        }
    };

    const selectedResult = resultados?.[selectedResultIndex];

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-blue-100 flex flex-col">
            {/* Soft Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none" />

            {/* Header */}
            <header className="relative z-50 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView('hub')}>
                    <img src="/logo.png" alt="Vivivan Logo" className="h-10 object-contain brightness-100 transition-transform hover:scale-105" />
                    <div className="hidden sm:block">
                        <span className="text-xl font-black tracking-tighter block leading-none text-slate-900 uppercase">Soluciones Vivivan</span>
                        <span className="text-[10px] font-bold tracking-[0.2em] text-blue-600 uppercase">Inteligencia Energética</span>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    <a href="/contacto" className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                        <Mail size={14} /> Contacto
                    </a>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-6 transition-all duration-500 py-12">

                {view === 'hub' && (
                    <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center animate-in fade-in zoom-in duration-700">
                        <div className="space-y-8 text-center lg:text-left">
                            <Badge variant="blue">Tecnología de Comparación Superior</Badge>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-[0.18em]">
                                Comparativa gratis · Sin costo para ti
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.1] text-slate-900 drop-shadow-sm">
                                Activa tu <span className="text-blue-600">ahorro</span> hoy
                            </h1>
                            <p className="text-xl text-slate-500 font-medium max-w-md mx-auto lg:mx-0 leading-relaxed">
                                Encuentra en minutos la tarifa que maximiza tu ahorro. Gestión completa y transparente, sin comisiones ocultas.
                            </p>
                            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <Button size="lg" className="btn-primary px-10 py-7 text-lg shadow-lg shadow-blue-500/20" onClick={() => setView('form')}>
                                    Comienza tu ahorro <ChevronRight className="ml-2" />
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="futuristic-card p-8 rounded-[2rem] shadow-xl shadow-blue-500/10 hover:border-blue-200 bg-white/90 backdrop-blur">
                                <div className="flex items-start gap-6">
                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                        <Search size={28} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-xl font-bold text-slate-900">Transparencia Total</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed">Sin comisiones para el cliente. Nuestro objetivo es tu ahorro directo.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="futuristic-card p-8 rounded-[2rem] shadow-xl shadow-blue-500/10 hover:border-blue-200 bg-white/90 backdrop-blur">
                                <div className="flex items-start gap-6">
                                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                                        <ShieldCheck size={28} />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-xl font-bold text-slate-900">Privacidad Garantizada</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed">Tus datos encriptados. Cumplimos con los más altos estándares de seguridad.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 flex flex-col gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Empresas Colaboradoras</span>
                                <div className="flex gap-6 items-center flex-wrap opacity-80">
                                    <img src="/logos/endesa.png" alt="Endesa" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                    <img src="/logos/naturgy.png" alt="Naturgy" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                    <img src="/logos/repsol.png" alt="Repsol" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                    <img src="/logos/acciona.png" alt="Acciona" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                    <img src="/logos/iberdrola.png" alt="Iberdrola" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                    <img src="/logos/greening.png" alt="Greening" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                    <img src="/logos/localuz.png" alt="Localuz" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                    <img src="/logos/eleia.png" alt="Eleia" className="h-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'form' && (
                    <div className="max-w-6xl w-full animate-in fade-in slide-in-from-bottom-8 duration-700 py-6">
                        <div className="flex items-center justify-between mb-8">
                            <button onClick={() => setView('hub')} className="text-slate-400 hover:text-slate-900 flex items-center gap-2 font-bold text-sm transition-colors uppercase tracking-widest">
                                <ArrowRight className="rotate-180" size={16} /> Volver al Inicio
                            </button>
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Estudio de <span className="text-blue-600">Eficiencia</span></h2>
                        </div>
                        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-500/5 border border-slate-100 p-2 overflow-hidden">
                            <ComparisonForm initialData={initialForm} onSubmit={handleCompare} loading={loading} />
                        </div>
                    </div>
                )}

                {view === 'results' && resultados && (
                    <div className="max-w-7xl w-full animate-in fade-in slide-in-from-bottom-8 duration-700 py-6">
                        <div className="sticky top-0 z-30 pb-4 bg-gradient-to-b from-[#f8fafc] via-[#f8fafc] to-[#f8fafc]/70 backdrop-blur-md">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                                <div className="space-y-4">
                                    <button onClick={() => setView('form')} className="text-blue-600 hover:text-blue-700 flex items-center gap-2 font-black text-sm transition-all uppercase tracking-widest">
                                        <ArrowRight className="rotate-180" size={16} /> Nueva Comparativa
                                    </button>
                                    <div className="flex items-center gap-6 flex-wrap">
                                        <h2 className="text-5xl font-black tracking-tighter leading-none text-slate-900">Tu Plan de <span className="text-blue-600">Ahorro</span></h2>
                                        <PdfExportButton
                                            result={resultados[selectedResultIndex] || resultados[0]}
                                            form={formDataForPdf}
                                            filename={`Soluciones_Vivivan_${formDataForPdf.clientName || 'Propuesta'}.pdf`}
                                            variant="outline"
                                        />
                                    </div>
                                </div>
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-12 py-8 rounded-3xl flex items-start gap-6 shadow-2xl shadow-blue-600/25 text-white min-w-[320px] md:max-w-[520px] w-full ring-4 ring-blue-500/10">
                                    <div className="p-4 bg-white/20 rounded-2xl">
                                        <HandCoins size={36} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-blue-100 uppercase tracking-[0.2em]">Ahorro Anual Aproximado</p>
                                        <p className="text-5xl font-black tabular-nums leading-none">
                                            {formatMoney(resultados[selectedResultIndex]?.annualSavings ?? resultados[0]?.annualSavings ?? 0, 0)}€
                                            <span className="text-lg font-medium opacity-80 ml-1">/ año</span>
                                        </p>
                                        <p className="text-xs text-blue-50">Incluye impuestos, alquileres y otros costes declarados.</p>
                                        <p className="text-[11px] text-blue-50/90">Descarga el PDF para ver el desglose completo.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {(() => {
                                const maxScore = Math.max(...resultados.map(r => r.score || 0), 1);
                                return resultados.map((r, idx) => (
                                    <ResultCard
                                        key={idx}
                                        result={r}
                                        formData={formDataForPdf}
                                        isBest={r.recommended || idx === 0}
                                        isSelected={idx === selectedResultIndex}
                                        onSelect={() => setSelectedResultIndex(idx)}
                                        onRequestLead={handleLeadRequest}
                                    />
                                ));
                            })()}
                        </div>

                        {leadModalOpen && resultados && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-5">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 overflow-hidden">
                                            {selectedResult && getSupplierLogo(selectedResult.supplier) ? (
                                                <img src={getSupplierLogo(selectedResult.supplier)!} alt={selectedResult.supplier} className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-lg font-black text-blue-600">{selectedResult?.supplier?.[0]}</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Contratación por email</p>
                                            <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedResult?.supplier} · {selectedResult?.productName}</h3>
                                            <p className="text-sm text-slate-500">Ahorro estimado: {selectedResult?.annualSavings ? selectedResult.annualSavings.toFixed(0) : '0'}€ / año.</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setLeadModalOpen(false)}>Cerrar</Button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Correo electrónico</label>
                                            <input
                                                type="email"
                                                value={leadEmail}
                                                onChange={(e) => setLeadEmail(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="cliente@email.com"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Teléfono</label>
                                            <input
                                                type="tel"
                                                value={leadPhone}
                                                onChange={(e) => setLeadPhone(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="+34 600 000 000"
                                            />
                                        </div>
                                    </div>

                                    {leadError && (
                                        <div className="text-sm text-red-600 font-bold bg-red-50 border border-red-100 rounded-xl px-4 py-2">{leadError}</div>
                                    )}

                                    <div className="flex gap-3">
                                        <Button
                                            fullWidth
                                            className="btn-primary h-12 uppercase tracking-widest font-black"
                                            onClick={submitLead}
                                            disabled={leadSending || !leadEmail || !leadPhone}
                                        >
                                            {leadSending ? 'Enviando...' : 'Enviar por correo'}
                                        </Button>
                                    </div>

                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                        Procesamos tu solicitud por email y te contactamos para cerrar la contratación de esta oferta seleccionada.
                                    </p>
                                </div>
                            </div>
                        )}

                        {leadSuccess && (
                            <div className="fixed bottom-6 right-6 z-50 bg-white border border-green-100 shadow-xl shadow-green-500/20 rounded-2xl px-6 py-4 flex items-center gap-3">
                                <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 leading-tight">Solicitud enviada</p>
                                    <p className="text-xs text-slate-500">Nuestro equipo te llamará en breve para continuar la contratación.</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setLeadSuccess(false)}>Cerrar</Button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <footer className="relative z-50 px-8 py-10 max-w-7xl mx-auto w-full border-t border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Vivivan" className="h-6 object-contain grayscale opacity-60" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">© 2025 Soluciones Vivivan S.L.</span>
                    </div>
                    <div className="flex gap-8 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                        <a href="/aviso-legal" className="hover:text-blue-600 transition-colors">Aviso Legal</a>
                        <a href="/privacidad" className="hover:text-blue-600 transition-colors">Privacidad</a>
                        <a href="/cookies" className="hover:text-blue-600 transition-colors">Cookies</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
