import { NextResponse } from 'next/server';
import { calcularComparativa } from '../../../core/calculoTarifas';
import { FormData } from '../../../core/tipos';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);
        const form = body?.form as FormData | undefined;
        const limit = Number(body?.limit ?? 20) || 20;
        const includeNegative = Boolean(body?.includeNegative);

        if (!form) {
            return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 });
        }

        const resultados = calcularComparativa(form, { limit, includeNegative });
        return NextResponse.json({ ok: true, resultados });
    } catch (err: any) {
        console.error('Error en /api/calcular', err);
        return NextResponse.json({ ok: false, error: err?.message || 'Error interno' }, { status: 500 });
    }
}
