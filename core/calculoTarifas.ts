// core/calculoTarifas.ts

import tarifasData from '../data/tarifas.v2.json';
import { FormData, ResultadoTarifa, Region, TariffType } from './tipos';
import { calcularComision, isSupplierAllowed } from './comisiones';

// ---- Impuestos (igual que app.js) ----
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

// Devuelve los periodos activos según tarifa
function getPeriodosConsumo(tariffType: TariffType): string[] {
    if (tariffType === '2.0TD') return ['P1', 'P2', 'P3'];
    return ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
}

function getPeriodosPotencia(tariffType: TariffType): string[] {
    if (tariffType === '2.0TD') return ['P1', 'P2'];
    return ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
}

// Lee consumos del FormData respetando P1..P6
function getConsumosDesdeForm(form: FormData, tariffType: TariffType): Record<string, number> {
    const periodos = getPeriodosConsumo(tariffType);
    const out: Record<string, number> = {};
    periodos.forEach(p => {
        const key = ('consumption' + p) as keyof FormData;
        out[p] = Number(form[key] || 0);
    });
    return out;
}

// Lee potencias del FormData respetando P1..P6
function getPotenciasDesdeForm(form: FormData, tariffType: TariffType): Record<string, number> {
    const periodos = getPeriodosPotencia(tariffType);
    const out: Record<string, number> = {};
    periodos.forEach(p => {
        const key = ('potencia' + p) as keyof FormData;
        out[p] = Number(form[key] || 0);
    });
    return out;
}

// ---- Cálculo de factura para una tarifa concreta ----

