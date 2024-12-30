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
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            // Obtener la configuración de la columna
            const columnConfig = columns[colNumber - 1];

            // Aplicar formato numérico si está definido
            if (columnConfig?.style?.numFmt) {
                cell.numFmt = columnConfig.style.numFmt;
            }

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

// Función para cargar el archivo Excel
export const loadExcelFile = async (file) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    return workbook.worksheets[0].getSheetValues();
};

// Función para validar los datos del archivo
export const validateData = (rows) => {
    if (rows.length < 3) {
        return false;
    }
    return true;
};

export const validateHeaders = (row, headers) => {
    // Comparar los encabezados con los valores de la fila
    const missingHeaders = headers.filter((header) => !row.includes(header));
    if (missingHeaders.length > 0) {
        return { success: false, missingHeaders: missingHeaders };
    }
    return { success: true };
};

export const processDataDatabaseDevolutions = (rows) => {
    const dataSetDevolutions = rows
        .slice(2)
        .filter((row) => row[11] != '')
        .map((row) => ({
            date_devolution: row[2] ? validateDate(row[2]) : null,
            period_devolution: row[3] ? row[3] : null,
            invoice_number: row[4] ? row[4] : null,
            insurer: row[6] ? row[6] : null,
            amount_devolution: row[7] ? row[7] : 0,
            patient: row[10] ? row[10] : null,
            admission_number: row[11] ? row[11] : null,
            type_attention: row[12] ? row[12] : null,
            biller: row[13] ? row[13] : null,
            reason_devolution: row[14] ? row[14] : null
        }));
    return dataSetDevolutions;
};

// Procesar Meta Liquidación
export const processDataDatabaseSettlements = (rows) => {
    const dataSetSettlements = rows
        .slice(2) // Omite las dos primeras filas
        .filter((row) => row[1] != '')
        .filter((row) => row[6])
        .filter((row) => row[7])
        .map((row) => ({
            admission_number: row[1],
            medical_record_number: row[2],
            biller: row[9],
            period: row[10],
            start_date: row[11] ? validateDate(row[11]) : null,
            end_date: row[12] ? validateDate(row[12]) : null
        }));
    return dataSetSettlements;
};

// Función para procesar los datos
export const processDataDatabase = (rows) => {
    const dataSet = rows
        .slice(2)
        .filter((row) => row[4] != '')
        .filter((row) => row[5] !== 'No existe...')
        .filter((row) => row[8] != '')
        .map((row) => ({
            admission_number: row[1],
            attendance_date: row[2] ? validateDate(row[2]) : null,
            attendance_hour: row[24] ? validateTime(row[24]) : null,
            number_medical_record: row[4] ? row[4] : null,
            name_patient: row[5] ? row[5] : null,
            company: row[7] ? row[7] : null,
            name_insurer: row[8] ? row[8] : null,
            type_attention: row[9] ? row[9] : null,
            name_doctor: row[10] ? row[10] : null,
            amount_attention: row[14] ? row[14] : 0,
            number_invoice: row[15] ? row[15] : null,
            invoice_date: row[16] ? validateDate(row[16]) : null,
            number_payment: row[17] ? row[17] : null,
            payment_date: row[18] ? validateDate(row[18]) : null,
            biller: row[25] ? row[25] : null
        }));
    return dataSet;
};
export const validateDate = (excelDate) => {
    if (excelDate instanceof Date && !isNaN(excelDate.getTime())) {
        // Obtener los valores de año, mes y día en UTC
        const year = excelDate.getUTCFullYear();
        const month = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(excelDate.getUTCDate()).padStart(2, '0');

        // Formatear la fecha sin hora
        const formattedDate = `${year}-${month}-${day}`;
        return formattedDate;
    }
    return null;
};

export const validateTime = (time) => {
    // Expresión regular para validar el formato HH:mm (24 horas)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

    // Verificar si la hora cumple con el formato
    if (timeRegex.test(time)) {
        return time; // Es válida, devolver la hora
    }

    return null; // No es válida, devolver null
};
