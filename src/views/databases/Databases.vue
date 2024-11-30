<script setup>
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useMedicalRecordsStore } from '@/stores/medicalRecordsStore';
import { loadExcelFile, processDataDatabase } from '@/utils/excelUtils';
import { useToast } from 'primevue/usetoast';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const toast = useToast();
const admissionsStore = useAdmissionsStore();
const insurersStore = useInsurersStore();
const invoicesStore = useInvoicesStore();
const medicalRecordsStore = useMedicalRecordsStore();

const value = ref(0);
let interval = null;
const admissions = ref([]);
const medical_records = ref([]);
const invoices = ref([]);
const insurers = ref([]);

function startProgress() {
    interval = setInterval(() => {
        let newValue = value.value + Math.floor(Math.random() * 10) + 1;
        if (newValue >= 100) {
            newValue = 100;
        }
        value.value = newValue;
    }, 2000);
}

function endProgress() {
    clearInterval(interval);
    interval = null;
}

// Importar Datos Excel
const onUpload = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        try {
            const rows = await loadExcelFile(file);

            if (rows.length < 3) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
                return;
            }

            const dataSet = processDataDatabase(rows);

            let seenRecords = new Map();
            let seenInsurers = new Map();
            let seenInvoices = new Map();
            let seenAdmissions = new Map();

            dataSet.forEach((current) => {
                if (!seenRecords.has(current.number_medical_record)) {
                    seenRecords.set(current.number_medical_record, {
                        number: current.number_medical_record,
                        patient: current.name_patient
                    });
                }

                if (!seenInsurers.has(current.name_insurers)) {
                    seenInsurers.set(current.name_insurers, {
                        insurers: current.name_insurers
                    });
                }
                if (!seenAdmissions.has(current.admission_number)) {
                    seenAdmissions.set(current.admission_number, {
                        number: current.admission_number,
                        attendance_date: current.attendance_date,
                        type: current.type_attention,
                        doctor: current.name_doctor,
                        amount: current.amount_attention,
                        invoice: current.number_invoice,
                        company: current.company,
                        insurers: current.name_insurers,
                        patient: current.name_patient,
                        status: current.number_invoice ? 'Liquidado' : 'Pendiente',
                        medical_record: current.number_medical_record
                    });
                }
                if (!seenInvoices.has(current.number_invoice)) {
                    seenInvoices.set(current.number_invoice, {
                        number: current.number_invoice,
                        issue_date: current.invoice_date,
                        amount: current.amount_attention,
                        status: current.number_payment ? 'Pagado' : 'Pendiente',
                        payment_date: current.payment_date,
                        admission_number: current.admission_number
                    });
                }
            });

            // Historias Clínicas
            let medicalRecordsData = Array.from(seenRecords.values());
            let existingMedicalRecords = [];
            let newMedicalRecords = [];

            medicalRecordsData.forEach((medicalRecord) => {
                const exists = medical_records.value.some((existingMedicalRecord) => existingMedicalRecord.number === medicalRecord.number);

                if (exists) {
                    existingMedicalRecords.push(medicalRecord);
                } else {
                    newMedicalRecords.push(medicalRecord);
                }
            });

            if (existingMedicalRecords.length > 0) {
                const { status, success, error } = await medicalRecordsStore.updateMultiple(existingMedicalRecords);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar los registros médicos', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Registros médicos actualizados correctamente', life: 3000 });
                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Registros médicos no actualizados', life: 3000 });
                }
            }
            if (newMedicalRecords.length > 0) {
                const { status, success, error } = await medicalRecordsStore.createMultiple(newMedicalRecords);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al crear los registros médicos', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Registros médicos creados correctamente', life: 3000 });
                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Registros médicos no creados', life: 3000 });
                }
            }

            // Aseguradoras
            let insurersData = Array.from(seenInsurers.values());
            let existingInsurers = [];
            let newInsurers = [];

            insurersData.forEach((insurer) => {
                const exists = insurers.value.some((existingInsurer) => existingInsurer.insurers === insurer.insurers);

                if (exists) {
                    existingInsurers.push(insurer);
                } else {
                    newInsurers.push(insurer);
                }
            });

            if (existingInsurers.length > 0) {
                const { status, success, error } = await insurersStore.updateMultiple(existingInsurers);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar las aseguradoras', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Aseguradoras actualizadas correctamente', life: 3000 });
                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Aseguradoras no actualizadas', life: 3000 });
                }
            }

            if (newInsurers.length > 0) {
                const { status, success, error } = await insurersStore.createMultiple(newInsurers);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al crear las aseguradoras', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Aseguradoras creadas correctamente', life: 3000 });
                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Aseguradoras no creadas', life: 3000 });
                }
            }

            // Admisiones

            let admissionsData = Array.from(seenAdmissions.values());
            let existingAdmissions = [];
            let newAdmissions = [];

            admissionsData.forEach((admission) => {
                const exists = admissions.value.some((existingAdmission) => existingAdmission.number === admission.number);

                if (exists) {
                    existingAdmissions.push(admission);
                } else {
                    newAdmissions.push(admission);
                }
            });

            if (existingAdmissions.length > 0) {
                const { status, success, error } = await admissionsStore.updateMultiple(existingAdmissions);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar las admisiones', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Admisiones actualizadas correctamente', life: 3000 });

                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Admisiones no actualizadas', life: 3000 });
                }
            }
            if (newAdmissions.length > 0) {
                const { status, success, error } = await admissionsStore.createMultiple(newAdmissions);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al crear las admisiones', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Admisiones creadas correctamente', life: 3000 });
                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Admisiones no creadas', life: 3000 });
                }
            }

            // Facturas

            let invoicesData = Array.from(seenInvoices.values());
            let existingInvoices = [];
            let newInvoices = [];

            invoicesData.forEach((invoice) => {
                const exists = invoices.value.some((existingInvoice) => existingInvoice.number === invoice.number);

                if (exists) {
                    existingInvoices.push(invoice);
                } else {
                    newInvoices.push(invoice);
                }
            });

            if (existingInvoices.length > 0) {
                const { status, success, error } = await invoicesStore.updateMultiple(existingInvoices);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar las facturas', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Facturas actualizadas correctamente', life: 3000 });
                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Facturas no actualizadas', life: 3000 });
                }
            }
            if (newInvoices.length > 0) {
                const { status, success, error } = await invoicesStore.createMultiple(newInvoices);
                if (!status) {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al crear las facturas', life: 3000 });
                } else {
                    toast.add({ severity: 'success', summary: 'Success', detail: success.length + ' Facturas creadas correctamente', life: 3000 });
                    toast.add({ severity: 'error', summary: 'Error', detail: error.length + ' Facturas no creadas', life: 3000 });
                }
            }
        } catch (error) {
            console.error('Error al procesar el archivo', error);
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar el archivo', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Formato de archivo no válido', life: 3000 });
    }
};

