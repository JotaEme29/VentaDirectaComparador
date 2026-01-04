'use client';

import React, { useMemo, useState } from 'react';

import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '../ui';
import { PdfTemplate } from './PdfTemplate';
import { generateComparisonPdf } from '../../core/pdfService';
import { ResultadoTarifa, FormData } from '../../core/tipos';

interface PdfExportButtonProps {
    result: ResultadoTarifa;
    form: FormData;
    filename: string;
    variant?: 'primary' | 'outline' | 'secondary';
    children?: React.ReactNode;
    className?: string;
    iconOnly?: boolean;
    ariaLabel?: string;
    iconClassName?: string;
    iconColor?: string;
}

export const PdfExportButton = ({
    result,
    form,
    filename,
    variant = 'primary',
    children,
    className,
    iconOnly = false,
    ariaLabel,
    iconClassName,
    iconColor = '#2563eb'
}: PdfExportButtonProps) => {
    const [generating, setGenerating] = useState(false);
    const templateId = useMemo(() => `pdf-template-${Math.random().toString(36).substring(7)}`, []);

    const handleDownload = async () => {
        setGenerating(true);
        try {
            // Espera breve para que el template se pinte completo antes del snapshot
            await new Promise(resolve => setTimeout(resolve, 200));
            await generateComparisonPdf(templateId, filename);
        } catch (error) {
            console.error('Pdf error:', error);
            alert('Error al generar el PDF. Por favor, inténtalo de nuevo.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <>
            <Button
                aria-label={ariaLabel || 'Descargar PDF'}
                variant={variant}
                onClick={handleDownload}
                disabled={generating}
                className={`flex items-center justify-center gap-2 ${iconOnly ? 'px-3 w-11 h-11 rounded-xl' : ''} ${className ?? ''}`}
            >
                {generating ? (
                    <Loader2 className={`animate-spin ${iconClassName ?? ''}`} color={iconColor} size={18} strokeWidth={2.5} />
                ) : (
                    <FileDown className={iconClassName ?? ''} color={iconColor} size={18} strokeWidth={2.5} />
                )}
                {!iconOnly && (children || (generating ? 'Generando...' : 'Descargar PDF'))}
            </Button>

            {/* Hidden template in DOM for html2canvas */}
            <PdfTemplate id={templateId} result={result} form={form} />
        </>
    );
};
