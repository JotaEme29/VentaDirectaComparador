export default function ContactoPage() {
    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 px-6 py-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="mb-4">
                    <a href="/" className="inline-flex items-center gap-2 text-blue-600 font-black uppercase tracking-[0.2em] text-xs hover:text-blue-700">
                        ← Volver al inicio
                    </a>
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">Contacto</p>
                    <h1 className="text-4xl font-black tracking-tighter">Hablemos</h1>
                    <p className="text-slate-600">Envíanos tu consulta y te responderemos en minutos.</p>
                </div>

                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-bold text-slate-700">Email</p>
                            <p className="text-slate-600">contrataciones@solucionesvivivan.es</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700">Web</p>
                            <p className="text-slate-600">www.solucionesvivivan.es</p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="font-bold text-slate-700">Dirección</p>
                            <p className="text-slate-600">Calle Miguel Bueno 14, 29640 Fuengirola, Málaga</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
