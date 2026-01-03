import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        if (!process.env.SMTP_HOST) {
            return new Response(JSON.stringify({ ok: false, error: 'SMTP no configurado.' }), { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined
        });

        const {
            email,
            phone,
            supplier,
            productName,
            tariffType,
            savings,
            clientName,
            address,
            cups,
            region,
            energyType,
            invoiceFile,
            identityFile,
            contactMode
        } = await req.json();

        if (!email || !phone) {
            return new Response(JSON.stringify({ ok: false, error: 'Faltan datos de contacto.' }), { status: 400 });
        }

        const inbox = process.env.SALES_INBOX || 'contrataciones@solucionesvivivan.es';
        const from = process.env.SMTP_FROM || '"Soluciones Vivivan" <contrataciones@solucionesvivivan.es>';

        const subject = `Nueva solicitud de contratación - ${supplier ?? 'Proveedor'}`;

        const plain = [
            'Nueva solicitud de contratación recibida:',
            '',
            `Cliente: ${clientName || 'No indicado'}`,
            `Correo cliente: ${email}`,
            `Teléfono: ${phone}`,
            '',
            `Oferta: ${supplier || 'Proveedor'} - ${productName || 'Producto'}`,
            `Tarifa: ${tariffType || 'N/D'} (${energyType || 'N/D'})`,
            `Ahorro estimado anual: ${savings ?? 'N/D'} €`,
            '',
            `Dirección: ${address || 'No indicada'}`,
            `CUPS: ${cups || 'No indicado'}`,
            `Región: ${region || 'No indicada'}`,
            '',
            `Modalidad: ${contactMode === 'callback' ? 'Contacto del equipo' : 'Contratación directa'}`
        ].join('\n');

        const html = `
            <h2>Nueva solicitud de contratación</h2>
            <p><strong>Cliente:</strong> ${clientName || 'No indicado'}</p>
            <p><strong>Correo cliente:</strong> ${email}</p>
            <p><strong>Teléfono:</strong> ${phone}</p>
            <hr/>
            <p><strong>Oferta:</strong> ${supplier || 'Proveedor'} - ${productName || 'Producto'}</p>
            <p><strong>Tarifa:</strong> ${tariffType || 'N/D'} (${energyType || 'N/D'})</p>
            <p><strong>Ahorro estimado anual:</strong> ${savings ?? 'N/D'} €</p>
            <hr/>
            <p><strong>Dirección:</strong> ${address || 'No indicada'}</p>
            <p><strong>CUPS:</strong> ${cups || 'No indicado'}</p>
            <p><strong>Región:</strong> ${region || 'No indicada'}</p>
            <p style="margin-top:16px;">Modalidad: <strong>${contactMode === 'callback' ? 'Contacto del equipo' : 'Contratación directa'}</strong></p>
            <p style="margin-top:8px;">El cliente ha enviado los datos para gestionar la contratación.</p>
        `;

        const attachments: any[] = [];
        if (invoiceFile?.base64) {
            attachments.push({
                filename: invoiceFile.fileName || 'factura.pdf',
                content: Buffer.from(invoiceFile.base64, 'base64'),
                contentType: invoiceFile.mimeType || 'application/pdf'
            });
        }
        if (identityFile?.base64) {
            attachments.push({
                filename: identityFile.fileName || 'documento_identidad.pdf',
                content: Buffer.from(identityFile.base64, 'base64'),
                contentType: identityFile.mimeType || 'application/pdf'
            });
        }

        await transporter.sendMail({
            from,
            to: inbox,
            subject,
            text: plain,
            html,
            replyTo: email,
            attachments
        });

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
        console.error('Error enviando solicitud de contratación', err);
        return new Response(JSON.stringify({ ok: false, error: 'No se pudo enviar el correo.' }), { status: 500 });
    }
}
