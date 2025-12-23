'use server'

import { cookies } from 'next/headers'
import { getPorcentajes } from '@core/comisiones'
import { calcularComparativa } from '@core/calculoTarifas'
import { FormData } from '@core/tipos'

export async function calculateCommercialComparisonAction(formData: FormData) {
    const cookieStore = await cookies()
    const code = cookieStore.get('commercial_code')?.value

    if (!code) {
        throw new Error('No autorizado. Código comercial faltante.')
    }

    const porcentajes = getPorcentajes(code)

    if (!porcentajes) {
        throw new Error('Código comercial inválido o expirado.')
    }

    // Calculate using the percentages from the user's code
    const results = calcularComparativa(formData, porcentajes, {
        limit: 500,
        maxPerSupplier: 10
    })

    return results
}
