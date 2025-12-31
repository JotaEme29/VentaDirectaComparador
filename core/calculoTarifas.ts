// core/calculoTarifas.ts

import tarifasData from '../data/tarifas.v2.json';
import gasTarifasData from '../data/tarifas-gas.v2.json';
import ajustesData from '../data/ajustes.json';
import comisionesData from '../data/comisiones.json';
import { FormData, ResultadoTarifa, Region, TariffType } from './tipos';

// ---- Impuestos (igual que legacy) ----
const ELECTRICITY_TAX_STD = 0.051126963;
const VAT_PENINSULA = 0.21;
const VAT_CANARIAS_LOW = 0.0;
const VAT_CANARIAS_HIGH = 0.03;
const VAT_BALEARES = 0.21;
const VAT_IPSI_CEUTA_MELILLA = 0.01;

function roundToCents(value: number): number {
    return Math.round((value || 0) * 100) / 100;
}

function getTaxRates(region: Region, maxPotencia = 0) {
    const reg = region.toUpperCase() as Region;
    if (reg === 'CANARIAS') {
        const vat = maxPotencia <= 10 ? VAT_CANARIAS_LOW : VAT_CANARIAS_HIGH;
        return { electricityTax: ELECTRICITY_TAX_STD, vat };
    }
    if (reg === 'CEUTA' || reg === 'MELILLA' || reg === 'CEUTA_MELILLA') {
        return { electricityTax: ELECTRICITY_TAX_STD, vat: VAT_IPSI_CEUTA_MELILLA };
    }
    if (reg === 'BALEARES') {
        return { electricityTax: ELECTRICITY_TAX_STD, vat: VAT_BALEARES };
    }
    return { electricityTax: ELECTRICITY_TAX_STD, vat: VAT_PENINSULA };
}

// Impuestos específicos para gas según región (legacy app.js)
function getGasTaxes(region: Region, consumoPeriodo = 0, variableCost = 0) {
    const reg = (region || '').toUpperCase() as Region;
    if (reg === 'CANARIAS') {
        return { gasTax: variableCost * 0.03, vat: 0 };
    }
    if (reg === 'CEUTA' || reg === 'MELILLA' || reg === 'CEUTA_MELILLA') {
        return { gasTax: variableCost * 0.01, vat: 0.01 };
    }
    // PENINSULA y BALEARES
    return { gasTax: consumoPeriodo * 0.00234, vat: 0.21 };
}

// ---- Ajustes de energía (legacy calculator.js) ----
function getEnergyAdjustmentPerKwh(supplier: string, productName: string): number {
    const supplierKey = supplier.toUpperCase();
    const prodName = productName.toUpperCase();
    const adj = (ajustesData as any).energiaPorKwh?.[supplierKey];
    if (!adj) return 0;

    if (adj.default !== undefined) return adj.default;
    if (adj.prefixes) {
        for (const [prefix, val] of Object.entries(adj.prefixes)) {
            if (prodName.startsWith(prefix.toUpperCase())) return val as number;
        }
    }
    return 0;
}

function applyEnergyAdjustment(precios: Record<string, number>, adjustment: number) {
    const out: Record<string, number> = {};
    Object.entries(precios).forEach(([k, v]) => {
        out[k] = (v || 0) + adjustment;
    });
    return out;
}

// Percentil simple para filtro de comisiones
function calculatePercentile(arr: number[], percentile: number) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// Estimación de comisión equilibrada (ahorro con incentivo moderado)
function estimateCommission(annualSavings: number) {
    const base = Math.max(0, annualSavings * 0.1);
    const cappedBySavings = Math.min(base, annualSavings * 0.25);
    return cappedBySavings; // sin tope absoluto
}

function selectBlock<T extends { desde?: number | null; hasta?: number | null }>(blocks: T[], value: number) {
    return blocks.find(b => {
        const min = b.desde ?? 0;
        const max = b.hasta ?? null;
        if (max === null) return value >= min;
        return value >= min && value <= max;
    });
}

