export default function CookiesPage() {
    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 px-6 py-12">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-2">
                    <a href="/" className="inline-flex items-center gap-2 text-blue-600 font-black uppercase tracking-[0.2em] text-xs hover:text-blue-700">
                        ← Volver al inicio
                    </a>
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">Cookies</p>
                    <h1 className="text-3xl font-black tracking-tighter">Política de cookies</h1>
                </div>
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 space-y-4 text-sm text-slate-700 leading-relaxed">
                    <p>Usamos cookies técnicas necesarias para el funcionamiento del comparador y cookies analíticas anónimas para mejorar la experiencia.</p>
                    <p>Puedes configurar o bloquear las cookies desde las opciones de tu navegador. Al continuar navegando aceptas el uso de cookies según esta política.</p>
                    <p>Para más información o para ejercer tus derechos, escribe a contrataciones@solucionesvivivan.es o visita www.solucionesvivivan.es.</p>
                </div>
            </div>
        </div>
    );
}
