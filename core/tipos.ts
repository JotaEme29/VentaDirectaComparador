// core/tipos.ts

export type EnergyType = 'electricidad' | 'gas';
export type TariffType = '2.0TD' | '3.0TD' | '6.1TD' | 'GAS';
export type Region =
    | 'PENINSULA'
    | 'BALEARES'
    | 'CANARIAS'
    | 'CEUTA'
    | 'MELILLA'
    | 'CEUTA_MELILLA';

export interface FormData {
    energyType: EnergyType;
    tariffType: TariffType;
    region: Region;
    gasTariffBand: 'RL1' | 'RL2' | 'RL3' | 'RL4' | 'RL5';
    clientName: string;
    address: string;
    cups: string;

    billingDays: number;
    currentBill: number;
    cae: number;

    equipmentRental: number;
    otherCosts: number;

    discountEnergy: number;
    discountPower: number;
    reactiveEnergy: number;
    excessPower: number;
    socialBonus: number;

    gasMonthlyConsumption: number;
    gasFixedDaily: number;
    gasVariableKwh: number;

    // Consumos por periodo
    consumptionP1: number;
    consumptionP2: number;
    consumptionP3: number;
    consumptionP4: number;
    consumptionP5: number;
    consumptionP6: number;

    // Potencias por periodo
    potenciaP1: number;
    potenciaP2: number;
    potenciaP3: number;
    potenciaP4: number;
    potenciaP5: number;
    potenciaP6: number;

    // Opcional: factura adjunta/base64 para IA o envío por email
    invoiceFile?: {
        fileName: string;
        mimeType: string;
        base64: string;
    } | null;
}

export interface ResultadoTarifa {
    supplier: string;
    productName: string;
    tariffType: TariffType | string;
    recommended?: boolean;

    // Costes principales
    energyCost: number;
    powerCost: number;
    equipmentRental: number;
    otherCosts: number;
    socialBonus?: number;
    electricityTax?: number;
    gasTax?: number;
    vat: number;
    subtotal: number;
    taxableBase: number;
    total: number;

    // Ahorros vs factura actual
    savings: number;
    savingsPercent: number;
    monthlySavings: number;
    annualSavings: number;

    // Precios por periodo (para mostrar detalle en tarjetas)
    preciosEnergia?: Record<string, number>;
    preciosPotencia?: Record<string, number>;

    // Datos internos (no mostrar al cliente)
    comision?: number; // €
    score?: number;    // métrica ganar-ganar
}