function computeCommissionFromTable(
    supplier: string,
    tariffType: TariffType | string,
    productName: string,
    consumoAnualKwh: number,
    potenciaKw: number
): number {
    const supKey = (supplier || '').toUpperCase();
    const tariffKey = tariffType as string;
    const prodKey = productName || '';
    const supData = (comisionesData as any)[supKey];
    if (!supData) return 0;
    const tarifaData = supData.tarifas?.[tariffKey];
    if (!tarifaData) return 0;
    const prodData = tarifaData[prodKey];
    if (!prodData) return 0;

    // Caso tarifa fija (comisión directa)
    if (prodData.tipo === 'fija' && typeof prodData.comision === 'number') {
        return prodData.comision;
    }

    // Fórmula lineal por consumo
    if (prodData.tipo === 'formula') {
        const limite = prodData.limite_consumo ?? consumoAnualKwh;
        const consumoAplicado = Math.min(consumoAnualKwh, limite);
        const factor = prodData.factor ?? 0;
        const base = prodData.base ?? 0;
        return base + (consumoAplicado * factor) / 1000;
    }

    // Variable por bloques (consumo o potencia + consumo)
    const criterio = prodData.criterio || 'consumo';
    if (criterio === 'consumo' && Array.isArray(prodData.bloques)) {
        const block = selectBlock(prodData.bloques, consumoAnualKwh);
        return block?.comision ?? 0;
    }

    if (criterio === 'potencia_consumo' && Array.isArray(prodData.bloques)) {
        const potBlock = selectBlock(prodData.bloques, potenciaKw);
        if (!potBlock || !Array.isArray(potBlock.bloques_consumo)) return 0;
        const conBlock = selectBlock(potBlock.bloques_consumo, consumoAnualKwh);
        return conBlock?.comision ?? 0;
    }

    if (criterio === 'consumo_formula') {
        const limite = prodData.limite_consumo ?? consumoAnualKwh;
        const consumoAplicado = Math.min(consumoAnualKwh, limite);
        const factor = prodData.factor ?? 0;
        const base = prodData.base ?? 0;
        return base + (consumoAplicado * factor) / 1000;
    }

    return 0;
}

// ---- Cálculo de factura Eléctrica ----
function calculateElectricBill(
    formData: FormData,
    preciosConsumo: Record<string, number>,
    preciosPotencia: Record<string, number>,
    consumos: Record<string, number>,
    potencias: Record<string, number>
) {
    const days = formData.billingDays || 30;

    // término de energía
    let energyCostRaw = 0;
    for (const [periodo, kwh] of Object.entries(consumos)) {
        energyCostRaw += (kwh || 0) * (preciosConsumo[periodo] || 0);
    }
    const energyCost = roundToCents(energyCostRaw);

    // término de potencia
    let powerCostRaw = 0;
    for (const [periodo, kw] of Object.entries(potencias)) {
        powerCostRaw += (kw || 0) * (preciosPotencia[periodo] || 0) * days;
    }
    const powerCost = roundToCents(powerCostRaw);

    // Conceptos adicionales
    const equipmentRental = Number(formData.equipmentRental || 0);
    const otherCosts = Number(formData.otherCosts || 0);
    const discountEnergy = Number(formData.discountEnergy || 0);
    const discountPower = Number(formData.discountPower || 0);
    const reactiveEnergy = Number(formData.reactiveEnergy || 0);
    const excessPower = Number(formData.excessPower || 0);
    const socialBonus = Number(formData.socialBonus || 0);

    const subtotal = roundToCents(
        energyCost - discountEnergy +
        powerCost - discountPower +
        reactiveEnergy +
        excessPower +
        equipmentRental +
        otherCosts -
        socialBonus
    );

    const potValues = Object.values(potencias);
    const maxPotencia = potValues.length ? Math.max(...potValues, 0) : 0;
    const taxes = getTaxRates(formData.region, maxPotencia);

    const electricityTax = roundToCents(subtotal * taxes.electricityTax);
    const taxableBase = roundToCents(subtotal + electricityTax);
    const vatAmount = roundToCents(taxableBase * taxes.vat);
    const total = roundToCents(taxableBase + vatAmount);

    const currentBill = Number(formData.currentBill || 0);
    const savings = roundToCents(currentBill - total);
    const annualSavings = roundToCents((savings / days) * 365);

    return {
        energyCost,
        powerCost,
        equipmentRental,
        otherCosts,
        socialBonus,
        electricityTax,
        vat: vatAmount,
        subtotal,
        taxableBase,
        total,
        savings,
        savingsPercent: currentBill > 0 ? roundToCents((savings / currentBill) * 100) : 0,
        annualSavings
    };
}

