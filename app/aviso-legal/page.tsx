export default function AvisoLegalPage() {
    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 px-6 py-12">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-2">
                    <a href="/" className="inline-flex items-center gap-2 text-blue-600 font-black uppercase tracking-[0.2em] text-xs hover:text-blue-700">
                        ← Volver al inicio
                    </a>
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">Aviso Legal</p>
                    <h1 className="text-3xl font-black tracking-tighter">Aviso legal y condiciones de uso</h1>
                </div>
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 space-y-4 text-sm text-slate-700 leading-relaxed">
                    <p>Soluciones Vivivan S.L. · CIF/NIF: — · Domicilio: Calle Miguel Bueno 14, 29640 Fuengirola, Málaga.</p>
                    <p>Contacto: contrataciones@solucionesvivivan.es · www.solucionesvivivan.es.</p>
                    <p>El acceso y uso de esta web implica la aceptación de estas condiciones. La información mostrada no constituye oferta vinculante y puede variar según el mercado.</p>
                    <p>Queda prohibido el uso indebido de los contenidos, así como su reproducción sin autorización expresa.</p>
                </div>
            </div>
        </div>
    );
}
