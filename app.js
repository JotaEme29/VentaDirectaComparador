// Comparador - Modal + Dashboard (build refresh)

let TARIFFS_DATA = null;

let COMISIONES_DATA = null;

let SHOW_COMMISSION = false; // Estado global para mostrar/ocultar comisiones (por defecto ocultas)

let COMERCIALES_DATA = null;

let CODIGO_COMERCIAL = null;

let PORCENTAJES_COMERCIAL = null;

const SUPPLIER_ALIASES = {

    'GREENING ENERGY': 'GREENING',

    'GREENING': 'GREENING ENERGY'

};

function normalizePercentMap(map) {
    const out = {};
    Object.entries(map || {}).forEach(([k, v]) => {
        out[(k || '').toUpperCase()] = v;
    });
    return out;
}

// Helper to try multiple URLs for the same JSON (useful when /api/data is not served as static)
async function fetchJsonWithFallback(urls) {
    for (const url of urls) {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) continue;
            return await res.json();
        } catch (_) {
            // continue with next URL
        }
    }
    throw new Error('All fallbacks failed: ' + urls.join(', '));
}

function getSupplierPercent(supplier) {
    if (!PORCENTAJES_COMERCIAL) return 1;
    const key = (supplier || '').toUpperCase();
    const alias = SUPPLIER_ALIASES[key];
    if (Object.prototype.hasOwnProperty.call(PORCENTAJES_COMERCIAL, key)) {
        return PORCENTAJES_COMERCIAL[key];
    }
    if (alias && Object.prototype.hasOwnProperty.call(PORCENTAJES_COMERCIAL, alias)) {
        return PORCENTAJES_COMERCIAL[alias];
    }
    return 1;
}

function isSupplierAllowed(supplier) {
    const pct = getSupplierPercent(supplier);
    return pct !== 0;
}



async function loadTariffs() {

    try {

        const urls = [
            '/api/tarifas'
        ];

        TARIFFS_DATA = await fetchJsonWithFallback(urls);

    } catch (err) {

        console.error('Error cargando tarifas:', err);

        alert('Error cargando las tarifas. Por favor, recarga la página.');

    }

}



async function loadComisiones() {

    try {

        const urls = [
            '/api/comisiones'
        ];

        COMISIONES_DATA = await fetchJsonWithFallback(urls);

    } catch (err) {

        console.warn('Error cargando comisiones:', err);

        COMISIONES_DATA = {}; // Continuar sin comisiones

    }

}



async function loadComerciales() {

    if (COMERCIALES_DATA) return;

    try {

        const urls = [
            '/api/comerciales'
        ];

        COMERCIALES_DATA = await fetchJsonWithFallback(urls);

    } catch (err) {

        console.error('Error cargando comerciales:', err);

        COMERCIALES_DATA = {};

    }

}

function setPorcentajesFromCodigo(code) {
    if (!code || !COMERCIALES_DATA) {
        PORCENTAJES_COMERCIAL = null;
        return;
    }
    const key = (code || '').toUpperCase();
    PORCENTAJES_COMERCIAL = normalizePercentMap(
        COMERCIALES_DATA[key] || COMERCIALES_DATA[code] || {}
    );
}

async function loadGasTariffs() {
    if (GAS_TARIFFS_DATA) return;
    try {
        const urls = [
            '/api/tarifas-gas'
        ];
        const data = await fetchJsonWithFallback(urls);
        const flat = {};
        if (data.GAS) {
            Object.values(data.GAS).forEach(supplier => {
                const supplierCode = (supplier.metadata?.comercializadora || 'GAS').replace(/\s+/g, '').toUpperCase();
                (supplier.productos || []).forEach(prod => {
                    if (prod.band) {
                        // Usar clave única por comercializadora para no sobreescribir bandas repetidas (RL1, RL2, etc.)
                        const bandKey = prod.band;
                        const nameSlug = (prod.nombre || '').replace(/\W+/g, '').toUpperCase();
                        const key = `${bandKey}_${supplierCode}_${nameSlug || 'GEN'}`;
                        flat[key] = {
                            name: prod.nombre,
                            fixedDaily: prod.terminoFijoDiario,
                            variableKwh: prod.terminoVariableKwh,
                            supplier: supplier.metadata?.comercializadora || 'GAS'
                        };
                    }
                });
            });
        }
        if (Object.keys(flat).length) {
            GAS_TARIFFS_DATA = flat;
        } else {
            throw new Error('Sin productos de gas en v2');
        }
    } catch (err) {
        console.error('Error cargando tarifas de gas, usando valores por defecto:', err);
        GAS_TARIFFS_DATA = GAS_TARIFFS; // fallback a constantes locales
    }
}



const ELECTRICITY_TAX_STD = 0.051126963; // 5,1126963%
const VAT_PENINSULA = 0.21;
const VAT_CANARIAS_LOW = 0.0;
const VAT_CANARIAS_HIGH = 0.03;
const VAT_BALEARES = 0.21;
const VAT_IPSI_CEUTA_MELILLA = 0.01;

function roundToCents(value) {
    return Math.round((value || 0) * 100) / 100;
}

function getTaxRates(region, maxPotencia = 0) {
    const reg = (region || '').toUpperCase();
    if (reg === 'CANARIAS') {
        const vat = maxPotencia <= 10 ? VAT_CANARIAS_LOW : VAT_CANARIAS_HIGH;
        return { electricityTax: ELECTRICITY_TAX_STD, vat };
    }
    if (reg === 'CEUTA' || reg === 'MELILLA' || reg === 'CEUTA_MELILLA') {
        return { electricityTax: ELECTRICITY_TAX_STD, vat: VAT_IPSI_CEUTA_MELILLA };
    }
    if (reg === 'BALEARES') return { electricityTax: ELECTRICITY_TAX_STD, vat: VAT_BALEARES };
    return { electricityTax: ELECTRICITY_TAX_STD, vat: VAT_PENINSULA };
}

// Impuestos específicos para gas según región
function getGasTaxes(region, consumoPeriodo = 0, variableCost = 0) {
    const reg = (region || '').toUpperCase();
    if (reg === 'CANARIAS') {
        return { gasTax: variableCost * 0.03, vat: 0 };
    }
    if (reg === 'CEUTA' || reg === 'MELILLA' || reg === 'CEUTA_MELILLA') {
        return { gasTax: variableCost * 0.01, vat: 0.01 };
    }
    // PENINSULA y BALEARES
    return { gasTax: consumoPeriodo * 0.00234, vat: 0.21 };
}

const TOP_RESULTS = 30; // límite máximo absoluto

const INITIAL_RESULTS = 15; // los primeros que se muestran antes de expandir

const MAX_POWER_2TD = 15;

const MIN_POWER_3TD = 15;

// Tarifa gas placeholder (valores orientativos, reemplazar por datos reales)
const GAS_TARIFFS = {
    RL1: { name: 'RL1 (≤ 5.000 kWh/año)', fixedDaily: 0.20, variableKwh: 0.06 },
    RL2: { name: 'RL2 (5.001 - 15.000 kWh/año)', fixedDaily: 0.25, variableKwh: 0.065 },
    RL3: { name: 'RL3 (15.001 - 50.000 kWh/año)', fixedDaily: 0.30, variableKwh: 0.07 },
    RL4: { name: 'RL4 (50.001 - 100.000 kWh/año)', fixedDaily: 0.35, variableKwh: 0.075 },
    RL5: { name: 'RL5 (100.001 - 300.000 kWh/año)', fixedDaily: 0.40, variableKwh: 0.08 }
};



let currentTariffType = "2.0TD";

let lastResults = [];

let lastFormData = {};

let selectedResult = null;

let showingAll = false;

let sortMode = 'savings'; // 'savings' o 'commission'

let allResultsCache = [];

let selectedSupplier = 'all';

let energyType = 'electricidad'; // 'electricidad' | 'gas'
let gasTariffBand = 'RL2'; // Bandas gas RL1..RL5
let GAS_TARIFFS_DATA = null;

const CODIGO_STORAGE_KEY = 'codigoComercial';
const CODIGO_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días de validez

const GEMINI_API_KEY = 'AIzaSyD1zq3wcypA5_e_W9OzFpKGVIToC1iDn_8';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const ALLOWED_TARIFFS = ['2.0TD', '3.0TD', '6.1TD', 'GAS'];
const ALLOWED_REGIONS = ['PENINSULA', 'BALEARES', 'CANARIAS', 'CEUTA', 'MELILLA', 'CEUTA_MELILLA'];

let invoiceProcessing = false;
let invoiceWaitBarResetTimeout = null;



document.addEventListener('DOMContentLoaded', async () => {

    initTheme();

    updateLandingStats();

    setupFormListeners();

    bindEnergyToggle();
    bindGasBandToggle();

    updateConsumptionInputs();

    updatePotenciaInputs();

    toggleEnergyUI();

    bindThemeToggle();

    bindCommissionToggle();

    loadSavedCodigoComercial();
    await loadComisiones();
    await loadComerciales();
    if (CODIGO_COMERCIAL) setPorcentajesFromCodigo(CODIGO_COMERCIAL);


    document.getElementById('codigoComercialForm').addEventListener('submit', handleCodigoComercialSubmit);

});



function initTheme() {

    try {

        const saved = localStorage.getItem('theme');

        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        setTheme(theme);

    } catch (_) {

        setTheme('light');

    }

}



function setTheme(mode) {

    const body = document.body;

    if (mode === 'dark') body.classList.add('theme-dark');

    else body.classList.remove('theme-dark');

    updateThemeIcon();

}



function toggleTheme() {
    const isDark = document.body.classList.toggle('theme-dark');
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
    updateThemeIcon();
}


function updateThemeIcon() {

    const btn = document.getElementById('themeToggleBtn');

    if (!btn) return;

    const iconSpan = btn.querySelector('.theme-icon');

    const isDark = document.body.classList.contains('theme-dark');

    if (iconSpan) {

        // Inline SVG icons (sun/moon) without emojis for corporate style

        const sunSVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

        const moonSVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

        iconSpan.innerHTML = isDark ? moonSVG : sunSVG;
    }
    btn.setAttribute('aria-label', isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    btn.setAttribute('title', isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
}


function bindThemeToggle() {

    const btn = document.getElementById('themeToggleBtn');

    if (!btn) return;

    btn.addEventListener('click', (e) => {

        e.preventDefault();

        toggleTheme();

    });

}



function bindCommissionToggle() {

    const btn = document.getElementById('toggleCommissionBtn');

    if (btn) {

        btn.addEventListener('click', (e) => {

            e.preventDefault();

            e.stopPropagation();

            toggleCommissionVisibility();

        });

    }

}

function bindEnergyToggle() {
    const radios = document.querySelectorAll('input[name="energyType"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            energyType = e.target.value || 'electricidad';
            if (energyType === 'gas') {
                currentTariffType = 'GAS';
                loadGasTariffs();
            } else if (currentTariffType === 'GAS') {
                currentTariffType = '2.0TD';
            }
            toggleEnergyUI();
        });
    });
}

function bindGasBandToggle() {
    const radios = document.querySelectorAll('input[name="gasTariffBand"]');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            gasTariffBand = e.target.value || 'RL2';
        });
    });
}

function toggleEnergyUI() {
    const isGas = energyType === 'gas';
    const electricSections = document.querySelectorAll('.electric-only');
    electricSections.forEach(section => {
        section.style.display = isGas ? 'none' : '';
    });

    const gasSections = document.querySelectorAll('.gas-only');
    gasSections.forEach(section => {
        section.style.display = isGas ? '' : 'none';
    });

    if (isGas) {
        currentTariffType = 'GAS';
        const consumoContainer = document.getElementById('consumoContainer');
        if (consumoContainer) consumoContainer.innerHTML = '<p class="helper-text">Para gas no se requiere desglose por periodos. Usa el CAE anual.</p>';
        const potenciaContainer = document.getElementById('potenciaContainer');
        if (potenciaContainer) potenciaContainer.innerHTML = '<p class="helper-text">Potencia no aplica en gas.</p>';
    } else {
        if (currentTariffType === 'GAS') currentTariffType = '2.0TD';
        updateConsumptionInputs();
        updatePotenciaInputs();
    }
}




function filterBySupplier() {
    const selectElement = document.getElementById('supplierFilter');
    selectedSupplier = selectElement ? selectElement.value : 'all';
    const allResults = allResultsCache && allResultsCache.length ? allResultsCache : [];
    if (allResults.length === 0) {
        lastResults = [];
        displayResults();
        return;
    }
    if (selectedSupplier !== 'all') {
        lastResults = allResults.filter(result => result.supplier === selectedSupplier);
    } else {
        lastResults = allResults;
    }
    displayResults();
}

function resetSupplierFilter() {
    selectedSupplier = 'all';
    const selectElement = document.getElementById('supplierFilter');
    if (selectElement) {
        selectElement.value = 'all';
    }
    lastResults = allResultsCache && allResultsCache.length ? allResultsCache : [];
    displayResults();
}

function populateSupplierFilter(allResultsSource) {

    const selectElement = document.getElementById('supplierFilter');

    if (!selectElement) return;

    

    // Usar lastFormData para recalcular TODOS los resultados disponibles

    let allPossibleResults = [];

    if (allResultsSource && allResultsSource.length > 0) {

        allPossibleResults = allResultsSource;

    } else if (allResultsCache && allResultsCache.length > 0) {

        allPossibleResults = allResultsCache;

    } else if (lastResults && lastResults.length > 0) {

        allPossibleResults = lastResults;

    }

    

    // Obtener comercializadoras únicas

    const suppliers = [...new Set(allPossibleResults.map(r => r.supplier))].sort();

    

    // Guardar la selección actual

    const currentValue = selectElement.value || 'all';

    

    // Limpiar opciones

    selectElement.innerHTML = '<option value="all">Todas</option>';

    

    // Agregar opciones de comercializadoras

    suppliers.forEach(supplier => {

        const option = document.createElement('option');

        option.value = supplier;

        option.textContent = supplier;

        selectElement.appendChild(option);

    });

    

    // Restaurar la selección si existe

    if (suppliers.includes(currentValue) || currentValue === 'all') {

        selectElement.value = currentValue;

    }

}



function setupFormListeners() {

    const form = document.getElementById('comparadorForm');

    const tariffRadios = document.querySelectorAll('input[name="tariffType"]');



    tariffRadios.forEach(radio => {

        radio.addEventListener('change', (e) => {

            currentTariffType = e.target.value;

            updateConsumptionInputs();

            updatePotenciaInputs();

        });

    });



    form.addEventListener('submit', handleFormSubmit);

}



function updateConsumptionInputs() {

    const container = document.getElementById('consumoContainer');

    const periods = currentTariffType === "2.0TD" ? ["P1", "P2", "P3"] : ["P1", "P2", "P3", "P4", "P5", "P6"];



    container.innerHTML = periods.map(p => `

        <div class="form-group">

            <label>P${p.slice(1)}</label>

            <input type="number" id="consumption${p}" placeholder="0" step="0.001" min="0" required>

        </div>

    `).join('');

}



function updatePotenciaInputs() {

    const container = document.getElementById('potenciaContainer');

    const periods = currentTariffType === "2.0TD" ? ["P1", "P2"] : ["P1", "P2", "P3", "P4", "P5", "P6"];



    container.innerHTML = periods.map(p => `

        <div class="form-group">

            <label>P${p.slice(1)}</label>

            <input type="number" id="potencia${p}" placeholder="0" step="0.001" min="0" required>

        </div>

    `).join('');

}