// ---- Cálculo de factura Gas ----
function calculateGasBill(formData: FormData, tariff: any) {
    const billingDays = Number(formData.billingDays || 30);
    const consumptionKwh = Number(formData.gasMonthlyConsumption || 0);
    const equipmentRental = Number(formData.equipmentRental || 0);
    const otherCosts = Number(formData.otherCosts || 0);
    const currentBill = Number(formData.currentBill || 0);

    const fixedCost = roundToCents(billingDays * (tariff.terminoFijoDiario || 0));
    const energyCost = roundToCents(consumptionKwh * (tariff.terminoVariableKwh || 0));

    const subtotal = roundToCents(fixedCost + energyCost + equipmentRental + otherCosts);
    const taxes = getGasTaxes(formData.region, consumptionKwh, energyCost);

    const gasTax = roundToCents(taxes.gasTax);
    const taxableBase = roundToCents(subtotal + gasTax);
    const vatAmount = roundToCents(taxableBase * taxes.vat);
    const total = roundToCents(taxableBase + vatAmount);

    const savings = roundToCents(currentBill - total);
    const annualSavings = roundToCents((savings / billingDays) * 365);

    return {
        energyCost,
        powerCost: fixedCost,
        equipmentRental,
        otherCosts,
        socialBonus: Number(formData.socialBonus || 0),
        gasTax,
        vat: vatAmount,
        subtotal,
        taxableBase,
        total,
        savings,
        savingsPercent: currentBill > 0 ? roundToCents((savings / currentBill) * 100) : 0,
        annualSavings
    };
}

// ---- Helpers Periodos ----
function getPeriodosConsumo(tariffType: TariffType): string[] {
    if (tariffType === '2.0TD') return ['P1', 'P2', 'P3'];
    return ['P1', 'P4', 'P2', 'P5', 'P3', 'P6']; // Orden P1-P6 pero considerando importancia
}
function getPeriodosPotencia(tariffType: TariffType): string[] {
    if (tariffType === '2.0TD') return ['P1', 'P2'];
    return ['P1', 'P4', 'P2', 'P5', 'P3', 'P6'];
}

// Bloqueos por región (paridad legacy)
function filterResultsByRegion(results: ResultadoTarifa[], region: Region) {
    const reg = (region || 'PENINSULA').toUpperCase();
    const disallowed: Record<string, string[]> = {
        CANARIAS: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'LOCALUZ', 'TOTAL ENERGIES', 'TOTAL'],
        BALEARES: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'LOCALUZ', 'TOTAL ENERGIES', 'TOTAL'],
        CEUTA: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'POLARIS', 'LOCALUZ', 'LOGOS', 'TOTAL ENERGIES', 'TOTAL'],
        MELILLA: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'POLARIS', 'LOCALUZ', 'LOGOS', 'TOTAL ENERGIES', 'TOTAL'],
        CEUTA_MELILLA: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'POLARIS', 'LOCALUZ', 'LOGOS', 'TOTAL ENERGIES', 'TOTAL']
    };
    const blocked = disallowed[reg] || [];
    return results.filter(r => !blocked.includes((r.supplier || '').toUpperCase()));
}

