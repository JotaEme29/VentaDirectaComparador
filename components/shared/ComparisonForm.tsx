// components/shared/ComparisonForm.tsx
import React, { useState } from 'react';
import { Zap, Flame, MapPin, User, FileText, Sparkles } from 'lucide-react';
import { FormData, Region, TariffType } from '@core/tipos';
import { Button, Input } from '../ui';
import { Select } from './../ui/Select';
import { Card } from '../ui';

interface ComparisonFormProps {
    initialData: FormData;
    onSubmit: (data: FormData) => void;
    loading?: boolean;
}

const REGIONES = [
    { value: 'PENINSULA', label: 'Península' },
    { value: 'BALEARES', label: 'Baleares' },
    { value: 'CANARIAS', label: 'Canarias' },
    { value: 'CEUTA_MELILLA', label: 'Ceuta y Melilla' }
];

const TARIFAS_LUZ = [
    { value: '2.0TD', label: '2.0TD (Hogares/Negocios < 15kW)' },
    { value: '3.0TD', label: '3.0TD (Negocios > 15kW)' },
    { value: '6.1TD', label: '6.1TD (Alta Tensión)' }
];

const BANDAS_GAS = [
    { value: 'RL1', label: 'RL1 (≤ 5.000 kWh/año)' },
    { value: 'RL2', label: 'RL2 (5.001 - 15.000 kWh/año)' },
    { value: 'RL3', label: 'RL3 (15.001 - 50.000 kWh/año)' }
];