function validateForm() {

    const clientName = document.getElementById('clientName').value.trim();

    const currentBill = parseFloat(document.getElementById('currentBill').value);

    const billingDays = parseInt(document.getElementById('billingDays').value);

    const cae = parseFloat(document.getElementById('cae').value);


    const errors = {};
    const isGas = energyType === 'gas';


    if (!clientName || clientName.length < 3) errors.clientName = 'Minimo 3 caracteres';
    if (isNaN(currentBill) || currentBill <= 0) errors.currentBill = 'Debe ser > 0';
    if (isNaN(billingDays) || billingDays < 1) errors.billingDays = 'Debe ser ≥ 1';
    if (isNaN(cae) || cae <= 0) errors.cae = 'CAE requerido';
    if (isGas) {
        const gasMonthly = parseFloat(document.getElementById('gasMonthlyConsumption')?.value || 0);
        const gasFixed = parseFloat(document.getElementById('gasFixedDaily')?.value || '');
        if (isNaN(gasMonthly) || gasMonthly <= 0) errors['gasMonthlyConsumption'] = 'Requerido';
        if (!isNaN(gasFixed) && gasFixed < 0) errors['gasFixedDaily'] = 'Requerido';
        const gasVariable = parseFloat(document.getElementById('gasVariableKwh')?.value || '');
        if (!isNaN(gasVariable) && gasVariable < 0) errors['gasVariableKwh'] = 'Requerido';
    }

    if (!isGas) {
        const isTwoPoint = currentTariffType === "2.0TD";
        const periods_consumo = isTwoPoint ? ["P1", "P2", "P3"] : ["P1", "P2", "P3", "P4", "P5", "P6"];
        periods_consumo.forEach(p => {
            const raw = document.getElementById(`consumption${p}`).value;
            if (raw === '' || raw === null || typeof raw === 'undefined') {
                document.getElementById(`consumption${p}`).value = 0;
                return;
            }
            const value = parseFloat(raw);
            if (isNaN(value) || value < 0) errors[`consumption${p}`] = 'Requerido';
        });

        const periods_potencia = isTwoPoint ? ["P1", "P2"] : ["P1", "P2", "P3", "P4", "P5", "P6"];
        periods_potencia.forEach(p => {
            const value = parseFloat(document.getElementById(`potencia${p}`).value);
            const mustBePositive = currentTariffType === "3.0TD";
            if (isNaN(value) || (mustBePositive ? value <= 0 : value < 0)) {
                errors[`potencia${p}`] = 'Requerido';
            }
        });

        const firstPotencia = parseFloat(document.getElementById('potencia' + periods_potencia[0]).value);
        if (currentTariffType === "2.0TD" && firstPotencia > MAX_POWER_2TD) errors['potencia-error'] = 'Max 15 kW';
        if (currentTariffType === "3.0TD") {
            const p6Value = parseFloat(document.getElementById('potenciaP6').value) || 0;
            if (p6Value <= MIN_POWER_3TD) {
                errors['potencia-error'] = 'P6 debe ser > 15 kW';
            }
        }
    }

    document.querySelectorAll('.error').forEach(msg => { msg.classList.remove('show'); msg.textContent = ''; });
    Object.keys(errors).forEach(field => {
        const el = document.getElementById(`${field}-error`);
        if (el) { el.textContent = errors[field]; el.classList.add("show"); }
    });

    return Object.keys(errors).length === 0;

}



function getComision(supplier, productName, totalConsumoAnual, potenciaP1, tariffType) {

    console.log(`🔍 getComision llamado:`, { supplier, productName, totalConsumoAnual, potenciaP1, tariffType });

    

    if (!COMISIONES_DATA || !COMISIONES_DATA[supplier]) {

        console.log(`❌ No hay datos de comisiones para ${supplier}`);

        return 0;

    }

    const supplierComisiones = COMISIONES_DATA[supplier];

    console.log(`📊 Estructura de comisiones para ${supplier}:`, supplierComisiones);



    // Buscar en tarifas si existe

    if (supplierComisiones.tarifas && tariffType) {

        const tarifaComisiones = supplierComisiones.tarifas[tariffType];

        console.log(`📋 Tarifas para ${tariffType}:`, tarifaComisiones);

        if (tarifaComisiones && tarifaComisiones[productName]) {

            const productoConfig = tarifaComisiones[productName];

            console.log(`✅ Configuración del producto "${productName}":`, productoConfig);

            if (productoConfig.tipo === 'fija') {

                return productoConfig.comision || 0;

            } else if (productoConfig.tipo === 'formula' && productoConfig.criterio === 'consumo_formula') {

                if (totalConsumoAnual <= productoConfig.limite_consumo) {

                    return productoConfig.base;

                } else {

                    return productoConfig.base + (totalConsumoAnual / 1000) * productoConfig.factor;

                }

            } else if (productoConfig.tipo === 'variable' && productoConfig.bloques) {

                const criterio = productoConfig.criterio || 'consumo';

                if (criterio === 'potencia_consumo') {

                    const bloquePotencia = productoConfig.bloques.find(bloque => {

                        const desde = (bloque.desde !== undefined && bloque.desde !== null) ? bloque.desde : 0;

                        const hasta = (bloque.hasta !== undefined && bloque.hasta !== null) ? bloque.hasta : Infinity;

                        return potenciaP1 >= desde && potenciaP1 <= hasta;

                    });

                    if (bloquePotencia && bloquePotencia.bloques_consumo) {

                        // Aquí pasamos el CAE (totalConsumoAnual) para los bloques de consumo

                        return getComisionPorBloque(bloquePotencia.bloques_consumo, totalConsumoAnual);

                    }

                    return 0;

                }

                const valor = criterio === 'potencia' ? potenciaP1 : totalConsumoAnual;

                return getComisionPorBloque(productoConfig.bloques, valor);

            }

        }

    }



    // Buscar en productos si existe

    if (supplierComisiones.productos && supplierComisiones.productos[productName]) {

        const productoConfig = supplierComisiones.productos[productName];

        if (typeof productoConfig === 'object' && productoConfig.tipo) {

            if (productoConfig.tipo === 'fija') {

                return productoConfig.comision || 0;

            } else if (productoConfig.tipo === 'formula' && productoConfig.criterio === 'consumo_formula') {

                if (totalConsumoAnual <= productoConfig.limite_consumo) {

                    return productoConfig.base;

                } else {

                    return productoConfig.base + (totalConsumoAnual / 1000) * productoConfig.factor;

                }

            } else if (productoConfig.tipo === 'variable' && productoConfig.bloques) {

                const criterio = productoConfig.criterio || 'consumo';

                if (criterio === 'potencia_consumo') {

                    const bloquePotencia = productoConfig.bloques.find(bloque => {

                        const desde = bloque.desde || 0;

                        const hasta = bloque.hasta;

                        return potenciaP1 >= desde && (hasta === null || potenciaP1 <= hasta);

                    });

                    if (bloquePotencia && bloquePotencia.bloques_consumo) {

                        return getComisionPorBloque(bloquePotencia.bloques_consumo, totalConsumoAnual);

                    }

                    return 0;

                }

                const valor = criterio === 'potencia' ? potenciaP1 : totalConsumoAnual;

                return getComisionPorBloque(productoConfig.bloques, valor);

            }

        } else if (typeof productoConfig === 'number') {

            return productoConfig;

        }

    }



    // Usar configuración default de la comercializadora

    if (supplierComisiones.tipo === 'fija') {

        return supplierComisiones.default || 0;

    } else if (supplierComisiones.tipo === 'variable' && supplierComisiones.bloques) {

        const criterio = supplierComisiones.criterio || 'consumo';

        const valor = criterio === 'potencia' ? potenciaP1 : totalConsumoAnual;

        return getComisionPorBloque(supplierComisiones.bloques, valor);

    }

    return 0;

}



function getComisionPorBloque(bloques, valor) {

    console.log(`🔢 getComisionPorBloque llamado con valor: ${valor}, bloques:`, bloques);

    for (const bloque of bloques) {

        const desde = (bloque.desde !== undefined && bloque.desde !== null) ? bloque.desde : 0;

        const hasta = (bloque.hasta !== undefined && bloque.hasta !== null) ? bloque.hasta : Infinity;



        console.log(`  Evaluando bloque [${desde}, ${hasta}]: ${valor} >= ${desde} && ${valor} <= ${hasta} = ${valor >= desde && valor <= hasta}`);



        if (valor >= desde && valor <= hasta) {

            if (typeof bloque.comision !== 'undefined') {

                console.log(`  ✅ Bloque encontrado! Comisión: ${bloque.comision}`);

                return bloque.comision || 0;

            }

            // Si el bloque tiene sub-bloques (bloques_consumo), buscar ahí

            if (bloque.bloques_consumo) {

                return getComisionPorBloque(bloque.bloques_consumo, valor);

            }

        }

    }

    // Si no encuentra bloque, devolver el último (para valores muy altos)

    return bloques[bloques.length - 1].comision || 0;

}



function getComisionPersonalizada(supplier, ...args) {

    const base = getComision(supplier, ...args);
    const porcentaje = getSupplierPercent(supplier);
    if (porcentaje === 0) return 0;
    return base * porcentaje;

}



function calculateComparison(formData) {

    const results = [];

    if (formData.energyType === 'gas') {
        return calculateGasResult(formData);
    }

    const typeBlock = TARIFFS_DATA[formData.tariffType] || {};

    const consumoAnual = parseFloat(formData.cae) || 0;

    const potenciaValues = Object.keys(formData)

        .filter(k => k.startsWith('potencia'))

        .map(k => parseFloat(formData[k]) || 0);

    const maxPotencia = Math.max(...potenciaValues, 0);

    for (const supplier of Object.keys(typeBlock)) {

        // Solo mostrar comercializadoras permitidas
        const porcentaje = getSupplierPercent(supplier);
        if (PORCENTAJES_COMERCIAL && porcentaje === 0) continue;

        const supplierData = typeBlock[supplier] || {};

        const productos = supplierData.productos;

        if (Array.isArray(productos)) {

            productos.forEach(prod => {
                if (PORCENTAJES_COMERCIAL && getSupplierPercent(supplier) === 0) return;

                const consumo = prod.periodosConsumo || prod.consumo;

                const potencia = prod.periodosPotencia || prod.potencia;

                if (!consumo || !potencia) return;
                if (PORCENTAJES_COMERCIAL && porcentaje === 0) return;

                // FILTRO REPSOL L0/L2/L4/L8: solo ocultar si maxPotencia <= 10

                if (

                    supplier === 'REPSOL' &&

                    /L(0|2|4|8)$/.test((prod.nombre || prod.name || '')) &&

                    maxPotencia <= 10

                ) {

                    return; // Ocultar solo si la potencia es menor o igual a 10kW

                }

                // Obtener potenciaP1 correctamente para 2.0TD y 3.0TD

                let potenciaP1 = 0;

                if (potencia && typeof potencia === 'object' && potencia.P1 !== undefined) {

                    potenciaP1 = parseFloat(potencia.P1) || 0;

                } else if (typeof potencia === 'number') {

                    potenciaP1 = potencia;

                }

                const calc = calculateBill(formData, { consumo, potencia });

                const comision = getComisionPersonalizada(supplier, prod.nombre || prod.name || 'Producto', consumoAnual, maxPotencia, formData.tariffType);

                results.push({

                    supplier,

                    productName: prod.nombre || prod.name || 'Producto',

                    pricingConsumo: consumo,

                    pricingPotencia: potencia,

                    comision: comision,

                    comisionAmount: comision, // Ahora es directamente en euros

                    ...calc

                });

            });

        } else if (productos && typeof productos === 'object') {

            for (const productName of Object.keys(productos)) {

                const item = productos[productName];
                if (PORCENTAJES_COMERCIAL && getSupplierPercent(supplier) === 0) continue;

                const consumo = item.consumo || item.periodosConsumo;

                const potencia = item.potencia || item.periodosPotencia;

                if (!consumo || !potencia) continue;
                if (PORCENTAJES_COMERCIAL && porcentaje === 0) continue;

                // FILTRO REPSOL L0/L2/L4/L8

                if (

                    supplier === 'REPSOL' &&

                    /L(0|2|4|8)$/.test(productName) &&

                    maxPotencia <= 10

                ) {

                    continue; // Saltar si ninguna potencia > 10kW

                }

                const calc = calculateBill(formData, { consumo, potencia });

                const comision = getComisionPersonalizada(supplier, productName, consumoAnual, maxPotencia, formData.tariffType);

                results.push({ 

                    supplier, 

                    productName, 

                    pricingConsumo: consumo, 

                    pricingPotencia: potencia, 

                    comision: comision,

                    comisionAmount: comision, // Ahora es directamente en euros

                    ...calc 

                });

            }

        }

    }

    

    // Ordenar según el modo seleccionado

    if (sortMode === 'commission') {

        // Ordenar por comisión (mayor comisión primero), luego por ahorro

        results.sort((a, b) => {

            const diffComision = b.comisionAmount - a.comisionAmount;

            if (Math.abs(diffComision) > 0.01) return diffComision;

            return b.savings - a.savings;

        });

    } else {

        // Ordenar por ahorro (default)

        results.sort((a, b) => b.savings - a.savings);

    }

    

    return results;

}

function calculateGasResult(formData) {
    const band = formData.gasTariffBand || 'RL2';
    const tariffSource = GAS_TARIFFS_DATA || GAS_TARIFFS;
    // Candidatos: tarifa cuyo band sea igual o empiece por band (para variantes)
    const candidates = Object.entries(tariffSource)
        .filter(([key]) => key === band || key.startsWith(band + '_') || key.startsWith(band + '-') || key.startsWith(band + '.'))
        .map(([, t]) => t);
    const tariffs = candidates.length ? candidates : [tariffSource[band] || tariffSource.RL2];
    const billingDays = parseInt(formData.billingDays) || 30;
    const consumoMensual = parseFloat(formData.gasMonthlyConsumption) || 0;
    const consumoPeriodo = consumoMensual; // kWh en el periodo (mensual estimado)

    const equipmentRental = parseFloat(formData.equipmentRental || 0);
    const otherCosts = parseFloat(formData.otherCosts || 0);

    const currentBill = parseFloat(formData.currentBill) || 0;
    const results = [];

    tariffs.forEach(tariff => {
        if (!tariff) return;
        const supplierName = tariff.supplier || 'Gas';
        const porcentajeSupplier = getSupplierPercent(supplierName);
        if (PORCENTAJES_COMERCIAL && porcentajeSupplier === 0) return;
        const fixedDaily = tariff.fixedDaily || 0; // usar siempre el fijo de la tarifa propuesta
        const fixedCost = billingDays * (fixedDaily || 0);
        const variablePrice = tariff.variableKwh || 0;
        const variableCost = consumoPeriodo * variablePrice;

        const subtotal = fixedCost + variableCost + equipmentRental + otherCosts;
        const taxes = getGasTaxes(formData.region || 'PENINSULA', consumoPeriodo, variableCost);
        const gasTax = taxes.gasTax || 0; // Gas tax segun region
        const taxableBase = subtotal + gasTax;
        const vat = taxableBase * (taxes.vat || 0);
        const total = taxableBase + vat;
        const electricityTax = gasTax;

        const savings = currentBill - total;
        const dailySavings = billingDays ? savings / billingDays : 0;
        const annualSavings = dailySavings * 365;

        // Comisión personalizada usando el mismo esquema general de comisiones
        const productName = tariff.name || `Tarifa ${band}`;
        const consumoAnualEstimado = parseFloat(formData.cae) || (consumoMensual * 12);
        const comision = getComisionPersonalizada(supplierName, productName, consumoAnualEstimado, 0, 'GAS');

        results.push({
            supplier: supplierName,
            productName,
            tariffType: band,
            gasBand: band,
            energyCost: variableCost,
            powerCost: fixedCost,
            discounts: { energy: 0, power: 0 },
            extras: { reactiveEnergy: 0, excessPower: 0 },
            equipmentRental,
            otherCosts,
            fixedDaily,
            variableKwh: variablePrice,
            electricityTax,
            taxableBase,
            vat,
            subtotal,
            total,
            savings,
            savingsPercent: currentBill ? (savings / currentBill) * 100 : 0,
            monthlySavings: savings,
            annualSavings,
            comision,
            comisionAmount: comision
        });
    });

    // Ordenar por ahorro descendente
    return results.sort((a, b) => (b.savings || 0) - (a.savings || 0));
}



