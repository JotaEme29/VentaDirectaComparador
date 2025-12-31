import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Permitimos variantes comunes de la variable para despliegues (Vercel/Docker)
const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ||
    (process.env as any).Gemini_Api_key || // compatibilidad solicitada
    process.env.GOOGLE_API_KEY ||
    '';

export async function POST(req: NextRequest) {
    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), { status: 500 });
    }
    try {
        const { fileName = 'factura.pdf', mimeType = 'application/pdf', base64 } = await req.json();
        if (!base64) throw new Error('Archivo no recibido');

        const payload = buildGeminiPayload({ fileName, mimeType, base64 });
        const result = await callGemini(payload);
        return new Response(JSON.stringify({ extracted: result }), { status: 200 });
    } catch (err: any) {
        const status = err?.status || 500;
        return new Response(JSON.stringify({ error: err?.message || 'Error interno' }), { status });
    }
}

function buildGeminiPayload({ fileName, mimeType, base64 }: { fileName: string; mimeType: string; base64: string }) {
    const prompt = [
        'Eres un extractor de datos de facturas de electricidad o gas en España.',
        'Lee SOLO las dos primeras páginas de la factura. Devuelve SOLO un JSON con estos campos (usa 0 cuando no haya dato):',
        '{ "energyType": "electricidad|gas", "tariffType": "2.0TD|3.0TD|6.1TD|GAS", "region": "PENINSULA|BALEARES|CANARIAS|CEUTA_MELILLA",',
        ' "clientName": "", "address": "", "cups": "", "billingDays": 0, "currentBill": 0, "cae": 0,',
        ' "consumption": {"P1":0,"P2":0,"P3":0,"P4":0,"P5":0,"P6":0}, "power": {"P1":0,"P2":0,"P3":0,"P4":0,"P5":0,"P6":0},',
        ' "equipmentRental": 0, "otherCosts": 0, "discountEnergy": 0, "discountPower": 0, "reactiveEnergy": 0, "excessPower": 0, "socialBonus": 0,',
        ' "gasMonthlyConsumption": 0, "gasFixedDaily": 0, "gasVariableKwh": 0, "gasTariffBand": "RL1|RL2|RL3|RL4|RL5" }',
        'Electricidad: 2.0TD usa P1-P3 consumo y P1-P2 potencia; 3.0TD/6.1TD usan P1-P6. Gas: rellena gasMonthlyConsumption, gasVariableKwh, gasFixedDaily.',
        'Incluye billingDays y currentBill (TOTAL con impuestos e IVA). otherCosts debe excluir impuestos e IVA.',
        `Archivo de referencia: ${fileName}.`
    ].join(' ');

    return {
        contents: [
            {
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType || 'application/pdf', data: base64 } }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
        }
    };
}

async function callGemini(payload: any) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        let msg = `Gemini error ${res.status}`;
        try {
            const err = await res.json();
            msg = err.error?.message || msg;
        } catch (e) {
            // ignore
        }
        const error: any = new Error(msg);
        error.status = res.status;
        throw error;
    }
    const json = await res.json();
    const textPart = (json.candidates?.[0]?.content?.parts || [])
        .map((p: any) => p.text)
        .find(Boolean);
    if (!textPart) throw new Error('Gemini no devolvió contenido');
    return parseGeminiJson(textPart);
}

function parseGeminiJson(text: string) {
    if (!text) throw new Error('Respuesta vacía de Gemini');
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (err) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error('No se pudo interpretar la respuesta de Gemini');
    }
}
