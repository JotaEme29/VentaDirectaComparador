import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import { getPorcentajes } from '@core/comisiones'

export default function CommercialDashboardPage() {
    const cookieStore = cookies()
    const code = cookieStore.get('commercial_code')?.value

    if (!code || !getPorcentajes(code)) {
        redirect('/comercial')
    }

    return <DashboardClient commercialCode={code} />
}