onMounted(async () => {
    startProgress();

    if (!admissionsStore.getAdmissions) {
        await admissionsStore.fetchAdmissions();
        admissions.value = admissionsStore.getAdmissions;
    }
    if (!insurersStore.getInsurers) {
        await insurersStore.fetchInsurers();
        insurers.value = insurersStore.getInsurers;
    }
    if (!invoicesStore.getInvoices) {
        await invoicesStore.fetchInvoices();
        invoices.value = invoicesStore.getInvoices;
    }
    if (!medicalRecordsStore.getMedicalRecords) {
        await medicalRecordsStore.fetchMedicalRecords();
        medical_records.value = medicalRecordsStore.getMedicalRecords;
    }
    console.log(admissions.value);
    console.log(insurers.value);
    console.log(invoices.value);
    console.log(medical_records.value);
});

onBeforeUnmount(() => {
    endProgress();
});
</script>
<template>
    <div class="card">
        <FileUpload mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Cargar base de datos" class="mr-2 inline-block" :auto="true" @select="onUpload($event)" />
        <div class="font-semibold text-xl mb-4">ProgressBar</div>
        <div class="flex flex-col md:flex-row gap-4">
            <div class="md:w-1/2">
                <ProgressBar :value="value"></ProgressBar>
            </div>
        </div>
    </div>
</template>
