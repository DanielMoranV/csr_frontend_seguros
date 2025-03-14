import { executeQuery } from '@/api';
import axios from 'axios';
import Swal from 'sweetalert2';

const ADMISIONES = 'SC0011';
const SERVICIOS = 'SC0006';
const EMPRESAS = 'SC0003';
const PACIENTES = 'SC0004';
const DEVOLUCIONES = 'SC0033';
const FACTURAS = 'SC0017';
const ASEGURADORAS = 'SC0002';
const LIQUIDACIONES = 'SC0012';
const FACTURAS_PAGADAS = 'SC0022';

const apiClient = axios.create({
    baseURL: 'http://127.0.0.1:8080',
    //baseURL: 'http://10.253.2.30:8080', // Cambia esta URL por la URL de tu API de FastAPI
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 3000000 // Ajusta el timeout en milisegundos (por ejemplo, 10000 ms = 10 segundos)
});
const handleResponseMysql = (response) => {
    if (response.status >= 200 && response.status < 300) {
        return { data: response.data };
    } else {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
};
const handleResponse = (response) => {
    if (response.status >= 200 && response.status < 300) {
        return response.data;
    } else {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
};

const handleError = (error) => {
    console.error('API call error:', error);
    Swal.fire({
        title: 'Error',
        text: 'Error al procesar la solicitud: ' + error.message || 'Ocurrió un error inesperado',
        icon: 'error',
        confirmButtonText: 'Aceptar'
    });
    throw error;
};

function formatToMySQLDate(dateStr) {
    // Dividimos la cadena por el delimitador "-"
    const [month, day, year] = dateStr.split('-');

    // Reorganizamos los valores al formato "yyyy-mm-dd"
    return `${year}-${month}-${day}`;
}

export default {
    async devolutionsByInvoiceNumbers(invoiceNumbers) {
        const formattedInvoiceNumbers = invoiceNumbers.map((num) => `'${num}'`).join(', ');
        const query = `
            SELECT
            ${DEVOLUCIONES}.num_doc as number,
            ${DEVOLUCIONES}.id_dev as id,
            ${DEVOLUCIONES}.fh_dev as date_dev,
            ${PACIENTES}.nh_pac AS medical_record_number,
            ${DEVOLUCIONES}.nom_pac AS patient,
            ${DEVOLUCIONES}.per_dev as period_dev,
            ${DEVOLUCIONES}.num_fac as invoice_number,
            ${DEVOLUCIONES}.fec_fac as invoice_date,
            ${DEVOLUCIONES}.tot_fac as invoice_amount,
            ${DEVOLUCIONES}.nom_cia as insurer_name,
            ${DEVOLUCIONES}.fec_doc as attendance_date,
            ${DEVOLUCIONES}.nom_ser as doctor,
            ${DEVOLUCIONES}.tip_dev as type,
            ${DEVOLUCIONES}.mot_dev as reason,
            ${DEVOLUCIONES}.usu_dev as biller,
            last_invoice_data.date_last_invoice,
            last_invoice_data.last_invoice,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM ${FACTURAS_PAGADAS} AS check_admission
                    WHERE check_admission.num_doc = ${DEVOLUCIONES}.num_doc
                ) THEN TRUE
                ELSE FALSE
            END AS paid_admission
            FROM ${DEVOLUCIONES}
            LEFT JOIN (
                SELECT
                ${FACTURAS}.num_doc,
                MAX(${FACTURAS}.fec_fac) AS date_last_invoice,
                SUBSTRING_INDEX(GROUP_CONCAT(${FACTURAS}.num_fac ORDER BY ${FACTURAS}.fec_fac DESC), ',', 1) AS last_invoice
                FROM ${FACTURAS}
                GROUP BY ${FACTURAS}.num_doc
            ) AS last_invoice_data ON ${DEVOLUCIONES}.num_doc = last_invoice_data.num_doc
            INNER JOIN ${PACIENTES} ON ${DEVOLUCIONES}.cod_pac = ${PACIENTES}.cod_pac
            WHERE
            ${DEVOLUCIONES}.num_fac IN (${formattedInvoiceNumbers})
            ORDER BY ${DEVOLUCIONES}.num_doc DESC;
            `;
        try {
            const response = await executeQuery({ query });
            return handleResponseMysql(response);
        } catch (error) {
            return handleError(error);
        }
    },
    async devolutionsByRange(payload) {
        let { start_date, end_date } = payload;
        const mysqlStartDate = formatToMySQLDate(start_date);
        const mysqlEndDate = formatToMySQLDate(end_date);
        const query = `
                SELECT
                ${DEVOLUCIONES}.num_doc as number,
                ${DEVOLUCIONES}.id_dev as id,
                ${DEVOLUCIONES}.fh_dev as date_dev,
                ${PACIENTES}.nh_pac AS medical_record_number,
                ${DEVOLUCIONES}.nom_pac AS patient,
                ${DEVOLUCIONES}.per_dev as period_dev,
                ${DEVOLUCIONES}.num_fac as invoice_number,
                ${DEVOLUCIONES}.fec_fac as invoice_date,
                ${DEVOLUCIONES}.tot_fac as invoice_amount,
                ${ASEGURADORAS}.nom_cia as insurer_name,
                ${DEVOLUCIONES}.fec_doc as attendance_date,
                ${DEVOLUCIONES}.nom_pac as nom_pac,
                ${DEVOLUCIONES}.nom_ser as doctor,
                ${DEVOLUCIONES}.tip_dev as type,
                ${DEVOLUCIONES}.mot_dev as reason,
                ${DEVOLUCIONES}.usu_dev as biller,
                last_invoice_data.date_last_invoice,
                last_invoice_data.last_invoice,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM ${FACTURAS_PAGADAS} AS check_admission
                        WHERE check_admission.num_doc = ${DEVOLUCIONES}.num_doc
                    ) THEN TRUE
                    ELSE FALSE
                END AS paid_admission
                FROM ${DEVOLUCIONES}
                LEFT JOIN (
                    SELECT
                    ${FACTURAS}.num_doc,
                    MAX(${FACTURAS}.fec_fac) AS date_last_invoice,
                    SUBSTRING_INDEX(GROUP_CONCAT(${FACTURAS}.num_fac ORDER BY ${FACTURAS}.fec_fac DESC), ',', 1) AS last_invoice
                    FROM ${FACTURAS}
                    GROUP BY ${FACTURAS}.num_doc
                ) AS last_invoice_data ON ${DEVOLUCIONES}.num_doc = last_invoice_data.num_doc
                INNER JOIN ${PACIENTES} ON ${DEVOLUCIONES}.cod_pac = ${PACIENTES}.cod_pac
                LEFT JOIN ${ADMISIONES} ON ${ADMISIONES}.num_doc = ${DEVOLUCIONES}.num_doc
                LEFT JOIN ${ASEGURADORAS} ON LEFT(${ADMISIONES}.cod_emp, 2) = ${ASEGURADORAS}.cod_cia
                WHERE
                ${DEVOLUCIONES}.fec_doc BETWEEN STR_TO_DATE('${mysqlStartDate}', '%Y-%m-%d') AND STR_TO_DATE('${mysqlEndDate}', '%Y-%m-%d')
                AND ${ASEGURADORAS}.nom_cia <> 'PARTICULAR'
                AND ${ASEGURADORAS}.nom_cia <> 'PACIENTES PARTICULARES'
                ORDER BY ${DEVOLUCIONES}.id_dev DESC;
                `;
        try {
            const response = await executeQuery({ query });
            return handleResponseMysql(response);
        } catch (error) {
            return handleError(error);
        }
    },
    async admisionsByRange(payload) {
        let { start_date, end_date } = payload;
        const mysqlStartDate = formatToMySQLDate(start_date);
        const mysqlEndDate = formatToMySQLDate(end_date);
        const query = `
            SELECT
                ${ADMISIONES}.num_doc AS number,
                ${ADMISIONES}.fec_doc AS attendance_date,
                ${ADMISIONES}.nom_pac AS patient,
                ${ADMISIONES}.hi_doc AS attendance_hour,
                ${ADMISIONES}.ta_doc AS type,
                ${ADMISIONES}.tot_doc AS amount,
                ${EMPRESAS}.nom_emp AS company,
                ${SERVICIOS}.nom_ser AS doctor,
                ${PACIENTES}.nh_pac AS medical_record_number,
                ${ADMISIONES}.clos_doc AS is_closed,
                ${FACTURAS}.num_fac AS invoice_number,
                ${FACTURAS}.fec_fac AS invoice_date,
                ${FACTURAS}.uc_sis AS biller,
                ${DEVOLUCIONES}.fh_dev AS devolution_date,
                ${ASEGURADORAS}.nom_cia AS insurer_name,
                ${FACTURAS_PAGADAS}.num_fac AS paid_invoice_number
            FROM
                ${ADMISIONES}
            LEFT JOIN ${SERVICIOS} ON ${ADMISIONES}.cod_ser = ${SERVICIOS}.cod_ser
            LEFT JOIN ${ASEGURADORAS} ON LEFT(${ADMISIONES}.cod_emp, 2) = ${ASEGURADORAS}.cod_cia
            LEFT JOIN ${EMPRESAS} ON ${ADMISIONES}.cod_emp = ${EMPRESAS}.cod_emp
            LEFT JOIN ${PACIENTES} ON ${ADMISIONES}.cod_pac = ${PACIENTES}.cod_pac
            LEFT JOIN ${DEVOLUCIONES} ON ${ADMISIONES}.num_doc = ${DEVOLUCIONES}.num_doc
            LEFT JOIN ${FACTURAS} ON ${ADMISIONES}.num_doc = ${FACTURAS}.num_doc
            LEFT JOIN ${FACTURAS_PAGADAS} ON ${FACTURAS}.num_doc = ${FACTURAS_PAGADAS}.num_doc
            WHERE
                ${ADMISIONES}.fec_doc BETWEEN STR_TO_DATE('${mysqlStartDate}', '%Y-%m-%d') AND STR_TO_DATE('${mysqlEndDate}', '%Y-%m-%d')
                AND ${ADMISIONES}.tot_doc >= 0
                AND ${ADMISIONES}.nom_pac <> ''
                AND ${ADMISIONES}.nom_pac <> 'No existe...'
                AND ${ASEGURADORAS}.cod_cia <> '90'
                AND ${ASEGURADORAS}.cod_cia <> '28'
                AND ${ASEGURADORAS}.cod_cia <> '37'
            ORDER BY
                ${ADMISIONES}.num_doc DESC;
        `;

        try {
            //const response = await apiClient.post(endpoint, { query });
            const response = await executeQuery({ query });
            //const response = await getAdmissionsByDateRange({ start_date: mysqlStartDate, end_date: mysqlEndDate });
            //return handleResponse(response);
            return handleResponseMysql(response);
        } catch (error) {
            return handleError(error);
        }
    },

    async admisionsByRangeDashboard(payload) {
        let { start_date, end_date } = payload;
        const mysqlStartDate = formatToMySQLDate(start_date);
        const mysqlEndDate = formatToMySQLDate(end_date);
        const query = `
            SELECT
                ${ADMISIONES}.num_doc AS number,
                ${ADMISIONES}.fec_doc AS attendance_date,
                ${ADMISIONES}.ta_doc AS type,
                ${ADMISIONES}.tot_doc AS amount,
                ${SERVICIOS}.nom_ser AS doctor,
                ${ADMISIONES}.clos_doc AS is_closed,
                ${FACTURAS}.num_fac AS invoice_number,
                ${FACTURAS}.fec_fac AS invoice_date,
                ${FACTURAS}.uc_sis AS biller,
                ${DEVOLUCIONES}.fh_dev AS devolution_date,
                ${ASEGURADORAS}.nom_cia AS insurer_name,
                ${FACTURAS_PAGADAS}.num_fac AS paid_invoice_number
            FROM
                ${ADMISIONES}
            LEFT JOIN ${SERVICIOS} ON ${ADMISIONES}.cod_ser = ${SERVICIOS}.cod_ser
            LEFT JOIN ${ASEGURADORAS} ON LEFT(${ADMISIONES}.cod_emp, 2) = ${ASEGURADORAS}.cod_cia
            LEFT JOIN ${DEVOLUCIONES} ON ${ADMISIONES}.num_doc = ${DEVOLUCIONES}.num_doc
            LEFT JOIN ${FACTURAS} ON ${ADMISIONES}.num_doc = ${FACTURAS}.num_doc
            LEFT JOIN ${FACTURAS_PAGADAS} ON ${FACTURAS}.num_doc = ${FACTURAS_PAGADAS}.num_doc
            WHERE
                ${ADMISIONES}.fec_doc BETWEEN STR_TO_DATE('${mysqlStartDate}', '%Y-%m-%d') AND STR_TO_DATE('${mysqlEndDate}', '%Y-%m-%d')
                AND ${ADMISIONES}.tot_doc >= 0
                AND ${ADMISIONES}.nom_pac <> ''
                AND ${ADMISIONES}.nom_pac <> 'No existe...'
                AND ${ASEGURADORAS}.nom_cia <> 'PARTICULAR'
                AND ${ASEGURADORAS}.nom_cia <> 'PACIENTES PARTICULARES'
            ORDER BY
                ${ADMISIONES}.num_doc DESC;
        `;

        try {
            //const response = await apiClient.post(endpoint, { query });
            const response = await executeQuery({ query });
            //const response = await getAdmissionsByDateRange({ start_date: mysqlStartDate, end_date: mysqlEndDate });
            //return handleResponse(response);
            return handleResponseMysql(response);
        } catch (error) {
            return handleError(error);
        }
    },
    async admisionsByNumberMySql(number) {
        const query = `
            SELECT ${ADMISIONES}.num_doc as number, ${ADMISIONES}.fec_doc as attendance_date, ${ADMISIONES}.nom_pac as patient,
                   ${ADMISIONES}.hi_doc as attendance_hour, ${ADMISIONES}.ta_doc as type, ${ADMISIONES}.tot_doc as amount,
                   ${EMPRESAS}.nom_emp as company, ${SERVICIOS}.nom_ser as doctor, ${PACIENTES}.nh_pac as medical_record_number,
                   ${ADMISIONES}.clos_doc as is_closed, ${FACTURAS}.num_fac as invoice_number, ${FACTURAS}.fec_fac as invoice_date,
                   ${FACTURAS}.uc_sis as biller, ${DEVOLUCIONES}.fh_dev as devolution_date, ${ASEGURADORAS}.nom_cia as insurer_name,
                   ${FACTURAS_PAGADAS}.num_fac as paid_invoice_number
            FROM ${ADMISIONES}
            LEFT JOIN ${SERVICIOS} ON ${ADMISIONES}.cod_ser = ${SERVICIOS}.cod_ser
            LEFT JOIN ${ASEGURADORAS} ON LEFT(${ADMISIONES}.cod_emp, 2) = ${ASEGURADORAS}.cod_cia
            LEFT JOIN ${EMPRESAS} ON ${ADMISIONES}.cod_emp = ${EMPRESAS}.cod_emp
            LEFT JOIN ${PACIENTES} ON ${ADMISIONES}.cod_pac = ${PACIENTES}.cod_pac
            LEFT JOIN ${DEVOLUCIONES} ON ${ADMISIONES}.num_doc = ${DEVOLUCIONES}.num_doc
            LEFT JOIN ${FACTURAS} ON ${ADMISIONES}.num_doc = ${FACTURAS}.num_doc
            LEFT JOIN ${FACTURAS_PAGADAS} ON ${FACTURAS}.num_doc = ${FACTURAS_PAGADAS}.num_doc
            WHERE ${ADMISIONES}.num_doc LIKE '%${number}%'
            ORDER BY ${ADMISIONES}.num_doc DESC; `;
        try {
            // const response = await apiClient.post(endpoint, { query });
            const response = await executeQuery({ query });
            //return handleResponse(response);
            return handleResponseMysql(response);
        } catch (error) {
            return handleError(error);
        }
    },
    async admisionsByNumber(number) {
        let endpoint = '/execute_query';
        const query = `
            SELECT ${ADMISIONES}.num_doc as number, ${ADMISIONES}.fec_doc as attendance_date, ${ADMISIONES}.nom_pac as patient,
                   ${ADMISIONES}.hi_doc as attendance_hour, ${ADMISIONES}.ta_doc as type, ${ADMISIONES}.tot_doc as amount,
                   ${EMPRESAS}.nom_emp as company, ${SERVICIOS}.nom_ser as doctor, ${PACIENTES}.nh_pac as medical_record_number,
                   ${ADMISIONES}.clos_doc as is_closed, ${FACTURAS}.num_fac as invoice_number, ${FACTURAS}.fec_fac as invoice_date,
                   ${FACTURAS}.uc_sis as biller, ${DEVOLUCIONES}.fh_dev as devolution_date, ${ASEGURADORAS}.nom_cia as insurer_name,
                   ${FACTURAS_PAGADAS}.num_fac as paid_invoice_number
            FROM ${ADMISIONES}
            LEFT JOIN ${SERVICIOS} ON ${ADMISIONES}.cod_ser = ${SERVICIOS}.cod_ser
            LEFT JOIN ${ASEGURADORAS} ON LEFT(${ADMISIONES}.cod_emp, 2) = ${ASEGURADORAS}.cod_cia
            LEFT JOIN ${EMPRESAS} ON ${ADMISIONES}.cod_emp = ${EMPRESAS}.cod_emp
            LEFT JOIN ${PACIENTES} ON ${ADMISIONES}.cod_pac = ${PACIENTES}.cod_pac
            LEFT JOIN ${DEVOLUCIONES} ON ${ADMISIONES}.num_doc = ${DEVOLUCIONES}.num_doc
            LEFT JOIN ${FACTURAS} ON ${ADMISIONES}.num_doc = ${FACTURAS}.num_doc
            LEFT JOIN ${FACTURAS_PAGADAS} ON ${FACTURAS}.num_doc = ${FACTURAS_PAGADAS}.num_doc
            WHERE ${ADMISIONES}.num_doc LIKE '%${number}%'
            ORDER BY ${ADMISIONES}.num_doc DESC; `;
        try {
            const response = await apiClient.post(endpoint, { query });
            return handleResponse(response);
        } catch (error) {
            return handleError(error);
        }
    },

    async admisionsByNumbers(numbers) {
        // Construcción de la consulta SQL con IN
        const buildQuery = (numbers) => `
                SELECT ${ADMISIONES}.num_doc as number, ${ADMISIONES}.fec_doc as attendance_date, ${ADMISIONES}.nom_pac as patient,
                    ${ADMISIONES}.hi_doc as attendance_hour, ${ADMISIONES}.ta_doc as type, ${ADMISIONES}.tot_doc as amount,
                    ${EMPRESAS}.nom_emp as company, ${SERVICIOS}.nom_ser as doctor, ${PACIENTES}.nh_pac as medical_record_number,
                    ${ADMISIONES}.clos_doc as is_closed, ${FACTURAS}.num_fac as invoice_number, ${FACTURAS}.fec_fac as invoice_date,
                    ${FACTURAS}.uc_sis as biller, ${DEVOLUCIONES}.fh_dev as devolution_date, ${ASEGURADORAS}.nom_cia as insurer_name,
                    ${DEVOLUCIONES}.num_fac as devolution_invoice_number,
                    ${FACTURAS_PAGADAS}.num_fac as paid_invoice_number
                FROM ${ADMISIONES}
                LEFT JOIN ${SERVICIOS} ON ${ADMISIONES}.cod_ser = ${SERVICIOS}.cod_ser
                LEFT JOIN ${ASEGURADORAS} ON LEFT(${ADMISIONES}.cod_emp, 2) = ${ASEGURADORAS}.cod_cia
                LEFT JOIN ${EMPRESAS} ON ${ADMISIONES}.cod_emp = ${EMPRESAS}.cod_emp
                LEFT JOIN ${PACIENTES} ON ${ADMISIONES}.cod_pac = ${PACIENTES}.cod_pac
                LEFT JOIN ${DEVOLUCIONES} ON ${ADMISIONES}.num_doc = ${DEVOLUCIONES}.num_doc
                LEFT JOIN ${FACTURAS} ON ${ADMISIONES}.num_doc = ${FACTURAS}.num_doc
                LEFT JOIN ${FACTURAS_PAGADAS} ON ${FACTURAS}.num_doc = ${FACTURAS_PAGADAS}.num_doc
                WHERE ${ADMISIONES}.num_doc IN (${numbers.map((num) => `'${num}'`).join(', ')})
                ORDER BY ${ADMISIONES}.num_doc DESC;
            `;

        try {
            // Dividir números en bloques pequeños si son demasiados
            const chunkSize = 1000; // Puedes ajustar este valor según el límite de tu configuración
            const chunks = [];
            for (let i = 0; i < numbers.length; i += chunkSize) {
                chunks.push(numbers.slice(i, i + chunkSize));
            }

            // Ejecutar las consultas en paralelo por bloques
            const results = await Promise.allSettled(
                chunks.map((chunk) =>
                    executeQuery({ query: buildQuery(chunk) })
                        .then((response) => handleResponse(response))
                        .catch((error) => ({ error, chunk }))
                )
            );
            // Procesar los resultados
            const successfulResults = results.filter((result) => result.status === 'fulfilled' && !result.value.error).map((result) => result.value);

            const errors = results.filter((result) => result.status === 'rejected' || result.value.error).map((result) => result.value.error || result.reason);

            // Mostrar alertas si hay errores
            if (errors.length > 0) {
                console.error('Errores detectados:', errors);
                Swal.fire({
                    title: 'Errores detectados',
                    text: `Se encontraron ${errors.length} errores. Revise la consola para más detalles.`,
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
            }

            return { results: successfulResults.flat(), errors };
        } catch (error) {
            console.error('Error en la consulta:', error);
            Swal.fire({
                title: 'Error crítico',
                text: 'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
                icon: 'error',
                confirmButtonText: 'Aceptar'
            });
            return { results: [], errors: [error] };
        }
    },
    async patientsByNumbers(numbers) {
        // Construcción de la consulta SQL con IN
        const buildQuery = (numbers) => `
            SELECT
                ${PACIENTES}.nh_pac as medical_record_number,
                ${PACIENTES}.nom_pac as patient,
                ${ASEGURADORAS}.nom_cia as insurer_name
            FROM ${PACIENTES}
            LEFT JOIN ${ASEGURADORAS} ON CAST(${PACIENTES}.id_cia AS UNSIGNED) = CAST(${ASEGURADORAS}.id_cia AS UNSIGNED)
            WHERE ${PACIENTES}.nh_pac IN (${numbers.map((num) => `'${num}'`).join(', ')})
            ORDER BY ${PACIENTES}.nh_pac DESC;
            `;
        try {
            // Dividir números en bloques pequeños si son demasiados
            const chunkSize = 1000; // Puedes ajustar este valor según el límite de tu configuración
            const chunks = [];
            for (let i = 0; i < numbers.length; i += chunkSize) {
                chunks.push(numbers.slice(i, i + chunkSize));
            }

            // Ejecutar las consultas en paralelo por bloques
            const results = await Promise.allSettled(
                chunks.map((chunk) =>
                    executeQuery({ query: buildQuery(chunk) })
                        .then((response) => handleResponse(response))
                        .catch((error) => ({ error, chunk }))
                )
            );
            // Procesar los resultados
            const successfulResults = results.filter((result) => result.status === 'fulfilled' && !result.value.error).map((result) => result.value);

            const errors = results.filter((result) => result.status === 'rejected' || result.value.error).map((result) => result.value.error || result.reason);

            // Mostrar alertas si hay errores
            if (errors.length > 0) {
                console.error('Errores detectados:', errors);
                Swal.fire({
                    title: 'Errores detectados',
                    text: `Se encontraron ${errors.length} errores. Revise la consola para más detalles.`,
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
            }

            return { results: successfulResults.flat(), errors };
        } catch (error) {
            console.error('Error en la consulta:', error);
            Swal.fire({
                title: 'Error crítico',
                text: 'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
                icon: 'error',
                confirmButtonText: 'Aceptar'
            });
            return { results: [], errors: [error] };
        }
    },
    async get(endpoint) {
        try {
            const response = await apiClient.get(endpoint);
            return handleResponse(response);
        } catch (error) {
            return handleError(error);
        }
    },

    async post(endpoint, data) {
        try {
            const response = await apiClient.post(endpoint, data);
            return handleResponse(response);
        } catch (error) {
            return handleError(error);
        }
    },

    async put(endpoint, data) {
        try {
            const response = await apiClient.put(endpoint, data);
            return handleResponse(response);
        } catch (error) {
            return handleError(error);
        }
    },

    async delete(endpoint) {
        try {
            const response = await apiClient.delete(endpoint);
            return handleResponse(response);
        } catch (error) {
            return handleError(error);
        }
    }
};
