<script setup>
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useMedicalRecordsStore } from '@/stores/medicalRecordsStore';
import { classifyData, importAdmissions, importInsurers, importInvoices, importMedicalRecords } from '@/utils/dataProcessingHelpers';
import { loadExcelFile, processDataDatabase } from '@/utils/excelUtils';
import { useToast } from 'primevue/usetoast';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const toast = useToast();
const admissionsStore = useAdmissionsStore();
const insurersStore = useInsurersStore();
const invoicesStore = useInvoicesStore();
const medicalRecordsStore = useMedicalRecordsStore();

// Loaders
const admissionsLoader = ref(false);
const insurersLoader = ref(false);
const invoicesLoader = ref(false);
const medicalRecordsLoader = ref(false);

// Complete
const successMedicalRecords = ref(false);
// Counts
const countNewMedicalRecords = ref(0);
const countUpdateMedicalRecords = ref(0);
const countErrorNewMedicalRecords = ref(0);
const countErrorUpdateMedicalRecords = ref(0);
const successAdmissions = ref(false);
const countNewAdmissions = ref(0);
const countUpdateAdmissions = ref(0);
const countErrorNewAdmissions = ref(0);
const countErrorUpdateAdmissions = ref(0);
const successInvoices = ref(false);
const countNewInvoices = ref(0);
const countUpdateInvoices = ref(0);
const countErrorNewInvoices = ref(0);
const countErrorUpdateInvoices = ref(0);
const successInsurers = ref(false);
const countNewInsurers = ref(0);
const countUpdateInsurers = ref(0);
const countErrorNewInsurers = ref(0);
const countErrorUpdateInsurers = ref(0);

const value = ref(0);
let interval = null;
const admissions = ref([]);
const medical_records = ref([]);
const invoices = ref([]);
const insurers = ref([]);
const isLoading = ref(false);

function startProgress() {
    isLoading.value = true;
    value.value = 0; // Inicia desde 0
}
function updateProgress(increment) {
    value.value = Math.min(value.value + increment, 100); // Asegura que no supere 100
}
function endProgress() {
    value.value = 100; // Completa al 100%
    setTimeout(() => {
        isLoading.value = false; // Oculta la barra después de un tiempo
    }, 500);
}

function resetAllCounts() {
    // Reiniciar todos los contadores
    countNewMedicalRecords.value = 0;
    countUpdateMedicalRecords.value = 0;
    countErrorNewMedicalRecords.value = 0;
    countErrorUpdateMedicalRecords.value = 0;
    countNewAdmissions.value = 0;
    countUpdateAdmissions.value = 0;
    countErrorNewAdmissions.value = 0;
    countErrorUpdateAdmissions.value = 0;
    countNewInvoices.value = 0;
    countUpdateInvoices.value = 0;
    countErrorNewInvoices.value = 0;
    countErrorUpdateInvoices.value = 0;
    countNewInsurers.value = 0;
    countUpdateInsurers.value = 0;
    countErrorNewInsurers.value = 0;
    countErrorUpdateInsurers.value = 0;

    // Reiniciar loaders
    medicalRecordsLoader.value = false;
    insurersLoader.value = false;
    admissionsLoader.value = false;
    invoicesLoader.value = false;

    // Reiniciar successMedicalRecords
    successMedicalRecords.value = false;
}

