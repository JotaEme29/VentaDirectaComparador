import React from 'react';
import { ResultadoTarifa, FormData } from '../../core/tipos';
import { Zap, TrendingDown, Star, Mail, PhoneCall } from 'lucide-react';
import { Badge, Button, Card } from '../ui';

interface ResultCardProps {
    result: ResultadoTarifa;
    formData: FormData;
    isBest?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    onRequestLead?: (res: ResultadoTarifa, mode?: 'direct' | 'callback') => void;
}

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

const formatMoney = (value: number, decimals = 2) =>
    (value ?? 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const ResultCard = ({ result, formData, isBest, isSelected, onSelect, onRequestLead }: ResultCardProps) => {
    const logo = getSupplierLogo(result.supplier);

    return (
        <Card
            className={`futuristic-card relative overflow-visible flex flex-col h-full border-slate-200 transition-all duration-500 group bg-gradient-to-b from-white via-[#f5f9ff] to-white ${isBest ? 'border-blue-500 ring-4 ring-blue-500/5' : ''} ${isSelected ? 'card-selected' : ''}`}
            hover={false}
            onClick={onSelect}
        >
            {isBest && (
                <div className="absolute top-3 right-3 pointer-events-none z-10">
                    <div className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 shadow-lg rounded-full flex items-center gap-1.5">
                        <Star size={12} className="fill-white text-white" />
                        Recomendada
                    </div>
                </div>
            )}

            <div className="p-8 space-y-8 flex-1 relative z-10">
                {/* Supplier & Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-slate-100 group-hover:border-blue-500/30 transition-colors overflow-hidden p-2 shadow-sm">
                            {logo ? (
                                <img src={logo} alt={result.supplier} className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-xl font-black text-blue-600 border-2 border-blue-100 rounded-lg px-2">{result.supplier.substring(0, 1)}</span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none">{result.supplier}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{result.productName}</p>
                        </div>
                    </div>
                </div>

                {/* Main Savings */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Ahorro anual estimado</span>
                        <span className="text-5xl font-black tracking-tighter tabular-nums text-emerald-500 drop-shadow-sm">{formatMoney(result.annualSavings, 0)}€</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">/ año</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="pill pill-emerald">
                            <TrendingDown size={12} />
                            Ahorro factura: {formatMoney(result.savings, 2)}€
                        </span>
                        <span className="pill pill-blue">
                            {Math.max(0, result.savingsPercent || 0).toFixed(1)}% ahorro
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white border border-slate-100 rounded-2xl p-3 space-y-1 shadow-sm">
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total propuesta</p>
                        <p className="text-lg font-black text-slate-900">{formatMoney(result.total)}€</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500/10 via-indigo-400/10 to-emerald-400/10 border border-blue-100 rounded-2xl p-3 space-y-1 shadow-sm">
                        <p className="text-[10px] uppercase font-black tracking-widest text-blue-700">Ahorro por factura</p>
                        <p className="text-lg font-black text-blue-900">{formatMoney(result.savings)}€</p>
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                    <Button
                        fullWidth
                        className="h-11 rounded-xl group flex items-center justify-center gap-2 transition-all shadow-sm bg-blue-600 text-white hover:bg-blue-700 text-[11px] whitespace-nowrap"
                        onClick={(e) => { e.stopPropagation(); onRequestLead?.(result, 'direct'); }}
                    >
                        <Mail size={16} />
                        <span className="uppercase tracking-widest font-black">Contratación directa</span>
                    </Button>
                    <Button
                        fullWidth
                        variant="outline"
                        className="h-11 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest border-slate-200 hover:border-blue-300 hover:text-blue-700"
                        onClick={(e) => { e.stopPropagation(); onRequestLead?.(result, 'callback'); }}
                    >
                        <PhoneCall size={16} />
        <span className="uppercase tracking-widest font-black">Que me contacten</span>
                    </Button>
                </div>
            </div>
        </Card>
    );
};
