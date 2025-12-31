'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '../ui';

const STORAGE_KEY = 'vivivan-cookie-consent';

export const CookieConsent = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (!stored) setVisible(true);
        } catch {
            setVisible(true);
        }
    }, []);

    const handleChoice = (choice: 'accepted' | 'rejected') => {
        try {
            window.localStorage.setItem(STORAGE_KEY, choice);
        } catch {
            // ignore storage errors
        }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[520px] bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/10 p-5 z-[9999]">
            <div className="flex items-start gap-3">
                <div className="text-2xl" aria-hidden>🍪</div>
                <div className="flex-1 space-y-2 text-sm text-slate-600">
                    <p className="font-bold text-slate-900 text-base leading-tight">Usamos cookies para mejorar tu experiencia.</p>
                    <p className="leading-relaxed">Empleamos cookies técnicas necesarias y analíticas anónimas. Puedes aceptar o rechazarlas y seguir navegando.</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" onClick={() => handleChoice('accepted')}>Aceptar</Button>
                        <Button size="sm" variant="outline" onClick={() => handleChoice('rejected')}>Rechazar</Button>
                        <a href="/cookies" className="text-[12px] font-semibold text-blue-700 underline underline-offset-4 ml-auto">Ver política</a>
                    </div>
                </div>
            </div>
        </div>
    );
};