function calculateBill(formData, tariff) {

    const periods_consumo = currentTariffType === "2.0TD" ? ["P1", "P2", "P3"] : ["P1", "P2", "P3", "P4", "P5", "P6"];

    const periods_potencia = currentTariffType === "2.0TD" ? ["P1", "P2"] : ["P1", "P2", "P3", "P4", "P5", "P6"];

    const potValues = periods_potencia.map(p => parseFloat(formData[`potencia${p}`]) || 0);
    const maxPotencia = Math.max(...potValues, 0);



    let energyCostRaw = 0;

    periods_consumo.forEach(p => {

        const consumption = parseFloat(formData[`consumption${p}`] || 0);

        const price = tariff.consumo[p];

        if (price) energyCostRaw += consumption * price;

    });


    const energyCost = roundToCents(energyCostRaw);



    let powerCostRaw = 0;

    periods_potencia.forEach(p => {

        const power = parseFloat(formData[`potencia${p}`] || 0);

        const pricePerDay = tariff.potencia[p];

        if (pricePerDay) powerCostRaw += power * pricePerDay * parseInt(formData.billingDays);

    });

    const powerCost = roundToCents(powerCostRaw);



    const discountEnergy = Math.max(0, parseFloat(formData.discountEnergy || 0));

    const discountPower = Math.max(0, parseFloat(formData.discountPower || 0));

    const reactiveEnergy = Math.max(0, parseFloat(formData.reactiveEnergy || 0));

    const excessPower = Math.max(0, parseFloat(formData.excessPower || 0));

    const equipmentRental = parseFloat(formData.equipmentRental || 0);
    const otherCosts = parseFloat(formData.otherCosts || 0);

    // Subtotal antes de impuestos (incluye alquiler y otros conceptos)
    const subtotal = roundToCents(
        energyCost - discountEnergy +
        powerCost - discountPower +
        reactiveEnergy +
        excessPower +
        equipmentRental +
        otherCosts
    );

    const taxes = getTaxRates(formData.region || 'PENINSULA', maxPotencia);
    const electricityTax = subtotal * taxes.electricityTax;
    const taxableBase = subtotal + electricityTax;
    const vatAmount = taxableBase * taxes.vat;
    const total = taxableBase + vatAmount;

    const savings = parseFloat(formData.currentBill) - total;

    

    // Ahorro anual: (ahorro de la factura / días de factura) * 365

    const billingDays = parseInt(formData.billingDays) || 30;

    const dailySavings = savings / billingDays;

    const annualSavings = dailySavings * 365;



    return {
        energyCost,

        powerCost,

        discounts: { energy: discountEnergy, power: discountPower },

        extras: { reactiveEnergy, excessPower },

        equipmentRental,

        otherCosts,

        electricityTax,

        vat: vatAmount,

        subtotal,

        taxableBase,

        total,

        savings,

        savingsPercent: (savings / parseFloat(formData.currentBill)) * 100,

        monthlySavings: savings,

        annualSavings: annualSavings

    };

}



async function handleFormSubmit(e) {

    e.preventDefault();

    if (!validateForm()) return;

    // Evento GA4: Comparativa calculada
    if (typeof gtag === 'function') {
        const tarifa = energyType === 'gas' ? 'GAS' : currentTariffType;
        const clientName = document.getElementById('clientName')?.value || '';
        const region = document.querySelector('input[name="region"]:checked')?.value || 'PENINSULA';
        const factura = document.getElementById('currentBill')?.value || '0';
        gtag('event', 'comparativa_calculada', {
            comercial_code: CODIGO_COMERCIAL ? CODIGO_COMERCIAL.toUpperCase() : 'DESCONOCIDO',
            tipo_energia: energyType,
            tipo_tarifa: tarifa,
            region: region,
            importe_factura: factura,
            event_category: 'comparativas',
            event_label: `${energyType}-${tarifa}`
        });
    }


    document.getElementById('loadingSpinner').style.display = 'block';

    document.getElementById('resultsContent').style.display = 'none';

    document.getElementById('resultsOverlay').style.display = 'block';

    // Cerrar el modal inmediatamente para que los resultados tengan la pantalla completa

    closeFormModal();



    await new Promise(resolve => setTimeout(resolve, 500));



    const codigo = CODIGO_COMERCIAL;

    if (!codigo) {

        alert('Introduce tu cdigo comercial antes de calcular.');

        document.getElementById('loadingSpinner').style.display = 'none';

        document.getElementById('resultsOverlay').style.display = 'none';

        openCodigoComercialModal();

        return;

    }



    lastFormData = { ...getFormData(), codigoComercial: codigo, sortMode };



    if (energyType === 'gas') {
        const gasResults = calculateGasResult(lastFormData);
        const positiveResults = gasResults.filter(r => r.savings > 0);
        const finalResults = positiveResults;
        allResultsCache = finalResults;
        lastResults = finalResults;
        selectedResult = finalResults.length ? finalResults[0] : null;
        displayResults();
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('resultsContent').style.display = 'block';
        return;
    }



    try {

        const res = await fetch('/api/calcular', {

            method: 'POST',

            headers: { 'Content-Type': 'application/json' },

            body: JSON.stringify(lastFormData)

        });

        if (!res.ok) {

            const err = await res.json().catch(() => ({}));

            throw new Error(err.error || 'No se pudo calcular');

        }

        const data = await res.json();

        const normalizedResults = applyRegionalTaxes(data.results || [], lastFormData);

        // Filtro por región y por comercializadoras permitidas para el código actual
        const regionFiltered = filterResultsByRegion(normalizedResults, lastFormData.region)
            .filter(r => getSupplierPercent(r.supplier) !== 0);

        allResultsCache = regionFiltered;

        // Aplicar filtro actual si hay uno

        if (selectedSupplier && selectedSupplier !== 'all') {

            lastResults = allResultsCache.filter(r => r.supplier === selectedSupplier);

        } else {

            lastResults = allResultsCache;

        }

        displayResults();

    } catch (err) {

        alert(err.message || 'Error al calcular');

        console.error(err);

    }



    document.getElementById('loadingSpinner').style.display = 'none';

    document.getElementById('resultsContent').style.display = 'block';

}

function openCodigoComercialModal() {

    const modal = document.getElementById('codigoComercialModal');

    // Use class toggle to control visibility so CSS !important rules work predictably
    modal.classList.add('is-visible');
    // clear any inline display to defer to CSS class rules
    modal.style.display = '';

    // Bloquear scroll del fondo mientras el modal está abierto

    document.body.style.overflow = 'hidden';
    // mark body so CSS can show the modal via author styles with !important
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');

    document.getElementById('codigoComercialInput').value = '';

    document.getElementById('codigoComercialError').textContent = '';

    document.getElementById('codigoComercialInput').focus();

}



function closeCodigoComercialModal() {

    const modal = document.getElementById('codigoComercialModal');
    // Remove visibility class and mark body as closed
    modal.classList.remove('is-visible');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');

}

function resetComparadorForm() {

    const form = document.getElementById('comparadorForm');

    if (!form) return;

    form.reset();

    form.querySelectorAll('input[type="text"],input[type="number"],input[type="email"],input[type="tel"]').forEach(el => {

        el.value = '';

    });

    const checkedTariff = document.querySelector('input[name="tariffType"]:checked');
    if (checkedTariff) {
        currentTariffType = checkedTariff.value;
        updateConsumptionInputs();
        updatePotenciaInputs();
    }

    lastFormData = {};

}



function openFormModal() {

    loadSavedCodigoComercial();

    if (!CODIGO_COMERCIAL) {
        openCodigoComercialModal();
        return;
    }

    if (Object.keys(lastFormData || {}).length) {
        setFormValuesFromData(lastFormData);
    }

    document.getElementById('formModal').style.display = 'block';
    document.body.style.overflow = 'hidden';

}



async function handleCodigoComercialSubmit(e) {

    e.preventDefault();

    const code = document.getElementById('codigoComercialInput').value.trim();

    const errorEl = document.getElementById('codigoComercialError');

    if (!code) {

        errorEl.textContent = 'Código requerido.';

        errorEl.style.display = 'block';

        document.getElementById('codigoComercialInput').focus();

        return;

    }

    errorEl.textContent = '';

    CODIGO_COMERCIAL = code;

    setPorcentajesFromCodigo(code);

    // Evento GA4: Login de comercial
    if (typeof gtag === 'function') {
        const upper = code.toUpperCase();
        gtag('config', 'G-GDZL3F61E2', { user_id: upper });
        gtag('set', { user_properties: { comercial_code: upper } });
        gtag('event', 'login_comercial', {
            comercial_code: upper,
            event_category: 'comerciales',
            event_label: upper
        });
    }
    // No guardar en sessionStorage para pedir c�digo en cada comparativa

    closeCodigoComercialModal();

    // Ahora sí mostrar el formulario

    document.getElementById('formModal').style.display = 'block';

}



function updateLandingStats() {

    try {

        if (!TARIFFS_DATA) return;

        const types = Object.keys(TARIFFS_DATA);

        const suppliersSet = new Set();

        let totalProducts = 0;

        types.forEach(t => {

            const suppliers = Object.keys(TARIFFS_DATA[t] || {});

            suppliers.forEach(s => {

                suppliersSet.add(s);

                const productos = (TARIFFS_DATA[t][s] || {}).productos;

                if (Array.isArray(productos)) totalProducts += productos.length;

                else if (productos && typeof productos === 'object') totalProducts += Object.keys(productos).length;

            });

        });

        const suppliers = Array.from(suppliersSet).sort();

        // statTarifas is now static "300+" in HTML

        const statCom = document.getElementById('statComercializadoras');

        const statComList = document.getElementById('statComercializadorasList');

        if (statCom) statCom.textContent = suppliers.length.toString();

        if (statComList) statComList.textContent = suppliers.slice(0, 6).join(' ? ') + (suppliers.length > 6 ? ' ? ?' : '');

        const statTop = document.getElementById('statTop');

        if (statTop) statTop.textContent = INITIAL_RESULTS.toString();

    } catch (e) {

        console.warn('No se pudieron actualizar estadísticas de landing:', e);

    }

}



function getFormData() {

    const isGas = energyType === 'gas';
    const periods_consumo = isGas ? [] : currentTariffType === "2.0TD" ? ["P1", "P2", "P3"] : ["P1", "P2", "P3", "P4", "P5", "P6"];

    const periods_potencia = isGas ? [] : currentTariffType === "2.0TD" ? ["P1", "P2"] : ["P1", "P2", "P3", "P4", "P5", "P6"];

    const regionInput = document.querySelector('input[name="region"]:checked');
    const data = {

        tariffType: currentTariffType,
        energyType,
        gasTariffBand,
        gasMonthlyConsumption: document.getElementById('gasMonthlyConsumption') ? document.getElementById('gasMonthlyConsumption').value : 0,
        gasFixedDaily: document.getElementById('gasFixedDaily') ? document.getElementById('gasFixedDaily').value : 0,
        gasVariableKwh: document.getElementById('gasVariableKwh') ? document.getElementById('gasVariableKwh').value : 0,

        region: regionInput ? regionInput.value : 'PENINSULA',

        clientName: document.getElementById('clientName').value,

        address: document.getElementById('address').value,

        cups: document.getElementById('cups').value,

        billingDays: document.getElementById('billingDays').value,

        currentBill: document.getElementById('currentBill').value,

        cae: document.getElementById('cae').value,

        equipmentRental: document.getElementById('equipmentRental').value,

        otherCosts: document.getElementById('otherCosts').value,

        discountEnergy: document.getElementById('discountEnergy') ? document.getElementById('discountEnergy').value : 0,

        discountPower: document.getElementById('discountPower') ? document.getElementById('discountPower').value : 0,

        reactiveEnergy: document.getElementById('reactiveEnergy') ? document.getElementById('reactiveEnergy').value : 0,

        excessPower: document.getElementById('excessPower') ? document.getElementById('excessPower').value : 0,

        socialBonus: document.getElementById('socialBonus') ? document.getElementById('socialBonus').value : 0

    };



    periods_consumo.forEach(p => {

        const el = document.getElementById(`consumption${p}`);
        data[`consumption${p}`] = el ? el.value : 0;

    });

    periods_potencia.forEach(p => {

        const el = document.getElementById(`potencia${p}`);
        data[`potencia${p}`] = el ? el.value : 0;

    });



    return data;

}

function setFormValuesFromData(data) {
    if (!data) return;

    const energy = data.energyType || energyType || 'electricidad';
    const energyRadio = document.querySelector(`input[name="energyType"][value="${energy}"]`);
    if (energyRadio) energyRadio.checked = true;
    energyType = energy;

    const type = data.tariffType || currentTariffType || '2.0TD';
    const typeRadio = document.querySelector(`input[name="tariffType"][value="${type}"]`);
    if (typeRadio) typeRadio.checked = true;
    currentTariffType = type;

    const gasBand = data.gasTariffBand || gasTariffBand || 'RL2';
    const gasBandRadio = document.querySelector(`input[name="gasTariffBand"][value="${gasBand}"]`);
    if (gasBandRadio) gasBandRadio.checked = true;
    gasTariffBand = gasBand;
    const gasMonthly = document.getElementById('gasMonthlyConsumption');
    if (gasMonthly && data.gasMonthlyConsumption !== undefined) gasMonthly.value = data.gasMonthlyConsumption;

    updateConsumptionInputs();
    updatePotenciaInputs();
    toggleEnergyUI();

    const region = data.region || 'PENINSULA';
    const regionRadio = document.querySelector(`input[name="region"][value="${region}"]`);
    if (regionRadio) regionRadio.checked = true;

    const fields = ['clientName', 'address', 'cups', 'billingDays', 'currentBill', 'cae', 'equipmentRental', 'otherCosts', 'discountEnergy', 'discountPower', 'reactiveEnergy', 'excessPower', 'socialBonus', 'gasVariableKwh'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && data[id] !== undefined) el.value = data[id];
    });

    const periods_consumo = type === "2.0TD" ? ["P1", "P2", "P3"] : ["P1", "P2", "P3", "P4", "P5", "P6"];
    const periods_potencia = type === "2.0TD" ? ["P1", "P2"] : ["P1", "P2", "P3", "P4", "P5", "P6"];

    periods_consumo.forEach(p => {
        const el = document.getElementById(`consumption${p}`);
        if (el && data[`consumption${p}`] !== undefined) el.value = data[`consumption${p}`];
    });

    periods_potencia.forEach(p => {
        const el = document.getElementById(`potencia${p}`);
        if (el && data[`potencia${p}`] !== undefined) el.value = data[`potencia${p}`];
    });
}


