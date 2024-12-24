import axios from 'axios';

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
    baseURL: 'http://localhost:8000', // Cambia esta URL por la URL de tu API de FastAPI
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 300000 // Ajusta el timeout en milisegundos (por ejemplo, 10000 ms = 10 segundos)
});

const handleResponse = (response) => {
    if (response.status >= 200 && response.status < 300) {
        return response.data;
    } else {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
};

const handleError = (error) => {
    console.error('API call error:', error);
    throw error;
};

export default {
    async admisionsByRange(payload) {
        let { start_date, end_date } = payload;
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
            WHERE ${ADMISIONES}.fec_doc BETWEEN ctod('${start_date}') AND ctod('${end_date}')
            AND ${ADMISIONES}.nom_pac <> ''
            AND ${ADMISIONES}.nom_pac <> 'No existe...'
            AND ${ASEGURADORAS}.nom_cia <> 'PARTICULAR'
            AND ${ASEGURADORAS}.nom_cia <> 'PACIENTES PARTICULARES'
            ORDER BY ${ADMISIONES}.num_doc DESC;
        `;

        try {
            const response = await apiClient.post(endpoint, { query });
            return handleResponse(response);
        } catch (error) {
            return handleError(error);
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