// Importar Datos Excel
const onUpload = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        resetAllCounts();
        startProgress();
        const incrementProgress = 25;
        try {
            const rows = await loadExcelFile(file);

            if (rows.length < 3) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
                return;
            }

            const dataSet = processDataDatabase(rows);
            const { seenRecords, seenInsurers, seenAdmissions, seenInvoices } = classifyData(dataSet);

            // Historias Clínicas
            medicalRecordsLoader.value = true;
            const responseMedicalRecords = await importMedicalRecords(seenRecords, medicalRecordsStore, toast);
            successMedicalRecords.value = responseMedicalRecords.successComplete;
            countNewMedicalRecords.value = responseMedicalRecords.countNew;
            countUpdateMedicalRecords.value = responseMedicalRecords.countUpdate;
            countErrorNewMedicalRecords.value = responseMedicalRecords.countErrorNew;
            countErrorUpdateMedicalRecords.value = responseMedicalRecords.countErrorUpdate;

            updateProgress(incrementProgress);

            // Aseguradoras
            insurersLoader.value = true;
            const responseInsurers = await importInsurers(seenInsurers, insurersStore, toast);
            successInsurers.value = responseInsurers.successComplete;
            countNewInsurers.value = responseInsurers.countNew;
            countUpdateInsurers.value = responseInsurers.countUpdate;
            countErrorNewInsurers.value = responseInsurers.countErrorNew;
            countErrorUpdateInsurers.value = responseInsurers.countErrorUpdate;

            updateProgress(incrementProgress);

            // Admisiones
            admissionsLoader.value = true;
            const responseAdmissions = await importAdmissions(seenAdmissions, admissionsStore, toast);
            successAdmissions.value = responseAdmissions.successComplete;
            countNewAdmissions.value = responseAdmissions.countNew;
            countUpdateAdmissions.value = responseAdmissions.countUpdate;
            countErrorNewAdmissions.value = responseAdmissions.countErrorNew;
            countErrorUpdateAdmissions.value = responseAdmissions.countErrorUpdate;

            updateProgress(incrementProgress);

            // Facturas
            invoicesLoader.value = true;
            const responseInvoices = await importInvoices(seenInvoices, invoicesStore, toast);
            successInvoices.value = responseInvoices.successComplete;
            countNewInvoices.value = responseInvoices.countNew;
            countUpdateInvoices.value = responseInvoices.countUpdate;
            countErrorNewInvoices.value = responseInvoices.countErrorNew;
            countErrorUpdateInvoices.value = responseInvoices.countErrorUpdate;

            updateProgress(incrementProgress);
        } catch (error) {
            console.error('Error al procesar el archivo', error);
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar el archivo', life: 3000 });
        } finally {
            endProgress();
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Formato de archivo no válido', life: 3000 });
    }
};

onMounted(async () => {
    await admissionsStore.initializeStore();
    await insurersStore.initializeStore();
    await invoicesStore.initializeStore();
    await medicalRecordsStore.initializeStore();

    if (!admissionsStore.getAdmissions) {
        await admissionsStore.fetchAdmissions();
    }

    admissions.value = admissionsStore.getAdmissions;
    if (!insurersStore.getInsurers) {
        await insurersStore.fetchInsurers();
    }

    insurers.value = insurersStore.getInsurers;
    if (!invoicesStore.getInvoices) {
        await invoicesStore.fetchInvoices();
    }

    invoices.value = invoicesStore.getInvoices;
    if (!medicalRecordsStore.getMedicalRecords) {
        await medicalRecordsStore.fetchMedicalRecords();
    }
    medical_records.value = medicalRecordsStore.getMedicalRecords;
});

