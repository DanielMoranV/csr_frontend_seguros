<script setup>
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useMedicalRecordsStore } from '@/stores/medicalRecordsStore';
import ExcelJS from 'exceljs';
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
        const workbook = new ExcelJS.Workbook();
        try {
            await workbook.xlsx.load(file);
            const worksheet = workbook.worksheets[0];
            const rows = worksheet.getSheetValues();

            if (rows.length < 3) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
                return;
            }

            const dataSet = rows
                .slice(2)
                .filter((row) => row[5] !== 'No existe...')
                .filter((row) => row[8] != null && row[8] !== '')
                .map((row) => ({
                    admission_number: row[1],
                    attendance_date: row[2] ? row[2] : null,
                    number_medical_record: row[4] ? row[4] : null,
                    name_patient: row[5] ? row[5] : null,
                    company: row[7] ? row[7] : null,
                    name_insurers: row[8] ? row[8] : null,
                    type_attention: row[9] ? row[9] : null,
                    name_doctor: row[10] ? row[10] : null,
                    amount_attention: row[14] ? row[14] : 0,
                    number_invoice: row[15] ? row[15] : null,
                    invoice_date: row[16] ? row[16] : null,
                    number_payment: row[17] ? row[17] : null,
                    payment_date: row[18] ? row[18] : null
                }));

            console.log(dataSet.length);

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

            console.log(existingAdmissions);
            console.log(newAdmissions);

            // Convertimos el Map a un array
            // medical_records.value = Array.from(seenRecords.values());
            // insurers.value = Array.from(seenInsurers.values());
            // admissions.value = Array.from(seenAdmissions.values());
            // invoices.value = Array.from(seenInvoices.values());
            // console.log(medical_records.value);
            // console.log(insurers.value);
            // console.log(invoices.value);
            // console.log(admissions.value);
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
