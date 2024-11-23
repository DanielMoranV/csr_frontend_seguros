import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportToExcel = async (columns, data, sheetName = 'Sheet1', fileName = 'Data.xlsx') => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Definir columnas y encabezados
    worksheet.columns = columns;

    // Agregar datos y aplicar estilos a las celdas
    data.forEach((item) => {
        const row = worksheet.addRow(item);

        // Aplicar estilo a las celdas de la fila
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { color: { argb: '000000' } }; // Color del texto
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'CCCCCC' } },
                left: { style: 'thin', color: { argb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
                right: { style: 'thin', color: { argb: 'CCCCCC' } }
            };
        });
    });

    // Aplicar estilo a las celdas de encabezado
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4F81BD' } // Color de fondo azul
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Generate unique file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    fileName = `${fileName}_${timestamp}.xlsx`;

    // Guardar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), fileName);
};
