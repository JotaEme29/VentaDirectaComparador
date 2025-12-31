// scripts/test-calc.ts
import { calcularComparativa } from '../core/calculoTarifas';
import { FormData } from '../core/tipos';

const mockForm: FormData = {
    energyType: 'electricidad',
    tariffType: '2.0TD',
    region: 'PENINSULA',
    clientName: 'Test Client',
    address: '',
    cups: '',
    billingDays: 30,
    currentBill: 100,
    cae: 3600,
    equipmentRental: 1.19,
    otherCosts: 0.80,
    discountEnergy: 0,
    discountPower: 0,
    reactiveEnergy: 0,
    excessPower: 0,
    socialBonus: 0,
    consumptionP1: 100,
    consumptionP2: 100,
    consumptionP3: 100,
    consumptionP4: 0,
    consumptionP5: 0,
    consumptionP6: 0,
    potenciaP1: 3.45,
    potenciaP2: 3.45,
    potenciaP3: 0,
    potenciaP4: 0,
    potenciaP5: 0,
    potenciaP6: 0,
    gasMonthlyConsumption: 0,
    gasFixedDaily: 0,
    gasVariableKwh: 0,
    gasTariffBand: 'RL2'
};

console.log('--- Electricity Test Results ---');
const results = calcularComparativa(mockForm, { limit: 5, includeNegative: true });
results.forEach(r => {
    console.log(`${r.supplier} - ${r.productName}: Total=${r.total}€, Savings=${r.savings}€`);
});

const mockGasForm: FormData = {
    ...mockForm,
    energyType: 'gas',
    gasMonthlyConsumption: 500,
    gasTariffBand: 'RL2',
    currentBill: 50
};

console.log('\n--- Gas Test Results ---');
const gasResults = calcularComparativa(mockGasForm, { limit: 5, includeNegative: true });
gasResults.forEach(r => {
    console.log(`${r.supplier} - ${r.productName}: Total=${r.total}€, Savings=${r.savings}€`);
});
