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

// Función para cargar el archivo Excel
export const loadExcelFile = async (file) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    return workbook.worksheets[0].getSheetValues();
};

// Función para validar los datos del archivo
export const validateData = (rows) => {
    if (rows.length < 3) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
        return false;
    }
    return true;
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
            payment_date: row[18] ? validateDate(row[18]) : null
        }));
    return dataSet;
};
export const validateDate = (date) => {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');

        // Verificar si la fecha contiene hora
        const hours = String(parsedDate.getHours()).padStart(2, '0');
        const minutes = String(parsedDate.getMinutes()).padStart(2, '0');

        // Si la hora es 00:00, devolver solo la fecha
        if (hours === '00' && minutes === '00') {
            return `${year}-${month}-${day}`;
        }
        // Devolver fecha con hora
        return `${year}-${month}-${day} ${hours}:${minutes}:00`;
    }
    return null;
};
