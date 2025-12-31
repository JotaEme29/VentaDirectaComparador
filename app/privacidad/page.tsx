export default function PrivacidadPage() {
    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 px-6 py-12">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-2">
                    <a href="/" className="inline-flex items-center gap-2 text-blue-600 font-black uppercase tracking-[0.2em] text-xs hover:text-blue-700">
                        ← Volver al inicio
                    </a>
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">Privacidad</p>
                    <h1 className="text-3xl font-black tracking-tighter">Política de privacidad</h1>
                </div>
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 space-y-4 text-sm text-slate-700 leading-relaxed">
                    <p>Soluciones Vivivan S.L. trata los datos de contacto para gestionar solicitudes y comparativas energéticas. Base legal: consentimiento del interesado.</p>
                    <p>Los datos no se ceden a terceros salvo obligación legal o para prestar el servicio solicitado. Puedes ejercer derechos de acceso, rectificación, supresión, oposición y portabilidad enviando un email a contrataciones@solucionesvivivan.es o a través de www.solucionesvivivan.es.</p>
                    <p>Conservamos los datos durante el tiempo necesario para la gestión de la solicitud y cumplimiento de obligaciones legales.</p>
                </div>
            </div>
        </div>
    );
}
