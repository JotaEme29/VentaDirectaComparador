// core/comisiones.ts

import comisionesData from '@data/comisiones.json';
import comercialesData from '@data/comerciales.json';
import { TariffType } from './tipos';

// Aliases como en app.js
const SUPPLIER_ALIASES: Record<string, string> = {
    'GREENING ENERGY': 'GREENING',
    GREENING: 'GREENING ENERGY'
};

type ComisionesMapa = typeof comisionesData;

// Normaliza claves a mayúsculas
function normalizePercentMap(map: Record<string, number> | undefined | null) {
    const out: Record<string, number> = {};
    Object.entries(map || {}).forEach(([k, v]) => {
        out[(k || '').toUpperCase()] = v;
    });
    return out;
}

// Obtener porcentajes para un código (stateless)
export function getPorcentajes(code: string | null): Record<string, number> | null {
    if (!code) return null;
    const key = (code || '').toUpperCase();
    // Búsqueda insensible a mayúsculas en las keys del JSON
    const codeKey = Object.keys(comercialesData).find(k => k.toUpperCase() === key);
    if (!codeKey) return null;

    const mapa = (comercialesData as any)[codeKey];
    return normalizePercentMap(mapa);
}

function getSupplierPercent(supplier: string, porcentajes: Record<string, number> | null) {
    if (!porcentajes) return 1;
    const key = (supplier || '').toUpperCase();
    const alias = SUPPLIER_ALIASES[key];
    if (Object.prototype.hasOwnProperty.call(porcentajes, key)) {
        return porcentajes[key];
    }
    if (alias && Object.prototype.hasOwnProperty.call(porcentajes, alias)) {
        return porcentajes[alias];
    }
    return 1;
}

export function isSupplierAllowed(supplier: string, porcentajes: Record<string, number> | null) {
    const pct = getSupplierPercent(supplier, porcentajes);
    return pct !== 0;
}

// ---- Lógica de bloques (port de app.js) ----

function getComisionPorBloque(
    bloques: Array<{ desde?: number | null; hasta?: number | null; comision?: number }>,
    valor: number
): number {
    for (const bloque of bloques || []) {
        const desde = bloque.desde ?? 0;
        const hasta = bloque.hasta ?? Infinity;
        if (valor >= desde && valor <= hasta) {
            return bloque.comision ?? 0;
        }
    }
    // Si no encaja, devuelve la comisión del último bloque
    if (bloques && bloques.length) {
        return bloques[bloques.length - 1].comision ?? 0;
    }
    return 0;
}

// Versión simplificada de getComisionPersonalizada de tu app.js
// Wrapper para aplicar ajustes finales (como la penalización de Endesa)
export function calcularComision(
    supplier: string,
    productName: string,
    consumoAnual: number,
    potenciaP1: number,
    tariffType: TariffType,
    porcentajes: Record<string, number> | null = null
): number {
    const rawCommission = calcularComisionRaw(supplier, productName, consumoAnual, potenciaP1, tariffType, porcentajes);

    // Normalizar supplierKey
    const supplierKey = (supplier || '').toString().trim().toUpperCase();

    // Lógica legacy: (base * porcentaje) - 50 para Endesa
    // En legacy: (supplierKey === 'ENDESA' ? 50 : 0)
    // También checkear 'ENDESA ENERGIA' por si acaso, aunque el alias suele manejarlo
    const penalty = (supplierKey === 'ENDESA' || supplierKey === 'ENDESA ENERGIA') ? 50 : 0;

    return Math.max(0, rawCommission - penalty);
}

function calcularComisionRaw(
    supplier: string,
    productName: string,
    consumoAnual: number,
    potenciaP1: number,
    tariffType: TariffType,
    porcentajes: Record<string, number> | null = null
): number {
    const data = comisionesData as ComisionesMapa;
    const supplierKey = (supplier || '').toUpperCase();
    const comSupplier =
        (data as any)[supplierKey] ||
        (data as any)[SUPPLIER_ALIASES[supplierKey] || ''] ||
        null;

    if (!comSupplier) return 0;

    const porcentaje = getSupplierPercent(supplier, porcentajes);
    if (porcentaje === 0) return 0;

    const tType = tariffType as string;
    const nombreProducto = (productName || '').trim();

    // 1) Buscar configuraciones específicas de tarifas
    if (comSupplier.tarifas && comSupplier.tarifas[tType]) {
        const tConfig = comSupplier.tarifas[tType];

        if (tConfig[nombreProducto]) {
            const prodConf = tConfig[nombreProducto];

            if (typeof prodConf === 'number') {
                return prodConf * porcentaje;
            }

            if (prodConf.tipo === 'fija') {
                return (prodConf.comision || 0) * porcentaje;
            }

            if (prodConf.tipo === 'formula') {
                const base = prodConf.base || 0;
                const factor = prodConf.factor || 0;
                const limite = prodConf.limite_consumo || 0;
                if (consumoAnual <= limite) return base * porcentaje;
                return (base + (consumoAnual / 1000) * factor) * porcentaje;
            }

            if (prodConf.tipo === 'variable') {
                // const criterio = prodConf.criterio || 'consumo'; // Unused
                const bloqueCriterio = prodConf.criterio || 'consumo';
                const valor = bloqueCriterio === 'potencia_consumo' ? potenciaP1 : consumoAnual;
                const bloques = prodConf.bloques || [];
                return getComisionPorBloque(bloques, valor) * porcentaje;
            }
        }
    }

    // 2) Buscar en productos genéricos
    if (comSupplier.productos && comSupplier.productos[nombreProducto]) {
        const prodConf = comSupplier.productos[nombreProducto];

        if (typeof prodConf === 'number') {
            return prodConf * porcentaje;
        }

        if (prodConf.tipo === 'fija') {
            return (prodConf.comision || 0) * porcentaje;
        }

        if (prodConf.tipo === 'formula') {
            const base = prodConf.base || 0;
            const factor = prodConf.factor || 0;
            const limite = prodConf.limite_consumo || 0;
            if (consumoAnual <= limite) return base * porcentaje;
            return (base + (consumoAnual / 1000) * factor) * porcentaje;
        }

        if (prodConf.tipo === 'variable') {
            const bloqueCriterio = prodConf.criterio || 'consumo';
            const valor = bloqueCriterio === 'potencia_consumo' ? potenciaP1 : consumoAnual;
            const bloques = prodConf.bloques || [];
            return getComisionPorBloque(bloques, valor) * porcentaje;
        }
    }

    // 3) Configuración por defecto del proveedor
    if (typeof comSupplier.default === 'number') {
        return comSupplier.default * porcentaje;
    }
    if (comSupplier.tipo === 'variable' && comSupplier.bloques) {
        const bloqueCriterio = comSupplier.criterio || 'consumo';
        const valor = bloqueCriterio === 'potencia_consumo' ? potenciaP1 : consumoAnual;
        return getComisionPorBloque(comSupplier.bloques, valor) * porcentaje;
    }

    return 0;
}
