import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    const body = await req.json();
    // TODO: guardar en BD o enviar email a contratos@
    console.log('Nuevo lead', body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
