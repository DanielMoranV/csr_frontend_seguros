import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useAuthStore } from '@/stores/authStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useMedicalRecordsStore } from '@/stores/medicalRecordsStore';
import { handleResponseMultipleNew, handleResponseMultipleUpdate } from './response';

const insurersStore = useInsurersStore();
const admissionsStore = useAdmissionsStore();
const medicalRecordsStore = useMedicalRecordsStore();
const invoicesStore = useInvoicesStore();
const authStore = useAuthStore();
export const classifyData = (dataSet) => {
    const seenRecords = new Map();
    const seenInsurers = new Map();
    const seenAdmissions = new Map();
    const seenInvoices = new Map();

    dataSet.forEach(
        ({ number_medical_record, name_patient, name_insurer, admission_number, attendance_date, attendance_hour, type_attention, name_doctor, amount_attention, number_invoice, company, invoice_date, number_payment, payment_date, biller }) => {
            // Registrar historia clínica
            if (!seenRecords.has(number_medical_record)) {
                seenRecords.set(number_medical_record, {
                    number: number_medical_record,
                    patient: name_patient
                });
            }

            // Registrar aseguradoras
            if (!seenInsurers.has(name_insurer)) {
                seenInsurers.set(name_insurer, { name: name_insurer });
            }

            // Registrar admisiones
            if (!seenAdmissions.has(admission_number)) {
                seenAdmissions.set(admission_number, {
                    number: admission_number,
                    attendance_date,
                    attendance_hour,
                    type: type_attention,
                    doctor: name_doctor,
                    amount: amount_attention,
                    invoice: number_invoice,
                    company,
                    insurer: name_insurer,
                    patient: name_patient,
                    status: number_invoice === null ? 'Pendiente' : payment_date === null ? 'Liquidado' : 'Pagado',
                    medical_record: number_medical_record
                });
            }

            // Registrar facturas
            if (number_invoice && number_invoice.trim() !== '' && !seenInvoices.has(number_invoice)) {
                seenInvoices.set(number_invoice, {
                    number: number_invoice,
                    issue_date: invoice_date,
                    biller,
                    amount: amount_attention,
                    status: number_payment ? 'Pagado' : 'Pendiente',
                    payment_date: payment_date ? payment_date : null,
                    admission_number
                });
            }
        }
    );

    // Convertir Map a Array
    return {
        seenRecords: Array.from(seenRecords.values()),
        seenInsurers: Array.from(seenInsurers.values()),
        seenAdmissions: Array.from(seenAdmissions.values()),
        seenInvoices: Array.from(seenInvoices.values())
    };
};

export const classifyDataDevolutions = async (dataSet) => {
    const seenDevolutions = new Map();
    let admissions = await admissionsStore.initializeStore();

    dataSet = dataSet.filter(({ admission_number }) => admissions.find((admission) => admission.number === admission_number));

    dataSet.forEach(({ date_devolution, period_devolution, invoice_number, insurer, amount_devolution, patient, admission_number, type_attention, biller, reason_devolution }) => {
        if (!seenDevolutions.has(invoice_number)) {
            seenDevolutions.set(invoice_number, {
                date: date_devolution,
                period: period_devolution,
                invoice_number,
                insurer,
                amount: amount_devolution,
                patient,
                admission_number,
                type: type_attention,
                biller,
                reason: reason_devolution
            });
        }
    });

    return { seenDevolutions: Array.from(seenDevolutions.values()) };
};

export const classifyDataSettlements = async (dataSet) => {
    const seenSettlements = new Map();
    let admissions = await admissionsStore.initializeStore();

    dataSet = dataSet.filter(({ admission_number }) => admissions.find((admission) => admission.number === admission_number));

    dataSet.forEach(({ biller, period, admission_number }) => {
        let admission = admissions.find((admission) => admission.number === admission_number);
        if (!seenSettlements.has(admission_number)) {
            seenSettlements.set(admission_number, { biller, period, admission_number, admission_id: admission?.id });
        }
    });

    return { seenSettlements: Array.from(seenSettlements.values()) };
};

export const classifyAdmissionsLists = async (dataSet) => {
    let user = authStore.getUser;
    const seenMedicalRecordsRequests = new Map();
    dataSet.forEach(({ biller, period, admission_number, medical_record_number, start_date, end_date }) => {
        // Registrar solicitud de historias
        if (!seenMedicalRecordsRequests.has(admission_number)) {
            seenMedicalRecordsRequests.set(admission_number, {
                admission_number,
                requester_nick: user?.nick ?? 'USER',
                medical_record_number: medical_record_number ?? null,
                request_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
                remarks: 'Lista periodo : ' + period,
                admissionList: {
                    admission_number,
                    period,
                    start_date,
                    end_date,
                    biller
                }
            });
        }
    });

    return {
        seenMedicalRecordsRequests: Array.from(seenMedicalRecordsRequests.values())
    };
};