function loadSavedCodigoComercial() {
    try {
        const raw = localStorage.getItem(CODIGO_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed.code) return null;
        if (parsed.savedAt && Date.now() - parsed.savedAt > CODIGO_TTL_MS) {
            localStorage.removeItem(CODIGO_STORAGE_KEY);
            return null;
        }
        CODIGO_COMERCIAL = parsed.code;
        return parsed.code;
    } catch (_) {
        return null;
    }
}

function persistCodigoComercial(code) {
    try {
        localStorage.setItem(CODIGO_STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() }));
    } catch (_) {}
}

function safeNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const normalized = typeof value === 'string' ? value.replace(/\s+/g, '').replace(',', '.') : value;
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : fallback;
}

function safeInteger(value, fallback = 0) {
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : fallback;
}

function setInvoiceStatus(message, type = 'info') {
    const el = document.getElementById('invoiceStatus');
    if (!el) return;
    el.textContent = message || '';
    const color = type === 'error' ? '#b91c1c' : type === 'success' ? '#15803d' : '#475569';
    el.style.color = color;
}

function setInvoiceProcessing(state) {
    invoiceProcessing = state;
    const btn = document.getElementById('invoiceReadBtn');
    const input = document.getElementById('invoiceFileInput');
    const bar = document.getElementById('invoiceWaitBar');
    const fill = bar ? bar.querySelector('.fill') : null;

    if (btn) {
        btn.disabled = state;
        btn.textContent = state ? 'Cargando factura…' : 'Leer factura';
    }
    if (input) input.disabled = state;

    if (bar && fill) {
        if (invoiceWaitBarResetTimeout) {
            clearTimeout(invoiceWaitBarResetTimeout);
            invoiceWaitBarResetTimeout = null;
        }

        if (state) {
            bar.style.opacity = '1';
            bar.classList.add('is-active');
            // Reinicia la barra y lanza una transición larga (~15s)
            fill.style.width = '0%';
            // Forzar reflow para que la transición se aplique correctamente
            void fill.offsetWidth;
            fill.style.width = '100%';
        } else {
            // Completa rápido y luego resetea de forma suave
            bar.classList.remove('is-active');
            fill.style.width = '100%';
            invoiceWaitBarResetTimeout = setTimeout(() => {
                if (invoiceProcessing) return;
                bar.style.opacity = '0.4';
                fill.style.width = '0%';
            }, 400);
        }
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result || '';
            const commaIdx = typeof result === 'string' ? result.indexOf(',') : -1;
            const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
            resolve({ base64, mimeType: file.type || 'application/pdf' });
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(file);
    });
}

function buildInvoicePrompt(fileName) {
    return [
        'Eres un extractor de datos de facturas de electricidad o gas en España.',
        'Lee SOLO las dos primeras páginas de la factura (ignora el resto). Devuelve SOLO un JSON con estos campos (usa 0 cuando no haya dato):',
        '{',
        ' "energyType": "electricidad|gas",',
        ' "tariffType": "2.0TD|3.0TD|6.1TD|GAS",',
        ' "region": "PENINSULA|BALEARES|CANARIAS|CEUTA_MELILLA",',
        ' "clientName": "", "address": "", "cups": "",',
        ' "billingDays": 0, "currentBill": 0, "cae": 0,',
        ' "consumption": {"P1":0,"P2":0,"P3":0,"P4":0,"P5":0,"P6":0},',
        ' "power": {"P1":0,"P2":0,"P3":0,"P4":0,"P5":0,"P6":0},',
        ' "equipmentRental": 0, "otherCosts": 0, "discountEnergy": 0, "discountPower": 0,',
        ' "reactiveEnergy": 0, "excessPower": 0, "socialBonus": 0,',
        ' "gasMonthlyConsumption": 0, "gasFixedDaily": 0, "gasVariableKwh": 0, "gasTariffBand": "RL1|RL2|RL3|RL4|RL5"',
        '}',
        'Electricidad:',
        ' - 2.0TD: rellena consumo P1-P3 y potencia P1-P2; deja P4-P6 en 0.',
        ' - 3.0TD y 6.1TD: rellena consumo y potencia P1-P6.',
        'Gas: rellena gasMonthlyConsumption (kWh del periodo), gasVariableKwh (€/kWh del término variable) y gasFixedDaily (€/día). Deja consumo/potencia en 0.',
        'Incluye billingDays, currentBill (TOTAL con impuestos e IVA), equipmentRental (alquiler de equipos/contador).',
        'CUPS: Si el CUPS parece terminar en "OF" (letra O + F), es un error. Debe ser "0F" (CERO + F).',
        'ENERGÍA REACTIVA: El campo reactiveEnergy debe contener SOLO el IMPORTE EN EUROS (€) por penalización de reactiva, NO la cantidad de kVArh. Busca el valor en euros asociado a "energía reactiva", "reactiva", "penalización reactiva" o "exceso de reactiva". Si solo ves kVArh sin importe en euros, pon 0.',
        'BONO SOCIAL: Busca SIEMPRE en la factura los conceptos "Financiación del bono social", "Fin. bono social", "Financiación bono social", "Bono social" o "Aportación bono social". Suele aparecer cerca del final del desglose, antes de impuestos. El valor típico es entre 0.01€ y 2€. Pon ese importe en socialBonus. NO lo incluyas en otherCosts.',
        'En otherCosts pon SOLO otros conceptos distintos de alquileres, impuestos, IVA, tasas, bono social o recargos regulados.',
        'No incluyas texto fuera del JSON.',
        `Archivo de referencia: ${fileName || 'factura'}.`
    ].join(' ');
}

function parseGeminiJson(text) {
    if (!text || typeof text !== 'string') throw new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (err) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        throw new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
    }
}

function formatPeriodPrices(pricing, unit) {
    if (!pricing || typeof pricing !== 'object') return '';
    const keys = Object.keys(pricing).filter(k => pricing[k] !== undefined && pricing[k] !== null);
    if (!keys.length) return '';
    return keys.map(k => `${k}: ${parseFloat(pricing[k]).toFixed(4)} ${unit}`).join(' · ');
}

async function callGeminiForInvoice({ base64, mimeType, fileName }) {
    if (!GEMINI_API_KEY) throw new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
    const body = {
        contents: [
            {
                parts: [
                    { text: buildInvoicePrompt(fileName) },
                    { inline_data: { mime_type: mimeType || 'application/pdf', data: base64 } }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
        }
    };
    const maxRetries = 3;
    const baseDelay = 1200;

    let lastErr = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
            const delay = baseDelay * attempt;
            await new Promise(r => setTimeout(r, delay));
        }

        const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            let msg = 'Error al procesar la factura';
            try {
                const err = await res.json();
                msg = err.error?.message || msg;
            } catch (_) { /* ignore */ }

            // Reintentar si el servicio está saturado o rate limited
            if (res.status === 429 || res.status === 503) {
                lastErr = new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
                continue;
            }
            throw new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
        }

        const json = await res.json();
        const textPart = (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts || [])
            .map(p => p.text)
            .find(Boolean);
        if (!textPart) throw new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
        return parseGeminiJson(textPart);
    }

    throw lastErr || new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
}

function normalizeInvoiceData(raw, currentEnergy = 'electricidad') {
    const out = {};
    const energyRaw = (raw.energyType || raw.tipoEnergia || '').toString().toLowerCase();
    const hasGasSignals = [
        energyRaw.includes('gas'),
        safeNumber(raw.gasMonthlyConsumption, 0) > 0,
        safeNumber(raw.gasVariableKwh, 0) > 0,
        safeNumber(raw.gasFixedDaily, 0) > 0,
        !!raw.gasTariffBand
    ].some(Boolean);
    const isGas = hasGasSignals ? true : (currentEnergy === 'gas');
    out.energyType = isGas ? 'gas' : 'electricidad';

    const tariffRaw = (raw.tariffType || raw.tarifa || '').toString().toUpperCase();
    if (ALLOWED_TARIFFS.includes(tariffRaw)) out.tariffType = tariffRaw;
    else out.tariffType = isGas ? 'GAS' : (ALLOWED_TARIFFS.includes(currentTariffType) ? currentTariffType : '2.0TD');

    const regionRaw = (raw.region || raw.zona || '').toString().toUpperCase();
    if (ALLOWED_REGIONS.includes(regionRaw)) {
        out.region = regionRaw === 'CEUTA' || regionRaw === 'MELILLA' ? 'CEUTA_MELILLA' : regionRaw;
    } else {
        out.region = 'PENINSULA';
    }

    out.clientName = raw.clientName || raw.nombre || '';
    out.address = raw.address || raw.direccion || '';
    out.cups = raw.cups || raw.cupsNumber || '';
    out.billingDays = safeInteger(raw.billingDays || raw.diasFacturacion || raw.dias, 30);
    out.currentBill = safeNumber(raw.currentBill || raw.totalFactura || raw.total || raw.factura, 0);
    out.cae = safeNumber(raw.cae || raw.consumoAnual || raw.consumoAnualEstimado || raw.annualConsumption, 0);
    out.equipmentRental = safeNumber(raw.equipmentRental || raw.alquilerEquipos || raw.rental || raw.alquiler, 0);
    out.otherCosts = safeNumber(raw.otherCosts || raw.otrosCostes || raw.otros, 0);
    out.discountEnergy = safeNumber(raw.discountEnergy || raw.descuentoConsumo, 0);
    out.discountPower = safeNumber(raw.discountPower || raw.descuentoPotencia, 0);
    out.reactiveEnergy = safeNumber(raw.reactiveEnergy || raw.energiaReactiva, 0);
    out.excessPower = safeNumber(raw.excessPower || raw.excesoPotencia, 0);
    out.socialBonus = safeNumber(
        raw.socialBonus ||
        raw.bonoSocial ||
        raw.bono ||
        raw.bono_social ||
        raw.financiacionBonoSocial ||
        raw.financiacion_bono_social ||
        raw.financiacion ||
        raw.financiacionBono,
        0
    );

    out.gasMonthlyConsumption = safeNumber(raw.gasMonthlyConsumption || raw.gasConsumption || raw.consumoGasMensual, 0);
    out.gasFixedDaily = safeNumber(raw.gasFixedDaily || raw.terminoFijoDiario || raw.gasFixed, 0);
    out.gasVariableKwh = safeNumber(raw.gasVariableKwh || raw.precioVariable || raw.terminoVariable || raw.terminoVariableKwh, 0);
    const gasBandRaw = (raw.gasTariffBand || raw.tarifaGas || '').toString().toUpperCase();
    if (['RL1', 'RL2', 'RL3', 'RL4', 'RL5'].includes(gasBandRaw)) {
        out.gasTariffBand = gasBandRaw;
    } else {
        out.gasTariffBand = gasTariffBand;
    }

    const consumption = raw.consumption || raw.consumo || raw.energy || {};
    const periodsConsumo = out.tariffType === '2.0TD' ? ['P1', 'P2', 'P3'] : out.tariffType === 'GAS' ? [] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    periodsConsumo.forEach((p, idx) => {
        const val = consumption[p] ?? consumption[`P${idx + 1}`] ?? (Array.isArray(consumption) ? consumption[idx] : undefined) ?? consumption[p.toLowerCase()];
        out[`consumption${p}`] = safeNumber(val, 0);
    });

    const power = raw.power || raw.potencia || raw.powerByPeriod || {};
    const periodsPotencia = out.tariffType === '2.0TD' ? ['P1', 'P2'] : out.tariffType === 'GAS' ? [] : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    periodsPotencia.forEach((p, idx) => {
        const val = power[p] ?? power[`P${idx + 1}`] ?? (Array.isArray(power) ? power[idx] : undefined) ?? power[p.toLowerCase()];
        out[`potencia${p}`] = safeNumber(val, 0);
    });

    return out;
}

function applyExtractedInvoiceData(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('No se pudo leer la factura. Inténtalo de nuevo o rellena los datos manualmente.');
    const normalized = normalizeInvoiceData(raw, energyType);
    setFormValuesFromData(normalized);
    lastFormData = { ...lastFormData, ...getFormData() };
}

async function handleInvoiceUpload() {
    try {
        const input = document.getElementById('invoiceFileInput');
        if (!input || !input.files || !input.files.length) {
            setInvoiceStatus('Selecciona un archivo PDF o imagen.', 'error');
            return;
        }
        const file = input.files[0];
        if (!file) {
            setInvoiceStatus('Archivo no válido.', 'error');
            return;
        }

        setInvoiceProcessing(true);
        setInvoiceStatus('Cargando factura...', 'info');
        const { base64, mimeType } = await readFileAsBase64(file);
        setInvoiceStatus('Procesando factura en el servidor...', 'info');

        const response = await fetch('/api/extraer-factura', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, mimeType, base64 })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'No se pudo procesar la factura');
        }
        const data = await response.json();
        const extracted = data.extracted || data;
        applyExtractedInvoiceData(extracted);
        setInvoiceStatus('✅ Factura leída. ⚠️ Revisa los datos antes de calcular, la IA puede cometer errores.', 'success');
    } catch (err) {
        console.error('Error leyendo factura', err);
        setInvoiceStatus(err.message || 'No se pudo leer la factura', 'error');
    } finally {
        setInvoiceProcessing(false);
    }
}

function applyRegionalTaxes(results, formData) {
    const potKeys = Object.keys(formData || {}).filter(k => k.startsWith('potencia'));
    const maxPotencia = Math.max(...potKeys.map(k => parseFloat(formData[k]) || 0), 0);
    const taxes = getTaxRates((formData && formData.region) || 'PENINSULA', maxPotencia);
    const currentBill = parseFloat(formData?.currentBill || 0);
    const billingDays = parseInt(formData?.billingDays) || 30;

    return (results || []).map(r => {
        const electricityTax = r.electricityTax ?? 0;
        const taxableBase = (r.subtotal ?? 0) + electricityTax;
        const vat = taxableBase * taxes.vat;
        const total = taxableBase + vat;
        const savings = currentBill - total;
        const dailySavings = savings / billingDays;
        const annualSavings = dailySavings * 365;
        return {
            ...r,
            electricityTax,
            taxableBase,
            vat,
            total,
            savings,
            savingsPercent: currentBill ? (savings / currentBill) * 100 : 0,
            monthlySavings: savings,
            annualSavings
        };
    });
}

function filterResultsByRegion(results, region) {
    const reg = (region || 'PENINSULA').toUpperCase();
    const disallowed = {
        CANARIAS: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'LOCALUZ'],
        BALEARES: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'LOCALUZ'],
        CEUTA: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'POLARIS', 'LOCALUZ'],
        MELILLA: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'POLARIS', 'LOCALUZ'],
        CEUTA_MELILLA: ['GREENING ENERGY', 'GREENING', 'IGNIS', 'POLARIS', 'LOCALUZ']
    };
    const blocked = disallowed[reg] || [];
    return (results || []).filter(r => !blocked.includes((r.supplier || '').toUpperCase()));
}

