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

    // Generate unique file name with timestamp (YYYYMMDD_HHMMSSSSS)
    const timestamp = new Date()
        .toISOString()
        .replace(/[-T:.Z]/g, '')
        .slice(0, 17);
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
            medical_record_number: row[2] ? parseInt(row[2], 10) : null,
            biller: row[10],
            period: row[11],
            start_date: row[12] ? validateDate(row[12]) : null,
            end_date: row[13] ? validateDate(row[13]) : null
        }));
    return dataSetSettlements;
};

// Procesar los datos de la tabla de envíos
export const processDataDatabaseShipments = (rows) => {
    const dataSetShipments = rows
        .slice(2)
        .filter((row) => row[1] !== '')
        .filter((row) => row[11] != '')
        .filter((row) => row[15])
        .filter((row) => row[16])
        .filter((row) => row[17])
        .filter((row) => row[18])
        .filter((row) => row[20])
        .filter((row) => row[21])
        .map((row) => ({
            admission_number: row[1],
            invoice_number: row[11],
            isNewShipment: row[15]?.toLowerCase() === 'no' ? true : row[15]?.toLowerCase() === 'si' ? false : null,
            trama_date: row[16] ? row[16] : null,
            courier_date: row[17] ? row[17] : null,
            email_verified_date: row[18] ? row[18] : null,
            url_sustenance: row[19] ? (typeof row[19] === 'object' ? row[19].text || row[19].hyperlink || null : row[19]) : null,
            remarks: row[20] ? row[20] : null,
            verified_shipment_date: row[21] ? validateDate(row[21]) : null
        }));
    return dataSetShipments;
};

export const processDataDatabaseShipmentsAll = (rows) => {
    const dataSetShipments = rows
        .slice(2)
        .filter((row) => row[1] !== '')
        .filter((row) => row[2] != '')
        .filter((row) => row[3])
        .filter((row) => row[4])
        .filter((row) => row[5])
        .filter((row) => row[6])

        .map((row) => ({
            admission_number: row[1],
            invoice_number: row[2],
            isNewShipment: row[3]?.toLowerCase() === 'no' ? true : row[3]?.toLowerCase() === 'si' ? false : null,
            isNewShipment: false,
            trama_date: row[4] ? row[4] : null,
            courier_date: row[5] ? row[5] : null,
            email_verified_date: row[6] ? row[6] : null,
            url_sustenance: row[7] ? (typeof row[7] === 'object' ? row[7].text || row[7].hyperlink || null : row[7]) : null,
            remarks: row[8] ? row[8] : null,
            verified_shipment_date: row[9] ? validateDate(row[9]) : null
        }));
    return dataSetShipments;
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