export const classifyShipments = async (dataSet) => {
    // Obtener la fecha actual en formato MySQL (YYYY-MM-DD)
    const getCurrentDate = () => {
        const now = new Date();
        return now.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    };

    // Arrays para almacenar los envíos clasificados
    const newShipments = [];
    const updatedShipments = [];

    // Procesar cada envío en el dataSet
    dataSet.forEach((shipment) => {
        const { isNewShipment, trama_date, courier_date, email_verified_date, ...rest } = shipment;

        // Función para procesar una fecha
        const processDate = (dateValue) => {
            if (typeof dateValue === 'string' && dateValue.toLowerCase() === 'x') {
                return getCurrentDate(); // Asignar fecha actual si es "x" o "X"
            } else if (dateValue) {
                return null; // Eliminar el campo si tiene un valor distinto a "x" o "X"
            }
            return null; // Si está vacío, dejar como null
        };

        // Crear un nuevo objeto con las fechas procesadas
        const processedShipment = {
            ...rest,
            ...(processDate(trama_date) && { trama_date: processDate(trama_date) }),
            ...(processDate(courier_date) && { courier_date: processDate(courier_date) }),
            ...(processDate(email_verified_date) && { email_verified_date: processDate(email_verified_date) })
        };

        // Clasificar el envío en newShipments o updatedShipments
        if (isNewShipment === true) {
            newShipments.push(processedShipment);
        } else if (isNewShipment === false) {
            updatedShipments.push(processedShipment);
        }
    });
    // Retornar los envíos clasificados y procesados
    return {
        newShipments,
        updatedShipments
    };
};

export const getCurrentPeriod = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    return `${year}${month.toString().padStart(2, '0')}`;
};

export const getMesEnEspanol = (numeroMes) => {
    // iniciales de los meses
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    return meses[numeroMes - 1] || 'Mes inválido'; // Ajusta el índice (1-12 → 0-11)
};

export const getMonth = (date) => {
    return date.split('-')[1];
};
export const importSettlements = async (seenSettlements, settlementsStore, toast) => {
    let settlements = await settlementsStore.initializeStore();
    let settlementsData = seenSettlements;
    let existingSettlements = [];
    let newSettlements = [];

    settlementsData.forEach((settlement) => {
        const exists = settlements.some((existingSettlement) => existingSettlement.admission_id === settlement.admission_id);

        if (exists) {
            settlement.id = settlements.find((existingSettlement) => existingSettlement.admission_id === settlement.admission_id).id;
            existingSettlements.push(settlement);
        } else {
            newSettlements.push(settlement);
        }
    });
    const responseUpdate = await updateExistingRecords(existingSettlements, settlementsStore, toast);
    const responseNew = await createNewRecords(newSettlements, settlementsStore, toast);

    return { successComplete: responseUpdate.success && responseNew.success, countNew: responseNew.countSuccess, countUpdate: responseUpdate.countSuccess, countErrorNew: responseNew.countError, countErrorUpdate: responseUpdate.countError };
};

export const importMedicalRecords = async (seenRecords, medicalRecordsStore, toast) => {
    let medicalRecords = await medicalRecordsStore.initializeStore();
    let medicalRecordsData = seenRecords;
    let existingMedicalRecords = [];
    let newMedicalRecords = [];

    medicalRecordsData.forEach((medicalRecord) => {
        const exists = medicalRecords.some((existingMedicalRecord) => existingMedicalRecord.number === medicalRecord.number);

        if (exists) {
            existingMedicalRecords.push(medicalRecord);
        } else {
            newMedicalRecords.push(medicalRecord);
        }
    });

    const responseUpdate = await updateExistingRecords(existingMedicalRecords, medicalRecordsStore, toast);
    const responseNew = await createNewRecords(newMedicalRecords, medicalRecordsStore, toast);

    return { successComplete: responseUpdate.success && responseNew.success, countNew: responseNew.countSuccess, countUpdate: responseUpdate.countSuccess, countErrorNew: responseNew.countError, countErrorUpdate: responseUpdate.countError };
};

export const importInsurers = async (seenInsurers, insurersStore, toast) => {
    let insurers = await insurersStore.initializeStore();
    let insurersData = seenInsurers;
    let existingInsurers = [];
    let newInsurers = [];

    insurersData.forEach((insurer) => {
        const exists = insurers.some((existingInsurer) => existingInsurer.name === insurer.name);

        if (exists) {
            existingInsurers.push(insurer);
        } else {
            newInsurers.push(insurer);
        }
    });

    const responseUpdate = await updateExistingRecords(existingInsurers, insurersStore, toast);
    const responseNew = await createNewRecords(newInsurers, insurersStore, toast);

    return { successComplete: responseUpdate.success && responseNew.success, countNew: responseNew.countSuccess, countUpdate: responseUpdate.countSuccess, countErrorNew: responseNew.countError, countErrorUpdate: responseUpdate.countError };
};