// Función para calcular percentil de un array
function calculatePercentile(arr, percentile) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// Función para marcar tarifas estrella - Mejor equilibrio REAL entre ahorro y comisión
// Modifica los objetos directamente para mantener la referencia
function markStarTariffs(results) {
    if (!results || results.length === 0) return;
    
    // Limpiar marcas previas
    results.forEach(r => r.isStar = false);
    
    // Solo considerar tarifas con comisión > 0
    const withCommission = results.filter(r => r.comision && r.comision > 0 && r.savingsPercent > 0);
    if (withCommission.length < 3) return;
    
    // Calcular medianas para filtrar
    const savingsMedian = calculatePercentile(withCommission.map(r => r.savingsPercent), 50);
    const commissionMedian = calculatePercentile(withCommission.map(r => r.comision), 50);
    
    // Solo considerar tarifas que estén POR ENCIMA de la mediana en AMBOS criterios
    const candidates = withCommission.filter(r => 
        r.savingsPercent >= savingsMedian && r.comision >= commissionMedian
    );
    
    if (candidates.length === 0) return;
    
    // Encontrar máximos solo entre los candidatos para normalizar
    const maxSavings = Math.max(...candidates.map(r => r.savingsPercent));
    const maxCommission = Math.max(...candidates.map(r => r.comision));
    
    if (maxSavings === 0 || maxCommission === 0) return;
    
    // Calcular score combinado (promedio de ahorro y comisión normalizados)
    candidates.forEach(r => {
        const savingsNorm = r.savingsPercent / maxSavings;
        const commissionNorm = r.comision / maxCommission;
        r._starScore = (savingsNorm + commissionNorm) / 2;
    });
    
    // Ordenar por score y tomar solo la TOP 1
    const sorted = [...candidates].sort((a, b) => b._starScore - a._starScore);
    sorted[0].isStar = true;
    
    // Limpiar scores temporales
    candidates.forEach(r => delete r._starScore);
    
    const starCount = results.filter(r => r.isStar).length;
    console.log('Mediana ahorro:', savingsMedian.toFixed(1) + '%', 'Mediana comisión: €' + commissionMedian.toFixed(0));
    console.log('Candidatos equilibrados:', candidates.length, '- Estrellas:', starCount);
}

