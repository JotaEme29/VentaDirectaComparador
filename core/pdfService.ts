// core/pdfService.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Genera el PDF replicando el comportamiento legacy (Comparador Funcional OK!!/app.js):
 * - html2canvas con escala 2, fondo blanco, CORS permitido
 * - Imagen JPEG 0.95 con márgenes 10mm
 * - Soporte multipágina y marca de agua lateral
 */
export async function generateComparisonPdf(elementId: string, filename: string) {
    console.log('Generating PDF for element:', elementId);
    const element = document.getElementById(elementId);

    if (!element) {
        console.error('Element not found:', elementId);
        throw new Error('No se pudo encontrar el elemento para generar el PDF');
    }

    try {
        // Asegura que las imágenes estén cargadas antes de capturar
        const images = element.getElementsByTagName('img');
        await Promise.all(
            Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
            })
        );

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: true
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const targetWidth = pdfWidth - margin * 2;
        const targetHeight = pdfHeight - margin * 2;
        const scale = Math.min(targetWidth / canvas.width, targetHeight / canvas.height);
        const imgWidth = canvas.width * scale;
        const imgHeight = canvas.height * scale;
        const offsetX = margin + (targetWidth - imgWidth) / 2;
        const offsetY = margin + (targetHeight - imgHeight) / 2;

        // Ajustado para caber en una sola página
        pdf.addImage(imgData, 'JPEG', offsetX, offsetY, imgWidth, imgHeight);

        // Marca de agua lateral como en el legacy
        const firmaText = 'Comparativa y calculos realizados por Soluciones Vivivan SL';
        const firmaX = 8;
        const firmaY = pdfHeight / 2;
        const firmaOptions = { angle: 90, baseline: 'middle' as const };
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7);
        pdf.setTextColor(90, 90, 90);
        for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
            pdf.setPage(page);
            pdf.text(firmaText, firmaX, firmaY, firmaOptions);
        }

        pdf.save(filename);
        console.log('PDF saved successfully:', filename);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}