function calculateBill(
    formData: FormData,
    tariffType: TariffType,
    preciosConsumo: Record<string, number>,
    preciosPotencia: Record<string, number>,
    consumos: Record<string, number>,
    potencias: Record<string, number>
) {
    const days = formData.billingDays || 30;

    // término de energía
    let energyCostRaw = 0;
    for (const [periodo, kwh] of Object.entries(consumos)) {
        const price = preciosConsumo[periodo] || 0;
        energyCostRaw += (kwh || 0) * price;
    }
    const energyCost = roundToCents(energyCostRaw);

    // término de potencia
    let powerCostRaw = 0;
    for (const [periodo, kw] of Object.entries(potencias)) {
        const pricePerDay = preciosPotencia[periodo] || 0;
        powerCostRaw += (kw || 0) * pricePerDay * days;
    }
    const powerCost = roundToCents(powerCostRaw);

    // otros conceptos (solo los básicos que quieres ahora)
    const equipmentRental = formData.equipmentRental || 0;
    const otherCosts = formData.otherCosts || 0;

    // descuentos, reactiva, exceso, bono social (si decides activarlos más adelante)
    const discountEnergy = formData.discountEnergy || 0;
    const discountPower = formData.discountPower || 0;
    const reactiveEnergy = formData.reactiveEnergy || 0;
    const excessPower = formData.excessPower || 0;
    const socialBonus = formData.socialBonus || 0;

    const subtotal = roundToCents(
        energyCost -
        discountEnergy +
        powerCost -
        discountPower +
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

    const currentBill = formData.currentBill || 0;
    const savings = roundToCents(currentBill - total);
    const savingsPercent = currentBill > 0 ? roundToCents((savings / currentBill) * 100) : 0;
    const dailySavings = formData.billingDays ? savings / formData.billingDays : 0;
    const annualSavings = roundToCents(dailySavings * 365);

    return {
        energyCost,
        powerCost,
        equipmentRental,
        otherCosts,
        electricityTax,
        vat: vatAmount,
        subtotal,
        taxableBase,
        total,
        savings,
        savingsPercent,
        monthlySavings: savings,
        annualSavings
    };
}

// ---- Función principal para React ----


export interface CalculationOptions {
    limit?: number;
    maxPerSupplier?: number;
    // Si true, no filtra por savings > 0 (por si acaso quisieras ver todo), pero por defecto false
    includeNegative?: boolean;
}

export function calcularComparativa(
    formData: FormData,
    porcentajes: Record<string, number> | null = null,
    options: CalculationOptions = {}
): ResultadoTarifa[] {
    const { tariffType } = formData;
    const { limit = 100, maxPerSupplier = 2 } = options;

    if (!tariffType || tariffType === 'GAS') return [];

    const typeBlock = (tarifasData as any)[tariffType];
    if (!typeBlock) return [];

    // leer consumos y potencias tal cual del formulario
    const consumosForm = getConsumosDesdeForm(formData, tariffType);
    const potenciasForm = getPotenciasDesdeForm(formData, tariffType);

    // si todo está a cero, no calculamos nada
    const consumoTotal = Object.values(consumosForm).reduce((a, b) => a + (b || 0), 0);
    if (consumoTotal <= 0) return [];

    const potenciaMedia =
        Object.values(potenciasForm).reduce((a, b) => a + (b || 0), 0) /
        (Object.values(potenciasForm).filter(v => v > 0).length || 1) || 0;

    const consumoAnual = formData.cae || consumoTotal * 12;

    const resultados: ResultadoTarifa[] = [];

    Object.keys(typeBlock).forEach(supplierKey => {
        const supplierData = typeBlock[supplierKey];
        const supplierName = supplierData.metadata?.comercializadora || supplierKey;

        // Pasamos porcentajes a isSupplierAllowed
        if (!isSupplierAllowed(supplierName, porcentajes)) return;

        const productos = supplierData.productos || [];

        productos.forEach((prod: any) => {
            const periodosConsumo = prod.periodosConsumo || {};
            const periodosPotencia = prod.periodosPotencia || {};

            const preciosConsumo: Record<string, number> = {};
            const preciosPotencia: Record<string, number> = {};

            // solo rellenamos los periodos que están activos en el formulario
            getPeriodosConsumo(tariffType).forEach(p => {
                preciosConsumo[p] = periodosConsumo[p] ?? 0;
            });
            getPeriodosPotencia(tariffType).forEach(p => {
                preciosPotencia[p] = periodosPotencia[p] ?? 0;
            });

            const calc = calculateBill(
                formData,
                tariffType,
                preciosConsumo,
                preciosPotencia,
                consumosForm,
                potenciasForm
            );

            if (calc.savings <= 0 && !options.includeNegative) return;

            // Pasamos porcentajes a calcularComision
            const comision = calcularComision(
                supplierName,
                prod.nombre || 'Producto',
                consumoAnual,
                potenciaMedia,
                tariffType,
                porcentajes
            );

            // Score: Equilibrio entre ahorro y comisión
            // Ajustar pesos según necesidad. Legacy usaba 75/25 implicito en "Tarifa Estrella"?
            // Usamos un valor normalizado. 
            // Ahorro puede ser 100€, comisión 20€.
            // Score = Ahorro + Comision (simple) o ponderado.
            // La "Tarifa Estrella" legacy era el mejor equilibrio.
            // Vamos a sumar ambos valores directos como 'score' base.
            const score = calc.savings + (comision || 0);

            resultados.push({
                supplier: supplierName,
                productName: prod.nombre || 'Producto',
                tariffType,
                energyCost: calc.energyCost,
                powerCost: calc.powerCost,
                equipmentRental: calc.equipmentRental,
                otherCosts: calc.otherCosts,
                electricityTax: calc.electricityTax,
                vat: calc.vat,
                subtotal: calc.subtotal,
                taxableBase: calc.taxableBase,
                total: calc.total,
                savings: calc.savings,
                savingsPercent: calc.savingsPercent,
                monthlySavings: calc.monthlySavings,
                annualSavings: calc.annualSavings,
                preciosEnergia: preciosConsumo,
                preciosPotencia: preciosPotencia,
                comision,
                score
            });
        });
    });

    // 1) Ordenar por score por defecto? O por savings?
    // Devolvemos ordenado por savings por defecto, el UI reordena.
    const ordenados = resultados
        .sort((a, b) => b.savings - a.savings);

    // 2) limitar a máximo N por comercializadora
    const porSupplier: Record<string, number> = {};
    const filtrados: typeof resultados = [];

    for (const r of ordenados) {
        const key = r.supplier.toUpperCase();
        const count = porSupplier[key] || 0;
        if (count >= maxPerSupplier) continue;
        porSupplier[key] = count + 1;
        filtrados.push(r);
        if (limit > 0 && filtrados.length >= limit) break;
    }

    return filtrados;

}