function displayResults() {

    const heading = document.getElementById('resultsHeading');

    const tbody = document.getElementById('resultsTableBody');

    const toggleBtn = document.getElementById('toggleMoreBtn');



    const withSavings = lastResults.filter(r => r.savings > 0);
    const baseList = withSavings.filter(r => isSupplierAllowed(r.supplier || ''));
    
    // Marcar tarifas estrella (modifica los objetos directamente)
    markStarTariffs(baseList);

    const sourceForFilter = (allResultsCache && allResultsCache.length) ? allResultsCache : baseList;
    const currency = '\u20AC';

    // Si no hay resultados (por ejemplo, filtro por comercializadora sin ofertas), mostrar mensaje y permitir volver a ver todas
    if (baseList.length === 0) {
        const isFiltered = selectedSupplier && selectedSupplier !== 'all';
        heading.textContent = isFiltered
            ? `0 ofertas para ${selectedSupplier}`
            : 'No hay ofertas con ahorro para estos datos';
        if (toggleBtn) {
            toggleBtn.style.display = 'none';
        }
        const resetBtnHtml = isFiltered
            ? `<button class="btn btn-outline pill" type="button" onclick="resetSupplierFilter()">Ver todas las comercializadoras</button>`
            : '';
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="8">
                    <div class="empty-state-message">
                        <p>${isFiltered ? 'Esta comercializadora no tiene ofertas con ahorro.' : 'No se encontraron ofertas con ahorro.'}</p>
                        ${resetBtnHtml}
                    </div>
                </td>
            </tr>`;
        populateSupplierFilter(sourceForFilter);
        selectedResult = null;
        document.getElementById('summarySelected').style.display = 'none';
        return;
    }

    // Ordenar: estrellas primero, luego el resto por ahorro
    const sortedList = [...baseList].sort((a, b) => {
        if (a.isStar && !b.isStar) return -1;
        if (!a.isStar && b.isStar) return 1;
        return 0; // Mantener orden original (por ahorro) entre no-estrellas
    });

    const toShow = showingAll ? sortedList : sortedList.slice(0, INITIAL_RESULTS);
    
    // Contar estrellas y mostrar/ocultar leyenda
    const starCount = toShow.filter(r => r.isStar).length;
    const starLegend = document.getElementById('starLegend');
    if (starLegend) {
        starLegend.style.display = starCount > 0 ? 'block' : 'none';
    }

    heading.textContent = showingAll ? `Ofertas con ahorro (${sortedList.length}) - Haz clic en una tarifa para ver el desglose` : `Top ${Math.min(INITIAL_RESULTS, sortedList.length)} Mejores Ofertas - Haz clic en una tarifa para ver el desglose`;

    if (toggleBtn) {
        toggleBtn.textContent = showingAll ? 'Ver menos' : 'Ver mas';

        toggleBtn.style.display = sortedList.length > INITIAL_RESULTS ? 'inline-block' : 'none';

        toggleBtn.classList.toggle('expanded', showingAll);

        toggleBtn.setAttribute('aria-expanded', showingAll ? 'true' : 'false');

        toggleBtn.setAttribute('aria-controls', 'resultsTableBody');
    }



    tbody.innerHTML = toShow.map((r, visualIndex) => {

        const idx = lastResults.indexOf(r) + 1;

        const actualIndex = lastResults.indexOf(r);

        const comisionDisplay = r.comision ? `${currency} ${r.comision.toFixed(2)}` : '—';

        const commissionClass = SHOW_COMMISSION ? '' : 'hidden-commission';
        
        const starBadge = r.isStar ? '<span class="star-badge" title="Tarifa Estrella: Buen ahorro + Buena comisión">⭐</span>' : '';
        const starClass = r.isStar ? 'star-tariff' : '';

        return `

        <tr onclick="selectTariff(${actualIndex})" data-result-index="${actualIndex}" class="${starClass}">

            <td class="rank" data-label="#">${idx}</td>

            <td data-label="Comercializadora">${starBadge}${r.supplier}</td>

            <td data-label="Producto">${r.productName}</td>

            <td data-label="Factura">${currency} ${r.total.toFixed(2)}</td>

            <td class="savings" data-label="Ahorro factura">${currency} ${r.monthlySavings.toFixed(2)}</td>

            <td class="savings" data-label="Ahorro/a\u00f1o">${currency} ${r.annualSavings.toFixed(2)}</td>

            <td class="percent" data-label="%">${r.savingsPercent.toFixed(1)}%</td>

            <td class="commission-col ${commissionClass}" data-label="Comisi\u00f3n">${comisionDisplay}</td>

        </tr>`;

    }).join('');

    

    // Poblar filtro de comercializadoras

    // Poblar filtro siempre con el set completo en cach? para no perder opciones

    populateSupplierFilter(sourceForFilter);



    if (toShow.length > 0) {

        selectTariff(lastResults.indexOf(toShow[0]));

    } else {

        selectedResult = null;

        document.getElementById('summarySelected').style.display = 'none';

    }

}

function toggleMore() {

    showingAll = !showingAll;

    displayResults();

    const btn = document.getElementById('toggleMoreBtn');

    if (btn) {

        btn.classList.toggle('expanded', showingAll);

        btn.setAttribute('aria-expanded', showingAll ? 'true' : 'false');

        btn.setAttribute('aria-label', showingAll ? 'Ver menos ofertas' : 'Ver mas ofertas');

    }

}



function toggleSortMode() {

    // Alternar entre 'savings' y 'commission'

    sortMode = sortMode === 'savings' ? 'commission' : 'savings';

    

    const btn = document.getElementById('sortToggleBtn');

    const label = document.getElementById('sortLabel');

    const iconMA = document.getElementById('sortIconMA');

    const iconMC = document.getElementById('sortIconMC');

    

    if (sortMode === 'savings') {

        // Modo MA (Mejor Ahorro)

        if (label) label.textContent = 'MA';

        if (iconMA) iconMA.style.display = '';

        if (iconMC) iconMC.style.display = 'none';

        if (btn) btn.setAttribute('title', 'Ordenar por Mejor Ahorro');

    } else {

        // Modo MC (Mejor Comisión)

        if (label) label.textContent = 'MC';

        if (iconMA) iconMA.style.display = 'none';

        if (iconMC) iconMC.style.display = '';

        if (btn) btn.setAttribute('title', 'Ordenar por Mejor Comisión');

    }

    

    // Reordenar y mostrar resultados actuales

    if (lastResults && lastResults.length > 0) {

        if (sortMode === 'commission') {

            lastResults = [...lastResults].sort((a, b) => {

                const diffComision = (b.comisionAmount || 0) - (a.comisionAmount || 0);

                if (Math.abs(diffComision) > 0.01) return diffComision;

                return (b.savings || 0) - (a.savings || 0);

            });

        } else {

            lastResults = [...lastResults].sort((a, b) => (b.savings || 0) - (a.savings || 0));

        }

        displayResults();

    }

}



function changeSortMode(mode) {

    sortMode = mode;

    

    // Actualizar botones

    const savingsBtn = document.getElementById('sortBySavings');

    const commissionBtn = document.getElementById('sortByCommission');

    

    if (savingsBtn && commissionBtn) {

        savingsBtn.classList.toggle('active', mode === 'savings');

        commissionBtn.classList.toggle('active', mode === 'commission');

    }

    

    // Reordenar los resultados actuales según el modo seleccionado

    if (lastResults && lastResults.length > 0) {

        // Crear una copia para ordenar

        const sortedResults = [...lastResults];

        

        if (mode === 'commission') {

            sortedResults.sort((a, b) => {

                const commA = a.comision || 0;

                const commB = b.comision || 0;

                return commB - commA;

            });

        } else {

            sortedResults.sort((a, b) => b.annualSavings - a.annualSavings);

        }

        

        // Actualizar lastResults con el array ordenado

        lastResults = sortedResults;

        

        displayResults();

    }

}



function selectTariff(index) {

    selectedResult = lastResults[index];

    

    // Animate summary appearance

    const summary = document.getElementById('summarySelected');

    summary.style.display = 'grid';

    summary.style.animation = 'none';

    setTimeout(() => {

        summary.style.animation = 'slideDown 0.5s ease-out';

    }, 10);

    

    // Update values with number animation

    animateValue('selectedMonthly', 0, selectedResult.total, 800, '€ ');

    animateValue('selectedMonthlySavings', 0, selectedResult.monthlySavings, 800, '€ ');

    animateValue('selectedAnnualSavings', 0, selectedResult.annualSavings, 1000, '€ ');

    

    document.getElementById('selectedTariff').textContent = selectedResult.supplier + ' - ' + selectedResult.productName;

    

    // Update desglose

    const potKeys = Object.keys(lastFormData).filter(k => k.startsWith('potencia'));
    const maxPotDesglose = Math.max(...potKeys.map(k => parseFloat(lastFormData[k]) || 0), 0);
    const isGasDesglose = energyType === 'gas';
    const taxRatesDesglose = isGasDesglose ? null : getTaxRates(lastFormData.region || 'PENINSULA', maxPotDesglose);
    const impLabelDesglose = 'Impuesto Energía:';
    const vatRateDesglose = selectedResult && selectedResult.taxableBase ? ((selectedResult.vat || 0) / selectedResult.taxableBase) * 100 : (taxRatesDesglose ? taxRatesDesglose.vat * 100 : 0);
    const vatLabelDesglose = `IVA/IGIC/IPSI ${vatRateDesglose.toFixed(1)}%:`;

    const taxLabelEl = document.getElementById('desgloseTaxLabel');
    const vatLabelEl = document.getElementById('desgloseVATLabel');
    if (taxLabelEl) taxLabelEl.textContent = impLabelDesglose;
    if (vatLabelEl) vatLabelEl.textContent = vatLabelDesglose;

    const energyDetail = formatPeriodPrices(selectedResult.pricingConsumo, '€/kWh');
    const powerDetail = formatPeriodPrices(selectedResult.pricingPotencia, '€/kW·día');

    const energyEl = document.getElementById('desgloseEnergy');
    if (energyEl) {
        energyEl.innerHTML = `<div>€ ${selectedResult.energyCost.toFixed(2)}</div>${energyDetail ? `<div class="desglose-periods">${energyDetail}</div>` : ''}`;
    }

    const powerEl = document.getElementById('desglosePower');
    if (powerEl) {
        powerEl.innerHTML = `<div>€ ${selectedResult.powerCost.toFixed(2)}</div>${powerDetail ? `<div class="desglose-periods">${powerDetail}</div>` : ''}`;
    }

    
    const rentalEl = document.getElementById('desgloseRental');
    if (rentalEl) {
        rentalEl.textContent = `€ ${(selectedResult.equipmentRental || 0).toFixed(2)}`;
    }
    const otherEl = document.getElementById('desgloseOther');
    if (otherEl) {
        otherEl.textContent = `€ ${(selectedResult.otherCosts || 0).toFixed(2)}`;
    }

document.getElementById('desgloseSubtotal').textContent = '€ ' + selectedResult.subtotal.toFixed(2);

    document.getElementById('desgloseTax').textContent = '€ ' + selectedResult.electricityTax.toFixed(2);

    document.getElementById('desgloseTaxable').textContent = '€ ' + selectedResult.taxableBase.toFixed(2);

    document.getElementById('desgloseVAT').textContent = '€ ' + selectedResult.vat.toFixed(2);

    document.getElementById('desgloseTotal').textContent = '€ ' + selectedResult.total.toFixed(2);



    // Update table selection with smooth transition

    document.querySelectorAll('.results-table tbody tr').forEach((tr) => {

        tr.classList.remove('selected');

        const trIndex = parseInt(tr.getAttribute('data-result-index'));

        if (trIndex === index) {

            tr.classList.add('selected');

            // Smooth scroll to selected row only on larger screens

            if (window.innerWidth > 768) {

                tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            }

        }

    });

}



// Animate number counting

function animateValue(elementId, start, end, duration, prefix = '') {

    const element = document.getElementById(elementId);

    if (!element) return;

    

    const range = end - start;

    const increment = range / (duration / 16); // 60fps

    let current = start;

    

    const timer = setInterval(() => {

        current += increment;

        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {

            current = end;

            clearInterval(timer);

        }

        element.textContent = prefix + current.toFixed(2);

    }, 16);

}



function closeFormModal() {

    document.getElementById('formModal').style.display = 'none';

    document.body.style.overflow = 'auto';

}



function closeResults() {

    document.getElementById('resultsOverlay').style.display = 'none';

    // No reabrimos modal; el usuario puede abrir de nuevo para recalcular

    closeFormModal();

    selectedResult = null;

}



function returnToFormWithData() {
    document.getElementById('resultsOverlay').style.display = 'none';
    document.getElementById('resultsContent').style.display = 'none';
    document.getElementById('loadingSpinner').style.display = 'none';

    if (Object.keys(lastFormData || {}).length) {
        setFormValuesFromData(lastFormData);
    }

    document.getElementById('formModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}


function showDesglose() {

    const modal = document.getElementById('desgloseModal');

    modal.style.display = 'flex';

    document.body.style.overflow = 'hidden';

    

    // Cerrar con tecla Escape

    const handleEscape = (e) => {

        if (e.key === 'Escape') {

            hideDesglose();

            document.removeEventListener('keydown', handleEscape);

        }

    };

    document.addEventListener('keydown', handleEscape);

}



function hideDesglose() {

    const modal = document.getElementById('desgloseModal');

    modal.style.display = 'none';

    document.body.style.overflow = 'auto';

}



async function downloadPDF() {

    if (!selectedResult) { alert('Selecciona una tarifa'); return; }

    // Evento GA4: Descarga de PDF
    if (typeof gtag === 'function') {
        const tarifa = energyType === 'gas' ? 'GAS' : (lastFormData?.tariffType || currentTariffType);
        gtag('event', 'descarga_pdf', {
            comercial_code: CODIGO_COMERCIAL ? CODIGO_COMERCIAL.toUpperCase() : 'DESCONOCIDO',
            comercializadora: selectedResult.supplier,
            producto: selectedResult.productName,
            tipo_energia: energyType,
            tipo_tarifa: tarifa,
            ahorro_anual: selectedResult.annualSavings ? selectedResult.annualSavings.toFixed(2) : '0',
            ahorro_porcentaje: selectedResult.savingsPercent ? selectedResult.savingsPercent.toFixed(1) : '0',
            comision: selectedResult.comision ? selectedResult.comision.toFixed(2) : '0',
            event_category: 'descargas',
            event_label: selectedResult.supplier + ' - ' + selectedResult.productName
        });
    }


    console.log('=== INICIO PDF DEBUG ===');

    console.log('selectedResult:', selectedResult);

    console.log('lastFormData:', lastFormData);



    try {

        // Cargar branding de comercializadoras

        let supplierBranding = {};

        try {

            const response = await fetch('supplier-branding.json');

            supplierBranding = await response.json();

        } catch (err) {

            console.warn('No se pudo cargar supplier-branding.json:', err);

        }



        const currentSupplier = selectedResult.supplier;

        const branding = supplierBranding[currentSupplier] || {

            name: currentSupplier,

            logo: 'soluciones logo.png',

            primaryColor: '#3b82f6',

            secondaryColor: '#1e3a8a',

            website: 'www.soluciones-vivivan.com',

            phone: '900 000 000'

        };

        const isIgnisTerraAir = (currentSupplier || '').toString().trim().toUpperCase() === 'IGNIS'
            && (selectedResult.productName || '').toString().trim().toUpperCase().startsWith('TERRA AIR');
        const serviceAdjustmentDisclaimerHtml = isIgnisTerraAir
            ? `<div style="margin-top:8px;font-size:10px;line-height:1.25;color:#92400e;background:#fff7ed;border:1px solid #fed7aa;padding:7px 10px;border-radius:12px;display:inline-block;">Sujeto a servicio de ajuste.</div>`
            : '';



        const currentBill = parseFloat(lastFormData.currentBill);

        const today = new Date();

        const dateStr = today.toLocaleDateString('es-ES', {year: 'numeric', month: 'long', day: 'numeric'});

        const savingsPercent = selectedResult.savingsPercent.toFixed(1);

        const isGasPdf = energyType === 'gas';

                const tariffType = isGasPdf ? 'GAS' : (lastFormData.tariffType || currentTariffType);

        const periodsConsumo = isGasPdf ? [] : (tariffType === "2.0TD" ? ["P1","P2","P3"] : ["P1","P2","P3","P4","P5","P6"]);

        const periodsPotencia = isGasPdf ? [] : (tariffType === "2.0TD" ? ["P1","P2"] : ["P1","P2","P3","P4","P5","P6"]);

        const consumoPrices = selectedResult.pricingConsumo || {};

        const potenciaPrices = selectedResult.pricingPotencia || {};

        const cae = parseFloat(lastFormData.cae) || 0;

        const comision = selectedResult.commission || 0;

        const maxBill = Math.max(currentBill, selectedResult.total) || 1;

        const currentPct = Math.max(5, Math.min(100, (currentBill / maxBill) * 100));

        const proposedPct = Math.max(5, Math.min(100, (selectedResult.total / maxBill) * 100));

        const consumoValues = periodsConsumo.map(p => parseFloat(lastFormData[`consumption${p}`]) || 0);

        const potenciaValues = periodsPotencia.map(p => parseFloat(lastFormData[`potencia${p}`]) || 0);

        const maxConsumoVal = Math.max(...consumoValues, 1);

        const maxPotVal = Math.max(...potenciaValues, 1);
        const maxPotenciaPdf = Math.max(...potenciaValues, 0);
        
        const taxRatesPdf = isGasPdf ? null : getTaxRates(lastFormData.region || 'PENINSULA', maxPotenciaPdf);
        const impLabelPdf = isGasPdf ? 'Impuesto hidrocarburos' : 'Impuesto Energía';
        const vatRatePdf = selectedResult && selectedResult.taxableBase ? ((selectedResult.vat || 0) / selectedResult.taxableBase) * 100 : (taxRatesPdf ? taxRatesPdf.vat * 100 : 0);
        const vatLabelPdf = `IVA/IGIC/IPSI ${vatRatePdf.toFixed(1)}%`;

        const savingsPctNum = Math.max(0, Math.min(100, parseFloat(selectedResult.savingsPercent) || 0));

        const annualSavingsVal = parseFloat(selectedResult.annualSavings) || 0;
        const colorActual = '#ef4444';
        const colorAhorro = '#16a34a';

        // Distribuciones para graficos extra
        const netEnergy = Math.max(0, selectedResult.energyCost - (selectedResult.discounts.energy || 0));
        const netPower = Math.max(0, selectedResult.powerCost - (selectedResult.discounts.power || 0));
        const netTaxes = Math.max(0, (selectedResult.electricityTax || 0) + (selectedResult.vat || 0));
        const netExtras = Math.max(0, (selectedResult.extras.reactiveEnergy || 0) + (selectedResult.extras.excessPower || 0) + (selectedResult.equipmentRental || 0) + (selectedResult.otherCosts || 0));
        const totalComponents = netEnergy + netPower + netTaxes + netExtras || 1;
        const savingsTotal = Math.max(0, currentBill - selectedResult.total);

        const paretoBase = [
            { label: 'Energía', value: netEnergy, color: '#16a34a' },
            { label: 'Potencia', value: netPower, color: '#0ea5e9' },
            { label: 'Impuestos', value: netTaxes, color: '#6b7280' },
            { label: 'Extras', value: netExtras, color: '#f59e0b' }
        ].filter(i => i.value > 0);

        const paretoItems = paretoBase
            .map(i => ({ ...i, contrib: savingsTotal * (i.value / totalComponents) }))
            .sort((a, b) => b.contrib - a.contrib)
            .slice(0, 4)
            .map(i => ({ ...i, perc: savingsTotal ? (i.contrib / savingsTotal) * 100 : 0 }));

        const impactRows = paretoItems.map(i => `
            <div class="impact-row">
                <div class="impact-label">${i.label}</div>
                <div class="impact-bar"><div class="impact-fill" style="width:${Math.min(100, i.perc).toFixed(1)}%;background:${i.color};"></div></div>
                <div class="impact-num">€ ${i.contrib.toFixed(2)}</div>
                <div class="impact-pct">${i.perc.toFixed(1)}%</div>
            </div>
        `).join('');

        const totalConsumo = consumoValues.reduce((a, b) => a + b, 0) || 1;
        const totalPot = potenciaValues.reduce((a, b) => a + b, 0) || 1;
        const consumoPalette = ['#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0','#e2f6e9'];
        const potenciaPalette = ['#ef4444','#f87171','#fca5a5','#fecdd3','#fee2e2','#fff1f2'];

        const consumoLegend = periodsConsumo.map((p, idx) => `<div class="legend-item"><div class="legend-swatch" style="background:${consumoPalette[idx % consumoPalette.length]};"></div><div class="legend-label">${p}</div></div>`).join('');
        const potenciaLegend = periodsPotencia.map((p, idx) => `<div class="legend-item"><div class="legend-swatch" style="background:${potenciaPalette[idx % potenciaPalette.length]};"></div><div class="legend-label">${p}</div></div>`).join('');

        const consumoStack = periodsConsumo.map((p, idx) => {
            const kwh = consumoValues[idx];
            const pct = Math.max(0, (kwh / totalConsumo) * 100);
            return `<div class="stack-segment" style="width:${pct}%;background:${consumoPalette[idx % consumoPalette.length]}"><span>${pct.toFixed(0)}%</span></div>`;
        }).join('');

        const potenciaStack = periodsPotencia.map((p, idx) => {
            const kw = potenciaValues[idx];
            const pct = Math.max(0, (kw / totalPot) * 100);
            return `<div class="stack-segment" style="width:${pct}%;background:${potenciaPalette[idx % potenciaPalette.length]}"><span>${pct.toFixed(0)}%</span></div>`;
        }).join('');

        const circRadius = 70;
        const circPerimeter = 2 * Math.PI * circRadius;
        const gaugeDash = (savingsPctNum / 100) * circPerimeter;
        const gaugeSVG = `
            <svg class="gauge-svg" viewBox="0 0 180 180" width="156" height="156" aria-label="Ahorro">
                <circle cx="90" cy="90" r="${circRadius}" fill="none" stroke="#e5e7eb" stroke-width="16" />
                <circle cx="90" cy="90" r="${circRadius}" fill="none" stroke="${colorAhorro}" stroke-width="16"
                    stroke-linecap="round" stroke-dasharray="${gaugeDash} ${circPerimeter}"
                    transform="rotate(-90 90 90)" />
                <text x="90" y="82" text-anchor="middle" class="gauge-text-main">${savingsPercent}%</text>
                <text x="90" y="100" text-anchor="middle" class="gauge-text-sub">AHORRO ANUAL</text>
                <text x="90" y="118" text-anchor="middle" class="gauge-text-amount">€ ${annualSavingsVal.toFixed(2)}/año</text>
            </svg>`;




        console.log('Variables calculadas:');

        console.log('- currentBill:', currentBill);

        console.log('- cae:', cae);

        console.log('- comision:', comision);

        console.log('- tariffType:', tariffType);

        console.log('- Branding:', branding);



        // Build detailed rows for consumption and power

        const consumoDetailRows = periodsConsumo.map(p => {

            const kwh = parseFloat(lastFormData[`consumption${p}`]) || 0;

            const price = consumoPrices[p] || 0;

            const cost = kwh * price;

            return `<tr><td>${p}</td><td>${kwh.toFixed(2)} kWh</td><td>€ ${price.toFixed(6)}</td><td>€ ${cost.toFixed(2)}</td></tr>`;

        }).join('');

        

        const potenciaDetailRows = periodsPotencia.map(p => {
            const kw = parseFloat(lastFormData[`potencia${p}`]) || 0;
            const priceDay = potenciaPrices[p] || 0;
            const cost = kw * priceDay * parseInt(lastFormData.billingDays);
            return `<tr><td>${p}</td><td>${kw.toFixed(2)} kW</td><td>€ ${priceDay.toFixed(6)}</td><td>€ ${cost.toFixed(2)}</td></tr>`;
        }).join('');

        const consumoColumns = periodsConsumo.map(p => {
            const kwh = parseFloat(lastFormData[`consumption${p}`]) || 0;
            const h = Math.max(8, (kwh / maxConsumoVal) * 60);
            return `<div class="mini-col"><div class="mini-bar" style="height:${h}px"></div><div class="mini-col-label">${p}</div><div class="mini-col-value">${kwh.toFixed(0)} kWh</div></div>`;
        }).join("");

        const potenciaColumns = periodsPotencia.map(p => {
            const kw = parseFloat(lastFormData[`potencia${p}`]) || 0;
            const h = Math.max(8, (kw / maxPotVal) * 60);
            return `<div class="mini-col"><div class="mini-bar" style="height:${h}px"></div><div class="mini-col-label">${p}</div><div class="mini-col-value">${kw.toFixed(0)} kW</div></div>`;
        }).join("");

        // Datos específicos de gas para el PDF
        const gasMonthly = parseFloat(lastFormData.gasMonthlyConsumption) || 0;
        const gasAnnual = parseFloat(lastFormData.cae) || 0;
        const gasBand = selectedResult.gasBand || lastFormData.gasTariffBand || gasTariffBand;
        const gasFixedDaily = selectedResult.fixedDaily ?? 0;
        const gasVariableKwh = selectedResult.variableKwh ?? 0;
        const gasBillingDays = parseInt(lastFormData.billingDays) || 30;
        const gasFixedCost = gasFixedDaily * gasBillingDays;
        const gasVariableCost = selectedResult.energyCost || (gasMonthly * gasVariableKwh);
        const gasTaxTotal = selectedResult.electricityTax || 0;
        const gasVatTotal = selectedResult.vat || 0;
        const gasExtras = (selectedResult.equipmentRental || 0) + (selectedResult.otherCosts || 0);
        const gasStackParts = [
            { label: 'Fijo', value: gasFixedCost, color: '#0ea5e9' },
            { label: 'Variable', value: gasVariableCost, color: '#16a34a' },
            { label: 'Impuestos', value: gasTaxTotal + gasVatTotal, color: '#6b7280' },
            { label: 'Otros', value: gasExtras, color: '#f59e0b' }
        ].filter(i => i.value > 0);
        const gasTotalStack = gasStackParts.reduce((acc, i) => acc + i.value, 0) || 1;
        const gasStackBar = gasStackParts.map(i => {
            const pct = Math.max(0, (i.value / gasTotalStack) * 100);
            return `<div class="stack-segment" style="width:${pct}%;background:${i.color}"><span>${pct.toFixed(0)}%</span></div>`;
        }).join('');


        let htmlContent;

        if (isGasPdf) {
            htmlContent = `<!DOCTYPE html><html><head><meta charset\"UTF-8\"><style>

            *{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}

            @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
            .page{padding:8mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#334155;background:#ffffff}

            .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:3px solid ${branding.primaryColor}}

            .topbar-left{display:flex;align-items:center;gap:12px}

            .logo-img{width:80px;height:auto;max-height:50px;object-fit:contain}

            .title{font-size:18px;font-weight:700;color:${branding.primaryColor};letter-spacing:.5px}

            .subtitle{font-size:10px;color:${branding.secondaryColor};font-weight:500;margin-top:2px}

            .topbar-right{text-align:right;font-size:9px;color:#64748b}

            .contact-info{color:${branding.primaryColor};font-weight:600;margin-top:3px}

            .meta{font-size:9px;color:#2563eb;font-weight:500}

            .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}

            .box{border:2px solid ${branding.primaryColor}33;border-radius:8px;background:#ffffff;box-shadow:0 2px 4px rgba(0,0,0,.05);margin-bottom:6px}

            .box .hd{background:${branding.primaryColor};padding:5px 7px;font-weight:700;color:#ffffff;font-size:11px;display:flex;align-items:center;gap:6px;border-radius:6px 6px 0 0}

            .box .hd:before{content:'';font-size:12px;color:#ffffff}

            .box .bd{padding:5px 6px}

            .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}

            .info-item{background:${branding.primaryColor}15;border-left:4px solid ${branding.primaryColor};border-radius:4px;padding:6px 8px}

            .info-label{font-weight:600;color:${branding.secondaryColor};font-size:9px;text-transform:uppercase;letter-spacing:.5px}

            .info-value{font-weight:700;color:#0f172a;font-size:11px;margin-top:2px}

            table{width:100%;border-collapse:separate;border-spacing:0;font-size:9px}

            thead th{background:${branding.primaryColor};color:#ffffff;font-weight:600;border:1px solid ${branding.secondaryColor};padding:5px 6px}

            tbody td{border:1px solid ${branding.primaryColor}33;background:#ffffff;padding:4px 5px}

            tfoot td{border:1px solid ${branding.primaryColor}66;padding:4px 5px}

            th,td{text-align:right}

            th:first-child,td:first-child{text-align:left}

            .tot{font-weight:700;background:${branding.primaryColor}22;color:${branding.secondaryColor}}

            .highlight-red{color:#dc2626;font-weight:600;font-size:12px}

            .highlight-green{color:#15803d;font-weight:600;font-size:12px}

            .annual-savings{color:#facc15;font-size:18px;font-weight:800;margin-bottom:3px;text-transform:uppercase}

            .annual-percent{color:${branding.secondaryColor};font-size:11px;font-weight:600}

            .split{display:grid;grid-template-columns:1fr 1fr;gap:8px}

            .compact-table{font-size:8.5px}

            .compact-table th,.compact-table td{padding:3px 4px}

            .bar-chart{margin-top:8px}

            .bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:9.5px;color:#334155}

            .bar-label{flex:0 0 120px;font-weight:600}

            .bar-wrap{flex:1;display:flex;align-items:center;gap:6px}

            .bar{flex:1;height:12px;background:#f1f5f9;border-radius:999px;overflow:hidden;position:relative;border:1px solid ${branding.primaryColor}22}

            .bar-fill{height:100%;border-radius:999px;transition:width .3s ease;box-shadow:0 2px 6px rgba(0,0,0,.1)}

            .bar-value{min-width:70px;text-align:right;font-weight:700;color:${branding.secondaryColor}}
            .chart-card{background:linear-gradient(135deg,#f8fafc 0%,#ffffff 55%,${branding.primaryColor}08 100%);border:1px solid ${branding.primaryColor}22;border-radius:12px;padding:8px;box-shadow:0 3px 10px rgba(0,0,0,.08)}
            .chart-layout{display:grid;grid-template-columns:170px 1fr;gap:12px;align-items:center}
            .gauge{position:relative;width:140px;height:140px;display:flex;align-items:center;justify-content:center}
            .gauge-svg text{font-family:Arial,Helvetica,sans-serif}
            .gauge-text-main{font-weight:800;font-size:18px;fill:#0f172a}
            .gauge-text-sub{font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;fill:#334155}
            .gauge-text-amount{font-size:11px;font-weight:800;fill:${colorAhorro}}
            .pill{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:700;border:1px solid ${branding.primaryColor}22;background:${branding.primaryColor}08;color:${branding.secondaryColor};margin-top:6px}
            .pill span{font-weight:600;color:#0f172a}
            .pill-alt{border-color:${branding.secondaryColor}33;background:${branding.secondaryColor}12;color:${branding.primaryColor}}
            .pill-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
            .pill-negative{border-color:${colorActual}33;background:${colorActual}12;color:${colorActual}}
            .pill-positive{border-color:${colorAhorro}33;background:${colorAhorro}12;color:${colorAhorro}}
            .card-lite{border:1px solid ${branding.primaryColor}22;border-radius:10px;padding:6px;background:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,.05)}
            .card-lite .title{font-weight:800;color:${branding.secondaryColor};font-size:10px;margin-bottom:4px;display:flex;align-items:center;gap:6px}
            .stack-section{display:grid;grid-template-columns:1fr;gap:6px}
            .stack-title{font-weight:700;color:#0f172a;font-size:9px;margin-bottom:2px}
            .stack-bar{display:flex;width:100%;height:14px;border-radius:8px;overflow:hidden;border:1px solid ${branding.primaryColor}22;background:#f8fafc}
            .stack-segment{display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#0f172a;white-space:nowrap}
            .legend-item{display:flex;align-items:center;gap:4px}
            .legend-swatch{width:10px;height:10px;border-radius:2px;border:1px solid #cbd5e1}
            .legend-label{font-weight:600}

        </style></head><body>

        <div class="page">

            <div class="topbar">

                <div class="topbar-left">

                    <img class="logo-img" src="${branding.logo}" alt="Logo" onerror="this.style.display='none'"/>

                    <div>

                        <div class="subtitle">Propuesta de Gas Personalizada</div>

                    </div>

                </div>

                <div class="topbar-right">

                    <div class="meta">Fecha: ${dateStr}</div>

                </div>

            </div>



            <div class="box"><div class="hd">Datos del cliente</div><div class="bd"><div class="info-grid">

                <div class="info-item"><div class="info-label">Nombre</div><div class="info-value">${lastFormData.clientName || '-'}</div></div>

                <div class="info-item"><div class="info-label">CUPS</div><div class="info-value">${lastFormData.cups || '-'}</div></div>

                <div class="info-item"><div class="info-label">Peaje</div><div class="info-value">${gasBand}</div></div>

                <div class="info-item"><div class="info-label">Consumo factura</div><div class="info-value">${gasMonthly.toFixed(0)} kWh</div></div>

                <div class="info-item"><div class="info-label">Consumo a\u00f1o</div><div class="info-value">${gasAnnual.toFixed(0)} kWh</div></div>

                <div class="info-item"><div class="info-label">D\u00edas Factura</div><div class="info-value">${lastFormData.billingDays || '-'}</div></div>

            </div></div></div>



            <div class="split">

                <div class="box"><div class="hd">Producto recomendado</div><div class="bd">

                    <strong style="font-size:14px;color:${branding.primaryColor}">${selectedResult.supplier}</strong><br>

                    <span style="font-size:11px;color:#334155;font-weight:500;margin-top:3px;display:block">${selectedResult.productName}</span>
                    ${serviceAdjustmentDisclaimerHtml}

                </div></div>

                <div class="box"><div class="hd">Resumen de ahorro</div><div class="bd" style="text-align:center">

                    <div style="font-size:11px;margin-bottom:6px">Actual: <span class="highlight-red">&euro; ${currentBill.toFixed(2)}</span>  | Propuesta: <span class="highlight-green">&euro; ${selectedResult.total.toFixed(2)}</span></div>

                    <div class="annual-savings"> &euro; ${selectedResult.annualSavings.toFixed(2)} / AHORRO ANUAL</div>

                    <div class="annual-percent">${savingsPercent}% de ahorro</div>

                </div></div>

            </div>



            <div class="split">

                <div class="box"><div class="hd">Detalle gas</div><div class="bd">

                    <table class="compact-table"><tbody>
                        <tr><td>Peaje</td><td>${gasBand}</td></tr>
                        <tr><td>Consumo factura</td><td>${gasMonthly.toFixed(0)} kWh</td></tr>
                        <tr><td>Consumo a\u00f1o</td><td>${gasAnnual.toFixed(0)} kWh</td></tr>
                        <tr><td>Fijo diario</td><td>&euro; ${gasFixedDaily.toFixed(6)} / d\u00eda</td></tr>
                        <tr><td>Coste fijo</td><td>&euro; ${gasFixedCost.toFixed(2)}</td></tr>
                        <tr><td>Variable kWh</td><td>&euro; ${gasVariableKwh.toFixed(6)}</td></tr>
                        <tr><td>Coste variable</td><td>&euro; ${gasVariableCost.toFixed(2)}</td></tr>
                    </tbody></table>

                </div></div>

                <div class="box"><div class="hd">Totales</div><div class="bd"><table class="compact-table">

                    <tr><td>Alquiler</td><td>&euro; ${selectedResult.equipmentRental.toFixed(2)}</td></tr>

                    <tr><td>Otros</td><td>&euro; ${selectedResult.otherCosts.toFixed(2)}</td></tr>

                    <tr><td>Subtotal</td><td>&euro; ${selectedResult.subtotal.toFixed(2)}</td></tr>

                    <tr><td>${impLabelPdf}</td><td>&euro; ${selectedResult.electricityTax.toFixed(2)}</td></tr>

                    <tr><td>${vatLabelPdf}</td><td>&euro; ${selectedResult.vat.toFixed(2)}</td></tr>

                    <tr class="tot"><td>TOTAL</td><td>&euro; ${selectedResult.total.toFixed(2)}</td></tr>

                </table></div></div>

            </div>



            <div class="box"><div class="bd bar-chart chart-card" style="padding-top:4px">
                <div class="chart-layout">
                <div class="gauge">${gaugeSVG}</div>
                <div class="mini-bars">
                        <div class="bar-row">
                            <div class="bar-label" style="color:${colorActual};font-weight:700">Factura actual</div>
                            <div class="bar-wrap">
                                <div class="bar"><div class="bar-fill" style="width:${currentPct}%;background:linear-gradient(90deg, ${colorActual} 0%, #f87171 100%);"></div></div>
                                <div class="bar-value" style="color:${colorActual}">&euro; ${currentBill.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <div class="bar-label" style="color:${colorAhorro};font-weight:700">Propuesta</div>
                            <div class="bar-wrap">
                                <div class="bar"><div class="bar-fill" style="width:${proposedPct}%;background:linear-gradient(90deg, #22c55e 0%, ${colorAhorro} 100%);"></div></div>
                                <div class="bar-value" style="color:${colorAhorro}">&euro; ${selectedResult.total.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="bar-row" style="margin-top:4px;color:${colorAhorro};font-weight:700">
                            <div class="bar-label">Ahorro por factura</div>
                            <div class="bar-value" style="text-align:left;color:${colorAhorro}">&euro; ${selectedResult.monthlySavings.toFixed(2)} (${savingsPercent}%)</div>
                        </div>
                    </div>
                </div>
                <div class="pill-row">
                    <div class="pill pill-negative"><span>Factura:</span>&euro; ${currentBill.toFixed(2)}</div>
                    <div class="pill pill-positive"><span>Propuesta:</span>&euro; ${selectedResult.total.toFixed(2)}</div>
                    <div class="pill"><span>Peaje:</span>${gasBand}</div>
                    <div class="pill pill-alt"><span>Consumo factura:</span>${gasMonthly.toFixed(0)} kWh/factura</div>
                </div>
                <div class="card-lite" style="margin-top:8px">
                    <div class="title">Distribución fija / variable / impuestos</div>
                    <div class="stack-section">
                        <div class="stack-title">Reparto de la factura</div>
                        <div class="stack-bar">${gasStackBar || '<div class="stack-segment" style="width:100%;background:#e5e7eb"><span>Sin datos</span></div>'}</div>
                        <div class="stack-legend">
                            <div class="legend-item"><div class="legend-swatch" style="background:#0ea5e9"></div><div class="legend-label">Fijo</div></div>
                            <div class="legend-item"><div class="legend-swatch" style="background:#16a34a"></div><div class="legend-label">Variable</div></div>
                            <div class="legend-item"><div class="legend-swatch" style="background:#6b7280"></div><div class="legend-label">Impuestos</div></div>
                            <div class="legend-item"><div class="legend-swatch" style="background:#f59e0b"></div><div class="legend-label">Otros</div></div>
                        </div>
                    </div>
                </div>
            </div></div>

        </div></body></html>`;
        } else {
        htmlContent = `<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><style>

            *{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}

            @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
            .page{padding:8mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#334155;background:#ffffff}

            .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:3px solid ${branding.primaryColor}}

            .topbar-left{display:flex;align-items:center;gap:12px}

            .logo-img{width:80px;height:auto;max-height:50px;object-fit:contain}

            .title{font-size:18px;font-weight:700;color:${branding.primaryColor};letter-spacing:.5px}

            .subtitle{font-size:10px;color:${branding.secondaryColor};font-weight:500;margin-top:2px}

            .topbar-right{text-align:right;font-size:9px;color:#64748b}

            .contact-info{color:${branding.primaryColor};font-weight:600;margin-top:3px}

            .meta{font-size:9px;color:#2563eb;font-weight:500}

            .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}

            .box{border:2px solid ${branding.primaryColor}33;border-radius:8px;background:#ffffff;box-shadow:0 2px 4px rgba(0,0,0,.05);margin-bottom:6px}

            .box .hd{background:${branding.primaryColor};padding:5px 7px;font-weight:700;color:#ffffff;font-size:11px;display:flex;align-items:center;gap:6px;border-radius:6px 6px 0 0}

            .box .hd:before{content:'✦';font-size:12px;color:#ffffff}

            .box .bd{padding:5px 6px}

            .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}

            .info-item{background:${branding.primaryColor}15;border-left:4px solid ${branding.primaryColor};border-radius:4px;padding:6px 8px}

            .info-label{font-weight:600;color:${branding.secondaryColor};font-size:9px;text-transform:uppercase;letter-spacing:.5px}

            .info-value{font-weight:700;color:#0f172a;font-size:11px;margin-top:2px}

            table{width:100%;border-collapse:separate;border-spacing:0;font-size:9px}

            thead th{background:${branding.primaryColor};color:#ffffff;font-weight:600;border:1px solid ${branding.secondaryColor};padding:5px 6px}

            tbody td{border:1px solid ${branding.primaryColor}33;background:#ffffff;padding:4px 5px}

            tfoot td{border:1px solid ${branding.primaryColor}66;padding:4px 5px}

            th,td{text-align:right}

            th:first-child,td:first-child{text-align:left}

            .tot{font-weight:700;background:${branding.primaryColor}22;color:${branding.secondaryColor}}

            .highlight-red{color:#dc2626;font-weight:600;font-size:12px}

            .highlight-green{color:#15803d;font-weight:600;font-size:12px}

            .annual-savings{color:#facc15;font-size:18px;font-weight:800;margin-bottom:3px;text-transform:uppercase}

            .annual-percent{color:${branding.secondaryColor};font-size:11px;font-weight:600}

            .split{display:grid;grid-template-columns:1fr 1fr;gap:8px}

            .compact-table{font-size:8.5px}

            .compact-table th,.compact-table td{padding:3px 4px}

            .bar-chart{margin-top:8px}

            .bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:9.5px;color:#334155}

            .bar-label{flex:0 0 120px;font-weight:600}

            .bar-wrap{flex:1;display:flex;align-items:center;gap:6px}

            .bar{flex:1;height:12px;background:#f1f5f9;border-radius:999px;overflow:hidden;position:relative;border:1px solid ${branding.primaryColor}22}

            .bar-fill{height:100%;border-radius:999px;transition:width .3s ease;box-shadow:0 2px 6px rgba(0,0,0,.1)}

            .bar-value{min-width:70px;text-align:right;font-weight:700;color:${branding.secondaryColor}}
            .chart-card{background:linear-gradient(135deg,#f8fafc 0%,#ffffff 55%,${branding.primaryColor}08 100%);border:1px solid ${branding.primaryColor}22;border-radius:12px;padding:8px;box-shadow:0 3px 10px rgba(0,0,0,.08)}
            .chart-layout{display:grid;grid-template-columns:170px 1fr;gap:12px;align-items:center}
            .gauge{position:relative;width:140px;height:140px;display:flex;align-items:center;justify-content:center}
            .gauge-svg text{font-family:Arial,Helvetica,sans-serif}
            .gauge-text-main{font-weight:800;font-size:18px;fill:#0f172a}
            .gauge-text-sub{font-size:10px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;fill:#334155}
            .gauge-text-amount{font-size:11px;font-weight:800;fill:${colorAhorro}}
            .mini-bars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
            .mini-section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}
            .mini-chart{border:1px solid ${branding.primaryColor}22;border-radius:10px;padding:6px 6px 8px 6px;background:#ffffff;box-shadow:0 2px 4px rgba(0,0,0,.05)}
            .mini-title{font-weight:800;color:${branding.secondaryColor};font-size:10px;margin-bottom:6px;display:flex;align-items:center;gap:4px;letter-spacing:.2px}
            .mini-cols{display:flex;align-items:flex-end;gap:10px;justify-content:space-between}
            .mini-bar{width:14px;background:linear-gradient(180deg, ${colorAhorro} 0%, ${branding.secondaryColor} 100%);border-radius:4px 4px 2px 2px;border:1px solid ${branding.primaryColor}33;box-shadow:0 2px 4px rgba(0,0,0,.08)}
            .mini-col-label{text-align:center;font-size:9px;margin-top:3px;color:#475569}
            .mini-col-value{text-align:center;font-size:9px;color:#0f172a;font-weight:700}
            .pill{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:700;border:1px solid ${branding.primaryColor}22;background:${branding.primaryColor}08;color:${branding.secondaryColor};margin-top:6px}
            .pill span{font-weight:600;color:#0f172a}
            .pill-alt{border-color:${branding.secondaryColor}33;background:${branding.secondaryColor}12;color:${branding.primaryColor}}
            .pill-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
            .pill-negative{border-color:${colorActual}33;background:${colorActual}12;color:${colorActual}}
            .pill-positive{border-color:${colorAhorro}33;background:${colorAhorro}12;color:${colorAhorro}}
            .chart-extras{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:6px}
            .card-lite{border:1px solid ${branding.primaryColor}22;border-radius:10px;padding:6px;background:#ffffff;box-shadow:0 2px 6px rgba(0,0,0,.05)}
            .card-lite .title{font-weight:800;color:${branding.secondaryColor};font-size:10px;margin-bottom:4px;display:flex;align-items:center;gap:6px}
            .impact-row{display:grid;grid-template-columns:80px 1fr 60px 40px;align-items:center;gap:6px;font-size:9px;margin-bottom:5px}
            .impact-label{font-weight:700;color:#0f172a}
            .impact-bar{height:9px;background:#f1f5f9;border-radius:999px;border:1px solid ${branding.primaryColor}22;overflow:hidden}
            .impact-fill{height:100%;border-radius:999px}
            .impact-num{text-align:right;font-weight:700;color:#0f172a}
            .impact-pct{text-align:right;font-weight:800;color:${branding.primaryColor}}
            .stack-section{display:grid;grid-template-columns:1fr;gap:6px}
            .stack-title{font-weight:700;color:#0f172a;font-size:9px;margin-bottom:2px}
            .stack-bar{display:flex;width:100%;height:14px;border-radius:8px;overflow:hidden;border:1px solid ${branding.primaryColor}22;background:#f8fafc}
            .stack-segment{display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#0f172a;white-space:nowrap}
            .stack-legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;font-size:8px;color:#0f172a}
            .legend-item{display:flex;align-items:center;gap:4px}
            .legend-swatch{width:10px;height:10px;border-radius:2px;border:1px solid #cbd5e1}
            .legend-label{font-weight:600}

        </style></head><body>

        <div class=\"page\">

            <div class=\"topbar\">

                <div class=\"topbar-left\">

                    <img class=\"logo-img\" src=\"${branding.logo}\" alt=\"Logo\" onerror=\"this.style.display='none'\"/>

                    <div>

                        <div class=\"subtitle\">Propuesta Energética Personalizada</div>

                    </div>

                </div>

                <div class=\"topbar-right\">

                    <div class=\"meta\">Fecha: ${dateStr}</div>

                </div>

            </div>



            <div class=\"box\"><div class=\"hd\">📋 Datos del Cliente</div><div class=\"bd\"><div class=\"info-grid\">

                <div class=\"info-item\"><div class=\"info-label\">Nombre</div><div class=\"info-value\">${lastFormData.clientName || '-'}</div></div>

                <div class=\"info-item\"><div class=\"info-label\">CUPS</div><div class=\"info-value\">${lastFormData.cups || '-'}</div></div>

                <div class=\"info-item\"><div class=\"info-label\">Tipo Tarifa</div><div class=\"info-value\">${tariffType}</div></div>

                <div class=\"info-item\"><div class=\"info-label\">CAE</div><div class=\"info-value\">${cae.toFixed(0)} kWh/año</div></div>

                <div class=\"info-item\"><div class=\"info-label\">Factura Actual</div><div class=\"info-value\">€${currentBill.toFixed(2)}</div></div>

                <div class=\"info-item\"><div class=\"info-label\">Días Factura</div><div class=\"info-value\">${lastFormData.billingDays || '-'}</div></div>

            </div></div></div>



            <div class=\"split\">

                <div class=\"box\"><div class=\"hd\">⚡ Producto Recomendado</div><div class=\"bd\">

                    <strong style=\"font-size:14px;color:${branding.primaryColor}\">${selectedResult.supplier}</strong><br>

                    <span style=\"font-size:11px;color:#334155;font-weight:500;margin-top:3px;display:block\">${selectedResult.productName}</span>
                    ${serviceAdjustmentDisclaimerHtml}

                </div></div>

                <div class=\"box\"><div class=\"hd\">💰 Resumen de Ahorro</div><div class=\"bd\" style=\"text-align:center\">

                    <div style=\"font-size:11px;margin-bottom:6px\">Actual: <span class=\"highlight-red\">€${currentBill.toFixed(2)}</span> → Propuesta: <span class=\"highlight-green\">€${selectedResult.total.toFixed(2)}</span></div>

                    <div class=\"annual-savings\"> €${selectedResult.annualSavings.toFixed(2)} / AHORRO ANUAL</div>

                    <div class=\"annual-percent\">✓ ${savingsPercent}% de ahorro</div>

                </div></div>

            </div>



            <div class=\"split\">

                <div class=\"box\"><div class=\"hd\">📊 Consumo por periodo</div><div class=\"bd\">

                    <table class=\"compact-table\"><thead><tr><th>P</th><th>kWh</th><th>€/kWh</th><th>€</th></tr></thead><tbody>${consumoDetailRows}</tbody>

                    <tfoot><tr class=\"tot\"><td colspan=\"3\">Total</td><td>€${selectedResult.energyCost.toFixed(2)}</td></tr></tfoot></table>

                </div></div>

                <div class=\"box\"><div class=\"hd\">⚡ Potencia por periodo</div><div class=\"bd\">

                    <table class=\"compact-table\"><thead><tr><th>P</th><th>kW</th><th>€/kW·d</th><th>€</th></tr></thead><tbody>${potenciaDetailRows}</tbody>

                    <tfoot><tr class=\"tot\"><td colspan=\"3\">Total</td><td>€${selectedResult.powerCost.toFixed(2)}</td></tr></tfoot></table>

                </div></div>

            </div>



            <div class=\"split\">

                <div class=\"box\"><div class=\"hd\">📝 Conceptos</div><div class=\"bd\"><table class=\"compact-table\">

                    <tr><td>Desc. consumo</td><td>€${selectedResult.discounts.energy.toFixed(2)}</td></tr>

                    <tr><td>Desc. potencia</td><td>€${selectedResult.discounts.power.toFixed(2)}</td></tr>

                    <tr><td>E. reactiva</td><td>€${selectedResult.extras.reactiveEnergy.toFixed(2)}</td></tr>

                    <tr><td>Exceso pot.</td><td>€${selectedResult.extras.excessPower.toFixed(2)}</td></tr>

                </table></div></div>

                <div class=\"box\"><div class=\"hd\">💵 Totales</div><div class=\"bd\"><table class=\"compact-table\">

                    <tr><td>Alquiler</td><td>€${selectedResult.equipmentRental.toFixed(2)}</td></tr>

                    <tr><td>Otros</td><td>€${selectedResult.otherCosts.toFixed(2)}</td></tr>

                    <tr><td>Subtotal</td><td>€${selectedResult.subtotal.toFixed(2)}</td></tr>

                    <tr><td>${impLabelPdf}</td><td>€${selectedResult.electricityTax.toFixed(2)}</td></tr>

                    <tr><td>${vatLabelPdf}</td><td>€${selectedResult.vat.toFixed(2)}</td></tr>

                    <tr class=\"tot\"><td>TOTAL</td><td>€${selectedResult.total.toFixed(2)}</td></tr>

                </table></div></div>

            </div>



            <div class="box"><div class="bd bar-chart chart-card" style="padding-top:4px">
                <div class="chart-layout">
                <div class="gauge">${gaugeSVG}</div>
                <div class="mini-bars">
                        <div class="bar-row">
                            <div class="bar-label" style="color:${colorActual};font-weight:700">Factura actual</div>
                            <div class="bar-wrap">
                                <div class="bar"><div class="bar-fill" style="width:${currentPct}%;background:linear-gradient(90deg, ${colorActual} 0%, #f87171 100%);"></div></div>
                                <div class="bar-value" style="color:${colorActual}">€ ${currentBill.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="bar-row">
                            <div class="bar-label" style="color:${colorAhorro};font-weight:700">Propuesta</div>
                            <div class="bar-wrap">
                                <div class="bar"><div class="bar-fill" style="width:${proposedPct}%;background:linear-gradient(90deg, #22c55e 0%, ${colorAhorro} 100%);"></div></div>
                                <div class="bar-value" style="color:${colorAhorro}">€ ${selectedResult.total.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="bar-row" style="margin-top:4px;color:${colorAhorro};font-weight:700">
                            <div class="bar-label">Ahorro por factura</div>
                            <div class="bar-value" style="text-align:left;color:${colorAhorro}">€ ${selectedResult.monthlySavings.toFixed(2)} (${savingsPercent}%)</div>
                        </div>
                    </div>
                </div>
                <div class="pill-row">
                    <div class="pill pill-negative"><span>Factura:</span>€ ${currentBill.toFixed(2)}</div>
                    <div class="pill pill-positive"><span>Propuesta:</span>€ ${selectedResult.total.toFixed(2)}</div>
                </div>
                <div class="mini-section">
                    <div class="mini-chart">
                        <div class="mini-title">Consumo por periodo</div>
                        <div class="mini-cols">${consumoColumns}</div>
                    </div>
                    <div class="mini-chart">
                        <div class="mini-title">Potencia por periodo</div>
                        <div class="mini-cols">${potenciaColumns}</div>
                    </div>
                </div>
                <div class="chart-extras">
                    <div class="card-lite">
                        <div class="title">Impacto del ahorro (€ y %)</div>
                        ${impactRows || '<div class="impact-row"><div class="impact-label">Sin datos</div></div>'}
                    </div>
                    <div class="card-lite">
                        <div class="title">Distribución consumo / potencia</div>
                        <div class="stack-section">
                            <div>
                                <div class="stack-title">Consumo (kWh)</div>
                                <div class="stack-bar">${consumoStack}</div>
                            </div>
                            <div>
                                <div class="stack-title">Potencia (kW)</div>
                                <div class="stack-bar">${potenciaStack}</div>
                            </div>
                            <div class="stack-legend">
                                ${consumoLegend}
                                ${potenciaLegend}
                            </div>
                        </div>
                    </div>
                </div>
            </div></div>

        </div></body></html>`;




        }
        const element = document.createElement('div');

        element.innerHTML = htmlContent;

        element.style.position = 'fixed';

        element.style.left = '0';

        element.style.top = '0';

        element.style.width = '205mm';

        element.style.background = 'white';

        element.style.zIndex = '10000';

        document.body.appendChild(element);



        console.log('Elemento HTML creado y añadido al DOM');

        console.log('HTML length:', htmlContent.length);

        console.log('HTML completo:', htmlContent);

        

        // Verificar que todas las variables tengan valores

        console.log('Verificación de datos:');

        console.log('energyCost:', selectedResult.energyCost);

        console.log('powerCost:', selectedResult.powerCost);

        console.log('discounts:', selectedResult.discounts);

        console.log('extras:', selectedResult.extras);

        console.log('equipmentRental:', selectedResult.equipmentRental);

        console.log('otherCosts:', selectedResult.otherCosts);

        console.log('subtotal:', selectedResult.subtotal);

        console.log('electricityTax:', selectedResult.electricityTax);

        console.log('vat:', selectedResult.vat);

        console.log('total:', selectedResult.total);



        // Preload logo image

        const img = new Image();

        img.onload = () => {

            console.log('Logo cargado correctamente');

            generatePDF();

        };

        img.onerror = () => {

            console.warn('Error cargando logo, continuando sin él');

            generatePDF();

        };

        img.src = branding.logo;

        console.log('Intentando cargar logo desde:', branding.logo);



        function generatePDF() {

            console.log('Iniciando generación de PDF con html2canvas + jsPDF...');

            

            setTimeout(() => {

                html2canvas(element, {

                    scale: 2,

                    useCORS: true,

                    allowTaint: true,

                    backgroundColor: '#ffffff',

                    logging: true

                }).then(canvas => {

                    console.log('Canvas generado:', canvas.width, 'x', canvas.height);

                    

                    const imgData = canvas.toDataURL('image/jpeg', 0.95);

                    const { jsPDF } = window.jspdf;

                    const pdf = new jsPDF({

                        orientation: 'portrait',

                        unit: 'mm',

                        format: 'a4'

                    });

                    

                    const pdfWidth = pdf.internal.pageSize.getWidth();

                    const pdfHeight = pdf.internal.pageSize.getHeight();

                    const imgWidth = pdfWidth - 20; // 10mm margin on each side

                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    

                    let heightLeft = imgHeight;

                    let position = 10;

                    

                    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);

                    heightLeft -= pdfHeight;

                    

                    while (heightLeft > 0) {

                        position = heightLeft - imgHeight + 10;

                        pdf.addPage();

                        pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);

                        heightLeft -= pdfHeight;

                    }

                    const firmaText = 'Comparativa y calculos realizados por Soluciones Vivivan SL';
                    const firmaX = 8; // pegado al margen izquierdo pero dentro del lienzo
                    const firmaY = pdfHeight / 2;
                    const firmaOptions = { angle: 90, baseline: 'middle' };
                    pdf.setFont('helvetica', 'italic');
                    pdf.setFontSize(7);
                    pdf.setTextColor(90, 90, 90);
                    for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
                        pdf.setPage(page);
                        pdf.text(firmaText, firmaX, firmaY, firmaOptions);
                    }

                    pdf.save(`Comparativa_${lastFormData.clientName}_${today.toISOString().split('T')[0]}.pdf`);

                    console.log('PDF guardado exitosamente');

                    document.body.removeChild(element);

                }).catch(err => {

                    console.error('Error en html2canvas:', err);

                    document.body.removeChild(element);

                    alert('Error generando PDF: ' + err.message);

                });

            }, 200);

        }

    } catch (error) {

        console.error('Error preparando PDF:', error);

        alert('Error al preparar el PDF: ' + error.message);

    }

}



function toggleCommissionVisibility() {

    SHOW_COMMISSION = !SHOW_COMMISSION;

    

    const btn = document.getElementById('toggleCommissionBtn');

    const commissionCells = document.querySelectorAll('.commission-col');

    const eyeIcon = btn ? btn.querySelector(".eye-icon") : null;

    const eyeOffIcon = btn ? btn.querySelector(".eye-off-icon") : null;

    

    if (SHOW_COMMISSION) {

        // Mostrar comisiones

        commissionCells.forEach(cell => {

            cell.classList.remove('hidden-commission');

        });

        

        // Cambiar icono a ojo abierto

        if (eyeIcon && eyeOffIcon) {

            eyeIcon.style.display = '';

            eyeOffIcon.style.display = 'none';

        }

        if (btn) {

            btn.setAttribute('title', 'Ocultar comisiones');

            btn.classList.add('commission-visible');

        }

    } else {

        // Ocultar comisiones

        commissionCells.forEach(cell => {

            cell.classList.add('hidden-commission');

        });

        

        // Cambiar icono a ojo tachado

        if (eyeIcon && eyeOffIcon) {

            eyeIcon.style.display = 'none';

            eyeOffIcon.style.display = '';

        }

        if (btn) {

            btn.setAttribute('title', 'Mostrar comisiones');

            btn.classList.remove('commission-visible');

        }

    }

    

    console.log(`Comisiones ${SHOW_COMMISSION ? 'visibles' : 'ocultas'}`);

}













