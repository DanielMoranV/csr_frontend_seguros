import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useMedicalRecordsStore } from '@/stores/medicalRecordsStore';
import { handleResponseMultipleNew, handleResponseMultipleUpdate } from './response';

const insurersStore = useInsurersStore();
const admissionsStore = useAdmissionsStore();
const medicalRecordsStore = useMedicalRecordsStore();
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

export const classifyDataDevolutions = (dataSet) => {
    const seenDevolutions = new Map();

    dataSet.forEach(({ date_devolution, period_devolution, invoice_number, insurer, amount_devolution, patient, admission_number, type_attention, biller, reason_devolution }) => {
        if (!seenDevolutions.has(invoice_number)) {
            seenDevolutions.set(invoice_number, { date_devolution, period_devolution, invoice_number, insurer, amount_devolution, patient, admission_number, type_attention, biller, reason_devolution });
        }
    });

    return Array.from(seenDevolutions.values());
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
    let invoices = await invoicesStore.initializeStore();
    let admissions = await admissionsStore.initializeStore();
    let devolutionsData = seenDevolutions;
    let existingDevolutions = [];
    let newDevolutions = [];
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