export const importInvoices = async (seenInvoices, invoicesStore, toast) => {
    let invoices = await invoicesStore.initializeStore();
    let admissions = await admissionsStore.initializeStore();
    let invoicesData = seenInvoices;
    let existingInvoices = [];
    let newInvoices = [];
    invoicesData.forEach((invoice) => {
        const admission = admissions.find((admission) => admission.number === invoice.admission_number);
        invoice = {
            admission_id: admission?.id,
            ...invoice
        };
        const exists = invoices.some((existingInvoice) => existingInvoice.number === invoice.number);

        if (exists) {
            existingInvoices.push(invoice);
        } else {
            newInvoices.push(invoice);
        }
    });

    const responseUpdate = await updateExistingRecords(existingInvoices, invoicesStore, toast);
    const responseNew = await createNewRecords(newInvoices, invoicesStore, toast);

    await invoicesStore.fetchInvoices();

    return { successComplete: responseUpdate.success && responseNew.success, countNew: responseNew.countSuccess, countUpdate: responseUpdate.countSuccess, countErrorNew: responseNew.countError, countErrorUpdate: responseUpdate.countError };
};

export const importAdmissions = async (seenAdmissions, admissionsStore, toast) => {
    let admissions = await admissionsStore.initializeStore();
    let insurers = await insurersStore.initializeStore();
    let medicalRecords = await medicalRecordsStore.initializeStore();
    let admissionsData = seenAdmissions;
    let existingAdmissions = [];
    let newAdmissions = [];

    admissionsData.forEach((admission) => {
        const insurer = insurers.find((insurer) => insurer.name === admission.insurer);
        const medicalRecord = medicalRecords.find((medicalRecord) => medicalRecord.number === admission.medical_record);
        admission = {
            insurer_id: insurer?.id,
            medical_record_id: medicalRecord?.id,
            ...admission
        };
        const exists = admissions.some((existingAdmission) => existingAdmission.number === admission.number);

        if (exists) {
            existingAdmissions.push(admission);
        } else {
            newAdmissions.push(admission);
        }
    });

    const responseUpdate = await updateExistingRecords(existingAdmissions, admissionsStore, toast);
    const responseNew = await createNewRecords(newAdmissions, admissionsStore, toast);

    await admissionsStore.fetchAdmissions();

    return { successComplete: responseUpdate.success && responseNew.success, countNew: responseNew.countSuccess, countUpdate: responseUpdate.countSuccess, countErrorNew: responseNew.countError, countErrorUpdate: responseUpdate.countError };
};

export const importDevolutions = async (seenDevolutions, devolutionsStore, toast) => {
    let devolutions = await devolutionsStore.initializeStore();
    let admissions = await admissionsStore.initializeStore();
    let invoices = await invoicesStore.initializeStore();
    let devolutionsData = seenDevolutions;
    let existingDevolutions = [];
    let newDevolutions = [];

    devolutionsData.forEach((devolution) => {
        const invoice = invoices.find((invoice) => invoice.number === devolution.invoice_number);
        const admission = admissions.find((admission) => admission.number === devolution.admission_number);
        devolution = {
            invoice_id: invoice?.id,
            admission_id: admission?.id,
            status: invoice?.status || 'Pendiente',
            ...devolution
        };
        const exists = devolutions.some((existingDevolution) => existingDevolution.invoice_id === devolution.invoice_id);

        if (exists) {
            existingDevolutions.push(devolution);
        } else {
            newDevolutions.push(devolution);
        }
    });
    let payloadUpdateInvoices = existingDevolutions.map((devolution) => ({
        number: devolution.invoice_number,
        status: 'NC'
    }));
    await invoicesStore.updateMultiple(payloadUpdateInvoices);

    const responseUpdate = await updateExistingRecords(existingDevolutions, devolutionsStore, toast);
    const responseNew = await createNewRecords(newDevolutions, devolutionsStore, toast);

    return { successComplete: responseUpdate.success && responseNew.success, countNew: responseNew.countSuccess, countUpdate: responseUpdate.countSuccess, countErrorNew: responseNew.countError, countErrorUpdate: responseUpdate.countError };
};

// Función genérica para calcular totales
export const getTotal = (resumen, field) => {
    return resumen.reduce((sum, item) => sum + (item[field] || 0), 0);
};

const updateExistingRecords = async (records, store, toast) => {
    if (records.length === 0) return { countSuccess: 0, countError: 0, success: true };
    const results = { countSuccess: 0, countError: 0, success: true };

    for (let i = 0; i < records.length; i += 1000) {
        const batch = records.slice(i, i + 1000);
        const response = await handleResponseMultipleUpdate(batch, store, toast);
        results.countSuccess += response.countSuccess;
        results.countError += response.countError;
        results.success = results.success && response.success;
    }
    return results;
};

const createNewRecords = async (records, store, toast) => {
    if (records.length === 0) return { countSuccess: 0, countError: 0, success: true };
    const results = { countSuccess: 0, countError: 0, success: true };

    for (let i = 0; i < records.length; i += 1000) {
        const batch = records.slice(i, i + 1000);
        const response = await handleResponseMultipleNew(batch, store, toast);
        results.countSuccess += response.countSuccess;
        results.countError += response.countError;
        results.success = results.success && response.success;
    }
    return results;
};