export const ComparisonForm = ({ initialData, onSubmit, loading }: ComparisonFormProps) => {
    const [form, setForm] = useState<FormData>(initialData);
    const [iaStatus, setIaStatus] = useState<string>('');
    const [iaLoading, setIaLoading] = useState<boolean>(false);
    const update = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm(prev => ({ ...prev, [key]: value }));

    const isGas = form.energyType === 'gas';
    const isTwoTd = form.tariffType === '2.0TD';
    const periodsC = isTwoTd ? ['P1', 'P2', 'P3'] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const periodsP = isTwoTd ? ['P1', 'P2'] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const displayNumber = (val?: number) => (val === 0 || val === undefined || val === null || Number.isNaN(val) ? '' : val);

    const handleFileChange = (file: File | null) => {
        if (!file) {
            setForm(prev => ({ ...prev, invoiceFile: null }));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1] || '';
            setForm(prev => ({
                ...prev,
                invoiceFile: {
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    base64
                }
            }));
            setIaStatus(`Factura cargada: ${file.name}`);
        };
        reader.readAsDataURL(file);
    };

    const applyExtraction = (data: any) => {
        if (!data) return;
        setForm(prev => ({
            ...prev,
            energyType: data.energyType || prev.energyType,
            tariffType: (data.tariffType || prev.tariffType) as TariffType,
            region: (data.region || prev.region) as Region,
            gasTariffBand: (data.gasTariffBand || prev.gasTariffBand) as any,
            clientName: data.clientName || prev.clientName,
            address: data.address || prev.address,
            cups: data.cups || prev.cups,
            billingDays: data.billingDays || prev.billingDays,
            currentBill: data.currentBill || prev.currentBill,
            cae: data.cae || prev.cae,
            equipmentRental: data.equipmentRental || prev.equipmentRental,
            otherCosts: data.otherCosts || prev.otherCosts,
            discountEnergy: data.discountEnergy || prev.discountEnergy,
            discountPower: data.discountPower || prev.discountPower,
            reactiveEnergy: data.reactiveEnergy || prev.reactiveEnergy,
            excessPower: data.excessPower || prev.excessPower,
            socialBonus: data.socialBonus || prev.socialBonus,
            gasMonthlyConsumption: data.gasMonthlyConsumption || prev.gasMonthlyConsumption,
            gasFixedDaily: data.gasFixedDaily || prev.gasFixedDaily,
            gasVariableKwh: data.gasVariableKwh || prev.gasVariableKwh,
            consumptionP1: data.consumption?.P1 ?? prev.consumptionP1,
            consumptionP2: data.consumption?.P2 ?? prev.consumptionP2,
            consumptionP3: data.consumption?.P3 ?? prev.consumptionP3,
            consumptionP4: data.consumption?.P4 ?? prev.consumptionP4,
            consumptionP5: data.consumption?.P5 ?? prev.consumptionP5,
            consumptionP6: data.consumption?.P6 ?? prev.consumptionP6,
            potenciaP1: data.power?.P1 ?? prev.potenciaP1,
            potenciaP2: data.power?.P2 ?? prev.potenciaP2,
            potenciaP3: data.power?.P3 ?? prev.potenciaP3,
            potenciaP4: data.power?.P4 ?? prev.potenciaP4,
            potenciaP5: data.power?.P5 ?? prev.potenciaP5,
            potenciaP6: data.power?.P6 ?? prev.potenciaP6
        }));
    };

    const triggerExtraction = async () => {
        if (!form.invoiceFile) {
            setIaStatus('Sube una factura en PDF o imagen para leerla.');
            return;
        }
        try {
            setIaLoading(true);
            setIaStatus('Leyendo factura con IA...');
            const resp = await fetch('/api/extraer-factura', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: form.invoiceFile.fileName,
                    mimeType: form.invoiceFile.mimeType,
                    base64: form.invoiceFile.base64
                })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data?.extracted) throw new Error(data?.error || 'No se pudo leer la factura');
            applyExtraction(data.extracted);
            setIaStatus('Factura leída y datos rellenados. Revisa antes de calcular.');
        } catch (err: any) {
            setIaStatus(err?.message || 'Error leyendo la factura');
        } finally {
            setIaLoading(false);
        }
    };

    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="relative">
            <Card className="relative p-6 space-y-6 bg-white shadow-lg shadow-blue-500/10 border border-slate-100 overflow-hidden rounded-3xl" hover={false}>
                <div className="relative flex flex-wrap gap-2 items-center text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Paso 1 · Datos</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">Paso 2 · Resultado</span>
                </div>

                <div className="relative rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Sparkles size={18} />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-sm font-black text-slate-900">Comparativa gratis y sin compromiso</p>
                        <p className="text-xs text-slate-600">Completa tus datos básicos y calcula en segundos.</p>
                    </div>
                </div>

                <div className="relative flex p-1 bg-slate-100 rounded-2xl shadow-inner">
                    <button
                        type="button"
                        onClick={() => update('energyType', 'electricidad')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold ${!isGas ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Zap size={18} /> Luz
                    </button>
                    <button
                        type="button"
                        onClick={() => update('energyType', 'gas')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold ${isGas ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Flame size={18} /> Gas
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="relative rounded-2xl border border-blue-100 bg-white p-4 shadow-sm flex items-center gap-3 justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Sparkles size={18} />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-sm font-black text-slate-900">Lectura automática de factura</p>
                                <p className="text-xs text-slate-600">Sube PDF o foto y rellenamos los datos por ti (sin complicaciones).</p>
                                {iaStatus && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1 shadow-sm inline-block">{iaStatus}</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="cursor-pointer px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-black border border-blue-100">
                                Subir factura
                                <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                                />
                            </label>
                            <Button type="button" variant="outline" disabled={iaLoading} onClick={triggerExtraction} className="text-sm">
                                {iaLoading ? 'Cargando...' : 'Autocompletar'}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                            <MapPin size={16} className="text-blue-600" />
                            Zona y tarifa
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Región"
                                value={form.region}
                                onChange={(e) => update('region', e.target.value as Region)}
                                options={REGIONES}
                            />
                            {isGas ? (
                                <Select
                                    label="Tarifa Gas"
                                    value={form.gasTariffBand}
                                    onChange={(e) => update('gasTariffBand', e.target.value as any)}
                                    options={BANDAS_GAS}
                                />
                            ) : (
                                <Select
                                    label="Tarifa Eléctrica"
                                    value={form.tariffType}
                                    onChange={(e) => update('tariffType', e.target.value as TariffType)}
                                    options={TARIFAS_LUZ}
                                />
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                            <User size={16} className="text-blue-600" />
                            Datos del titular
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nombre del titular"
                                value={form.clientName}
                                onChange={(e) => update('clientName', e.target.value)}
                                placeholder="Nombre y apellidos o razón social"
                            />
                            <Input
                                label="CUPS"
                                value={form.cups}
                                onChange={(e) => update('cups', e.target.value)}
                                placeholder="ES0027..."
                            />
                        </div>
                        <Input
                            label="Dirección del suministro"
                            value={form.address}
                            onChange={(e) => update('address', e.target.value)}
                            placeholder="Calle, número, localidad"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                            <FileText size={16} className="text-blue-600" />
                            Consumo y potencias
                        </div>
                        {!isGas ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Zap size={16} className="text-blue-500" /> Potencias (kW)
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                        {periodsP.map(p => (
                                            <Input
                                                key={p}
                                                placeholder={p}
                                                type="number"
                                                step="0.01"
                                                value={(form as any)[`potencia${p}`] || ''}
                                                onChange={(e) => update(`potencia${p}` as any, Number(e.target.value))}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Zap size={16} className="text-blue-500" /> Consumos (kWh)
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                        {periodsC.map(p => (
                                            <Input
                                                key={p}
                                                placeholder={p}
                                                type="number"
                                                step="0.01"
                                                value={(form as any)[`consumption${p}`] || ''}
                                                onChange={(e) => update(`consumption${p}` as any, Number(e.target.value))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Input
                                    label="Consumo gas mensual (kWh)"
                                    type="number"
                                    step="0.01"
                                    value={form.gasMonthlyConsumption}
                                    onChange={(e) => update('gasMonthlyConsumption', Number(e.target.value))}
                                />
                                <Input
                                    label="Término fijo diario (€)"
                                    type="number"
                                    step="0.001"
                                    value={form.gasFixedDaily}
                                    onChange={(e) => update('gasFixedDaily', Number(e.target.value))}
                                />
                                <Input
                                    label="Término variable kWh (€)"
                                    type="number"
                                    step="0.0001"
                                    value={form.gasVariableKwh}
                                    onChange={(e) => update('gasVariableKwh', Number(e.target.value))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                        <FileText size={16} className="text-blue-600" />
                        Costes y facturación
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <Input
                            label="Factura actual (€ con impuestos)"
                            type="number"
                            step="0.01"
                            placeholder="Ej: 120"
                            value={displayNumber(form.currentBill)}
                            onChange={(e) => update('currentBill', Number(e.target.value || 0))}
                        />
                        <Input
                            label="Días facturados"
                            type="number"
                            placeholder="Ej: 30"
                            value={displayNumber(form.billingDays)}
                            onChange={(e) => update('billingDays', Number(e.target.value || 0))}
                        />
                        <Input
                            label="Alquiler de equipos (€)"
                            type="number"
                            step="0.01"
                            placeholder="Ej: 0.80"
                            value={displayNumber(form.equipmentRental)}
                            onChange={(e) => update('equipmentRental', Number(e.target.value || 0))}
                        />
                        <Input
                            label="Bono social (€)"
                            type="number"
                            step="0.01"
                            placeholder="Ej: 0"
                            value={displayNumber(form.socialBonus)}
                            onChange={(e) => update('socialBonus', Number(e.target.value || 0))}
                        />
                        <Input
                            label="Otros costes (€)"
                            type="number"
                            step="0.01"
                            placeholder="Ej: 0"
                            value={displayNumber(form.otherCosts)}
                            onChange={(e) => update('otherCosts', Number(e.target.value || 0))}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={loading} className="px-8 py-3 text-sm font-black uppercase tracking-[0.2em]">
                        {loading ? 'Calculando...' : 'Calcular comparativa'}
                    </Button>
                </div>
            </Card>
        </form>
    );
};