// ---- Principal ----
export function calcularComparativa(
    formData: FormData,
    options: { limit?: number; maxPerSupplier?: number; includeNegative?: boolean } = {}
): ResultadoTarifa[] {
    const { energyType, tariffType, region } = formData;
    const { limit = 100, maxPerSupplier = 2 } = options;
    const resultados: ResultadoTarifa[] = [];

    if (energyType === 'gas') {
        const gasRoot = (gasTarifasData as any).GAS || {};
        const band = formData.gasTariffBand || 'RL2';

        Object.keys(gasRoot).forEach(supplierKey => {
            const supplierData = gasRoot[supplierKey];
            const supplierName = supplierData.metadata?.comercializadora || supplierKey;

            const productos = supplierData.productos || [];
            productos.forEach((prod: any) => {
                // Filtrar por banda de gas
                if (prod.band !== band) return;

                const calc = calculateGasBill(formData, prod);
                if (calc.savings <= 0 && !options.includeNegative) return;

                const consumptionAnual = formData.cae || Number(formData.gasMonthlyConsumption || 0) * 12;
                const comision = computeCommissionFromTable(supplierName, band, prod.nombre, consumptionAnual, formData.potenciaP1 || 0) || estimateCommission(calc.annualSavings);

                resultados.push({
                    supplier: supplierName,
                    productName: prod.nombre,
                    tariffType: band,
                    ...calc,
                    monthlySavings: calc.savings,
                    comision,
                    score: calc.savings + comision
                });
            });
        });
    } else {
        // Electricidad
        const typeBlock = (tarifasData as any)[tariffType];
        if (!typeBlock) return [];

        const periodosC = getPeriodosConsumo(tariffType);
        const periodosP = getPeriodosPotencia(tariffType);

        const consumosForm: Record<string, number> = {};
        const potenciasForm: Record<string, number> = {};
        periodosC.forEach(p => consumosForm[p] = Number((formData as any)[`consumption${p}`] || 0));
        periodosP.forEach(p => potenciasForm[p] = Number((formData as any)[`potencia${p}`] || 0));

        const consumoTotal = Object.values(consumosForm).reduce((a, b) => a + b, 0);
        if (consumoTotal <= 0) return [];

        const potValues = Object.values(potenciasForm);
        const maxPotencia = potValues.length ? Math.max(...potValues, 0) : 0;
        const potenciaP1 = potenciasForm['P1'] || 0;
        const consumoAnual = formData.cae || consumoTotal * 12;

        Object.keys(typeBlock).forEach(supplierKey => {
            const supplierData = typeBlock[supplierKey];
            const supplierName = supplierData.metadata?.comercializadora || supplierKey;

            const productos = supplierData.productos || [];
            productos.forEach((prod: any) => {
                // Filtros de potencia y consumo (parity legacy)
                if (prod.potenciaMin !== undefined && maxPotencia < prod.potenciaMin) return;
                if (prod.potenciaMax !== undefined && maxPotencia > prod.potenciaMax) return;
                if (prod.consumoAnualMin !== undefined && consumoAnual < prod.consumoAnualMin) return;
                if (prod.consumoAnualMax !== undefined && consumoAnual > prod.consumoAnualMax) return;

                // Filtro especial Repsol (parity legacy)
                if (supplierName.toUpperCase() === 'REPSOL' && maxPotencia <= 10 && /L(0|2|4|8)$/.test(prod.nombre || '')) return;

                const preciosConsumoRaw = prod.periodosConsumo || prod.consumo || {};
                const preciosPotencia = prod.periodosPotencia || prod.potencia || {};

                // Aplicar ajustes de energía
                const adj = getEnergyAdjustmentPerKwh(supplierName, prod.nombre || '');
                const preciosConsumo = applyEnergyAdjustment(preciosConsumoRaw, adj);

                const calc = calculateElectricBill(formData, preciosConsumo, preciosPotencia, consumosForm, potenciasForm);
                if (calc.savings <= 0 && !options.includeNegative) return;

                const comision = computeCommissionFromTable(supplierName, tariffType, prod.nombre, consumoAnual, potenciaP1) || estimateCommission(calc.annualSavings);

                resultados.push({
                    supplier: supplierName,
                    productName: prod.nombre,
                    tariffType,
                    ...calc,
                    monthlySavings: calc.savings,
                    preciosEnergia: preciosConsumo,
                    preciosPotencia: preciosPotencia,
                    comision,
                    score: calc.savings + comision
                });
            });
        });
    }

    // Ordenar y filtrar
    const ordenados = resultados.sort((a, b) => b.savings - a.savings);

    const regionalFiltered = filterResultsByRegion(ordenados, region);

    // Filtrar por ahorro 8% - 20%
    const savingsBand = regionalFiltered.filter(r => {
        const sp = r.savingsPercent || 0;
        return sp >= 8 && sp <= 20;
    });

    const listForLimit = savingsBand.length ? savingsBand : regionalFiltered;

    const filtrados: ResultadoTarifa[] = [];
    const counts: Record<string, number> = {};

    for (const res of listForLimit) {
        if (filtrados.length >= limit) break;
        const supplierHash = res.supplier.toUpperCase();
        counts[supplierHash] = (counts[supplierHash] || 0) + 1;
        if (counts[supplierHash] > maxPerSupplier) continue;
        filtrados.push(res);
    }

    // Marcar recomendadas: top 3 por comisión dentro del set mostrado
    filtrados.forEach(r => { r.recommended = false; });
    filtrados
        .slice()
        .sort((a, b) => (b.comision || 0) - (a.comision || 0))
        .slice(0, 3)
        .forEach(r => { r.recommended = true; });

    // Orden final por ahorro (savings) descendente
    return filtrados.sort((a, b) => (b.savings || 0) - (a.savings || 0));
}
