'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPorcentajes } from '@core/comisiones'

export async function verifyCommercialCode(prevState: any, formData: FormData) {
    const code = formData.get('code') as string

    if (!code) {
        return { error: 'Por favor, introduce un código.' }
    }

    const porcentajes = getPorcentajes(code)

    if (!porcentajes) {
        return { error: 'Código no válido.' }
    }

    // Set cookie valid for 30 days
    cookies().set('commercial_code', code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
    })

    redirect('/comercial/dashboard')
}

export async function logoutCommercial() {
    cookies().delete('commercial_code')
    redirect('/comercial')
}
