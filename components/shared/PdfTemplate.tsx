// components/shared/PdfTemplate.tsx
import React from 'react';
import { ResultadoTarifa, FormData } from '../../core/tipos';

interface PdfTemplateProps {
    result: ResultadoTarifa;
    form: FormData;
    id: string;
}

export const PdfTemplate = ({ result, form, id }: PdfTemplateProps) => {
    const isGas = form.energyType === 'gas';
    const date = new Date().toLocaleDateString('es-ES');
    const formatMoney = (value: number, decimals = 2) =>
        (value ?? 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const energyCost = result.energyCost ?? 0;
    const powerCost = result.powerCost ?? 0;
    const rentalCost = result.equipmentRental ?? 0;
    const otherCosts = result.otherCosts ?? 0;
    const socialBonus = result.socialBonus ?? 0;
    const impuestoEnergia = !isGas ? (result.electricityTax ?? 0) : ((result as any).gasTax ?? result.electricityTax ?? 0);
    const subtotalEnergiaPotencia = energyCost + powerCost;
    const baseTrasImpuesto = subtotalEnergiaPotencia + impuestoEnergia;
    const baseImponible = baseTrasImpuesto + rentalCost + otherCosts + socialBonus;
    const vatAmount = result.vat ?? 0;
    const totalPropuesta = result.total ?? (baseImponible + vatAmount);

    return (
        <div id={id} style={{
            width: '210mm',
            padding: '20mm',
            background: 'white',
            color: '#0f172a',
            fontFamily: "'Helvetica', 'Arial', sans-serif",
            position: 'absolute',
            top: 0,
            left: '-9999px',
            opacity: 1,
            visibility: 'visible',
            pointerEvents: 'none',
            lineHeight: 1.5,
            zIndex: 9999
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15mm', borderBottom: '4px solid #2563eb', paddingBottom: '8mm' }}>
                <div style={{ display: 'flex', gap: '5mm', alignItems: 'center' }}>
                    <div style={{ width: '40mm' }}>
                        <img src="/soluciones-logo-PDF.png" alt="Logo" crossOrigin="anonymous" style={{ width: '100%', height: 'auto' }} />
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, fontSize: '14pt', fontWeight: 900, color: '#2563eb' }}>INFORME COMPARATIVO</h2>
                    <p style={{ margin: 0, fontSize: '10pt', color: '#64748b', fontWeight: 700 }}>Ref: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                    <p style={{ margin: 0, fontSize: '10pt', color: '#64748b' }}>Fecha: {date}</p>
                </div>
            </div>

            {/* Client Context */}
            <div style={{ marginBottom: '12mm' }}>
                <div style={{ background: '#f8fafc', padding: '6mm', borderRadius: '4mm', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 4mm 0', fontSize: '12pt', fontWeight: 900, color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '2mm' }}>DATOS DEL ESTUDIO</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4mm', fontSize: '10pt' }}>
                        <div>
                            <p style={{ margin: '2px 0' }}><strong>Titular:</strong> {form.clientName || 'Cliente Particular'}</p>
                            <p style={{ margin: '2px 0' }}><strong>CUPS:</strong> {form.cups || 'No proporcionado'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: '2px 0' }}><strong>Tarifa:</strong> {form.tariffType}</p>
                            <p style={{ margin: '2px 0' }}><strong>Suministro:</strong> {isGas ? 'Gas Natural' : 'Electricidad'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Savings Hero */}
            <div style={{ display: 'flex', gap: '10mm', marginBottom: '15mm' }}>
                <div style={{ flex: 1, padding: '9mm', background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', borderRadius: '6mm', color: 'white', textAlign: 'center', boxShadow: '0 15px 25px -8px rgba(37,99,235,0.35)' }}>
                    <p style={{ margin: 0, fontSize: '12pt', fontWeight: 800, opacity: 0.9, letterSpacing: '0.08em' }}>AHORRO TOTAL ANUAL</p>
                    <p style={{ margin: '2mm 0', fontSize: '40pt', fontWeight: 900 }}>{formatMoney(result.annualSavings)}€</p>
                    <p style={{ margin: 0, fontSize: '9pt', fontWeight: 600, opacity: 0.9 }}>Incluye impuestos y cargos fijos</p>
                </div>
            </div>

            {/* Comparative Breakdown */}
            <div style={{ marginBottom: '15mm' }}>
                <h3 style={{ fontSize: '12pt', fontWeight: 900, marginBottom: '5mm', color: '#1e293b' }}>COMPARATIVA ECONÓMICA</h3>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, borderRadius: '4mm', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                            <th style={{ textAlign: 'left', padding: '12px 15px', fontSize: '10pt', borderBottom: '1px solid #e2e8f0' }}>Concepto</th>
                            <th style={{ textAlign: 'center', padding: '12px 15px', fontSize: '10pt', borderBottom: '1px solid #e2e8f0' }}>Situación Actual</th>
                            <th style={{ textAlign: 'center', padding: '12px 15px', fontSize: '10pt', borderBottom: '1px solid #e2e8f0', background: '#dbeafe', color: '#1e40af' }}>Propuesta Vivivan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '10pt' }}>Comercializadora</td>
                            <td style={{ textAlign: 'center', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '10pt' }}>Compañía Actual</td>
                            <td style={{ textAlign: 'center', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontWeight: 900, fontSize: '11pt', color: '#1d4ed8' }}>{result.supplier}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '10pt' }}>Producto</td>
                            <td style={{ textAlign: 'center', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '10pt' }}>Sin especificar</td>
                            <td style={{ textAlign: 'center', padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '10pt' }}>{result.productName}</td>
                        </tr>
                        <tr style={{ background: '#f8fafc' }}>
                            <td style={{ padding: '15px', fontWeight: 900, fontSize: '12pt' }}>TOTAL FACTURA ESTUDIO</td>
                            <td style={{ textAlign: 'center', padding: '15px', fontSize: '12pt', fontWeight: 700 }}>{formatMoney(form.currentBill)}€</td>
                            <td style={{ textAlign: 'center', padding: '15px', fontSize: '16pt', fontWeight: 900, color: '#1d4ed8', background: '#dbeafe' }}>{formatMoney(result.total)}€</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Technical Detail */}
            <div style={{ marginBottom: '15mm' }}>
                <h3 style={{ fontSize: '12pt', fontWeight: 900, marginBottom: '5mm', color: '#1e293b' }}>DESGLOSE TÉCNICO DE LA PROPUESTA</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8mm' }}>
                    <div style={{ padding: '5mm', border: '1px solid #f1f5f9', borderRadius: '3mm' }}>
                        <p style={{ margin: '0 0 3mm 0', fontWeight: 900, fontSize: '10pt', color: '#2563eb' }}>Precios de Energía (kWh)</p>
                        {Object.entries(result.preciosEnergia || {}).map(([p, v]) => (
                            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                <span>Periodo {p}:</span>
                                <span style={{ fontWeight: 700 }}>{formatMoney(v || 0, 6)}€</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: '5mm', border: '1px solid #f1f5f9', borderRadius: '3mm' }}>
                        <p style={{ margin: '0 0 3mm 0', fontWeight: 900, fontSize: '10pt', color: '#2563eb' }}>Precios de Potencia (kW/Día)</p>
                        {Object.entries(result.preciosPotencia || {}).map(([p, v]) => (
                            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                <span>Periodo {p}:</span>
                                <span style={{ fontWeight: 700 }}>{formatMoney(v || 0, 6)}€</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ marginTop: '8mm', padding: '5mm', border: '1px solid #f1f5f9', borderRadius: '3mm', background: '#f8fafc' }}>
                    <p style={{ margin: '0 0 3mm 0', fontWeight: 900, fontSize: '10pt', color: '#2563eb' }}>Orden de cálculo</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>Precio energía:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(energyCost, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>Precio potencia:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(powerCost, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>Subtotal energía + potencia:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(subtotalEnergiaPotencia, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>{isGas ? 'Impuesto gas:' : 'Impuesto eléctrico:'}</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(impuestoEnergia, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>Base tras impuesto energético:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(baseTrasImpuesto, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>Alquiler de equipos:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(rentalCost, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>Bono social:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(socialBonus, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>Otros costes:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(otherCosts, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '6px 0', borderTop: '1px solid #e2e8f0', marginTop: '2mm' }}>
                        <span>Base imponible antes de IVA:</span>
                        <span style={{ fontWeight: 800 }}>{formatMoney(baseImponible, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', padding: '2px 0' }}>
                        <span>IVA aplicado:</span>
                        <span style={{ fontWeight: 700 }}>{formatMoney(vatAmount, 2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', padding: '8px 0', borderTop: '1px solid #cbd5e1', marginTop: '2mm', fontWeight: 900, color: '#1d4ed8' }}>
                        <span>Total factura propuesta:</span>
                        <span>{formatMoney(totalPropuesta, 2)}€</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: '10mm', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                <p style={{ fontSize: '8pt', color: '#94a3b8', marginBottom: '4mm', textAlign: 'justify' }}>* Los ahorros presentados son estimaciones realizadas en función de los parámetros de consumo suministrados y las condiciones actuales de mercado. Soluciones Vivivan S.L. actúa como mediador independiente. Precios finales con impuestos aplicados según legislación vigente.</p>
                <div style={{ fontSize: '10pt', fontWeight: 900, color: '#0f172a' }}>
                    SOLUCIONES VIVIVAN · Inteligencia Energética al servicio del cliente
                </div>
                <div style={{ fontSize: '9pt', color: '#64748b', marginTop: '1mm' }}>
                    Calle Miguel Bueno 14, 29640 Fuengirola, Málaga · www.solucionesvivivan.es · contrataciones@solucionesvivivan.es
                </div>
            </div>
        </div>
    );
};