onBeforeUnmount(() => {
    endProgress();
});
</script>
<template>
    <div class="card">
        <FileUpload mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Admisiones Generadas" class="mr-2 inline-block" :auto="true" @select="onUpload($event)" :loading="isLoading" />
        <div class="mb-4" v-if="isLoading">
            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
        </div>

        <div class="flex flex-col md:flex-row gap-4">
            <div class="md:w-1/2">
                <ProgressBar v-if="isLoading" :value="value"></ProgressBar>
            </div>
        </div>
        <div v-if="medicalRecordsLoader" class="font-semibold text-md mb-4 mt-4" :class="successMedicalRecords ? 'text-green-500' : 'text-red-500'">
            Historias Clínicas <ProgressSpinner v-if="!successMedicalRecords" style="width: 10px; height: 10px" />
            <span class="text-sm text-gray-500">({{ medical_records.length }})</span>
            <span v-if="successMedicalRecords" class="ml-5">
                <i class="pi pi-check" aria-hidden="true"></i>
            </span>
            <span v-else class="ml-5">
                <i class="pi pi-times" aria-hidden="true"></i>
            </span>
            <div class="mt-2">
                <Tag v-if="successMedicalRecords" severity="success" class="mr-2"> {{ countNewMedicalRecords }} nuevos </Tag>
                <Tag v-if="successMedicalRecords" severity="info" class="mr-2"> {{ countUpdateMedicalRecords }} actualizados </Tag>
                <Tag v-if="!successMedicalRecords" severity="danger" class="mr-2"> {{ countErrorNewMedicalRecords }} errores al crear </Tag>
                <Tag v-if="!successMedicalRecords" severity="danger" class="mr-2"> {{ countErrorUpdateMedicalRecords }} errores al actualizar </Tag>
            </div>
        </div>
        <div v-if="insurersLoader" class="font-semibold text-md mt-4 mb-4" :class="successInsurers ? 'text-green-500' : 'text-red-500'">
            Aseguradoras <ProgressSpinner v-if="!successInsurers" style="width: 10px; height: 10px" />
            <span class="text-sm text-gray-500">({{ insurers.length }})</span>
            <span v-if="successInsurers" class="ml-5">
                <i class="pi pi-check" aria-hidden="true"></i>
            </span>
            <span v-else class="ml-5">
                <i class="pi pi-times" aria-hidden="true"></i>
            </span>
            <div class="mt-2">
                <Tag v-if="successInsurers" severity="success" class="mr-2"> {{ countNewInsurers }} nuevos </Tag>
                <Tag v-if="successInsurers" severity="info" class="mr-2"> {{ countUpdateInsurers }} actualizados </Tag>
                <Tag v-if="!successInsurers" severity="danger" class="mr-2"> {{ countErrorNewInsurers }} errores al crear </Tag>
                <Tag v-if="!successInsurers" severity="danger" class="mr-2"> {{ countErrorUpdateInsurers }} errores al actualizar </Tag>
            </div>
        </div>
        <div v-if="admissionsLoader" class="font-semibold text-md mt-4 mb-4" :class="successAdmissions ? 'text-green-500' : 'text-red-500'">
            Admisiones <ProgressSpinner v-if="!successAdmissions" style="width: 10px; height: 10px" />
            <span class="text-sm text-gray-500">({{ admissions.length }})</span>
            <span v-if="successAdmissions" class="ml-5">
                <i class="pi pi-check" aria-hidden="true"></i>
            </span>
            <span v-else class="ml-5">
                <i class="pi pi-times" aria-hidden="true"></i>
            </span>
            <div class="mt-2">
                <Tag v-if="successAdmissions" severity="success" class="mr-2"> {{ countNewAdmissions }} nuevos </Tag>
                <Tag v-if="successAdmissions" severity="info" class="mr-2"> {{ countUpdateAdmissions }} actualizados </Tag>
                <Tag v-if="!successAdmissions" severity="danger" class="mr-2"> {{ countErrorNewAdmissions }} errores al crear </Tag>
                <Tag v-if="!successAdmissions" severity="danger" class="mr-2"> {{ countErrorUpdateAdmissions }} errores al actualizar </Tag>
            </div>
        </div>
        <div v-if="invoicesLoader" class="font-semibold text-md mb-4" :class="successInvoices ? 'text-green-500' : 'text-red-500'">
            Facturas <ProgressSpinner v-if="!successInvoices" style="width: 10px; height: 10px" />
            <span class="text-sm text-gray-500">({{ invoices.length }})</span>
            <span v-if="successInvoices" class="ml-5">
                <i class="pi pi-check" aria-hidden="true"></i>
            </span>
            <span v-else class="ml-5">
                <i class="pi pi-times" aria-hidden="true"></i>
            </span>
            <div class="mt-2">
                <Tag v-if="successInvoices" severity="success" class="mr-2"> {{ countNewInvoices }} nuevos </Tag>
                <Tag v-if="successInvoices" severity="info" class="mr-2"> {{ countUpdateInvoices }} actualizados </Tag>
                <Tag v-if="!successInvoices" severity="danger" class="mr-2"> {{ countErrorNewInvoices }} errores al crear </Tag>
                <Tag v-if="!successInvoices" severity="danger" class="mr-2"> {{ countErrorUpdateInvoices }} errores al actualizar </Tag>
            </div>
        </div>
    </div>
</template>
