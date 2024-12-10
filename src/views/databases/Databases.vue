<script setup>
import { useAdmissionsStore } from '@/stores/admissionsStore';
import { useDevolutionsStore } from '@/stores/devolutionsStore';
import { useInsurersStore } from '@/stores/insurersStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useMedicalRecordsStore } from '@/stores/medicalRecordsStore';
import { classifyData, classifyDataDevolutions, importAdmissions, importDevolutions, importInsurers, importInvoices, importMedicalRecords } from '@/utils/dataProcessingHelpers';
import { loadExcelFile, processDataDatabase, processDataDatabaseDevolutions, validateData, validateHeaders } from '@/utils/excelUtils';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const toast = useToast();
const admissionsStore = useAdmissionsStore();
const insurersStore = useInsurersStore();
const invoicesStore = useInvoicesStore();
const medicalRecordsStore = useMedicalRecordsStore();
const devolutionsStore = useDevolutionsStore();

// Headers

const headersDevoluciones = [
    'id_dev', // Id de la devolución
    'fh_dev', // Fecha de la devolución
    'per_dev', // Persona que realizó la devolución
    'num_fac', // Número de factura
    'fec_fac', // Fecha de la factura
    'nom_cia', // Nombre de la compañía
    'tot_fac', // Total de la factura
    'ta_doc', // Tipo de documento
    'acc', // Aceptación de la devolución
    'nom_pac', // Nombre del paciente
    'num_doc', // Número de documento
    'tip_dev', // Tipo de devolución
    'usu_dev', // Usuario que realizó la devolución
    'motivo' // Motivo de la devolución
];

const headersAdmisionesGeneradas = [
    'num_doc', // Número de documento
    'fec_doc', // Fecha del documento
    'nh_pac', // Número de historia del paciente
    'nom_pac', // Nombre del paciente
    'nom_emp', // Nombre del empleado
    'nom_cia', // Nombre de la compañía
    'ta_doc', // Tipo de documento
    'nom_ser', // Nombre del servicio
    'tot_doc', // Total del documento
    'num_fac', // Número de factura
    'fec_fac', // Fecha de la factura
    'num_pag', // Número de pago
    'fec_pag', // Fecha del pago
    'hi_doc', // Hora de ingreso del documento
    'facturador' // Facturador
];

// Loaders
const admissionsLoader = ref(false);
const insurersLoader = ref(false);
const invoicesLoader = ref(false);
const medicalRecordsLoader = ref(false);
const devolutionsLoader = ref(false);
const isLoadingDevolutions = ref(false);

// Complete
const successMedicalRecords = ref(false);
const successDevolutions = ref(false);
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
const countNewDevolutions = ref(0);
const countUpdateDevolutions = ref(0);
const countErrorNewDevolutions = ref(0);
const countErrorUpdateDevolutions = ref(0);

const devolutions = ref([]);
const admissions = ref([]);
const medical_records = ref([]);
const invoices = ref([]);
const insurers = ref([]);
const isLoading = ref(false);

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
    countNewDevolutions.value = 0;
    countUpdateDevolutions.value = 0;
    countErrorNewDevolutions.value = 0;
    countErrorUpdateDevolutions.value = 0;

    // Reiniciar loaders
    medicalRecordsLoader.value = false;
    insurersLoader.value = false;
    admissionsLoader.value = false;
    invoicesLoader.value = false;
    devolutionsLoader.value = false;

    // Reiniciar successMedicalRecords
    successMedicalRecords.value = false;
    successDevolutions.value = false;
}

// Importar Datos Excel
const onUpload = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        isLoading.value = true;
        resetAllCounts();
        try {
            const rows = await loadExcelFile(file);
            const isValidHeaders = validateHeaders(rows[1], headersAdmisionesGeneradas);
            if (!isValidHeaders.success) {
                toast.add({ severity: 'error', summary: 'Error', detail: `Faltan las cabeceras: ${isValidHeaders.missingHeaders.join(', ')}`, life: 3000 });
                isLoading.value = false;
                return;
            }
            const isValidData = validateData(rows);
            const dataSet = processDataDatabase(rows);

            if (!isValidData || dataSet.length === 0) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
                isLoading.value = false;
                return;
            }
            const { seenRecords, seenInsurers, seenAdmissions, seenInvoices } = classifyData(dataSet);

            // Historias Clínicas
            medicalRecordsLoader.value = true;
            const responseMedicalRecords = await importMedicalRecords(seenRecords, medicalRecordsStore, toast);
            successMedicalRecords.value = responseMedicalRecords.successComplete;
            countNewMedicalRecords.value = responseMedicalRecords.countNew;
            countUpdateMedicalRecords.value = responseMedicalRecords.countUpdate;
            countErrorNewMedicalRecords.value = responseMedicalRecords.countErrorNew;
            countErrorUpdateMedicalRecords.value = responseMedicalRecords.countErrorUpdate;

            medical_records.value = await medicalRecordsStore.initializeStore();

            // Aseguradoras
            insurersLoader.value = true;
            const responseInsurers = await importInsurers(seenInsurers, insurersStore, toast);
            successInsurers.value = responseInsurers.successComplete;
            countNewInsurers.value = responseInsurers.countNew;
            countUpdateInsurers.value = responseInsurers.countUpdate;
            countErrorNewInsurers.value = responseInsurers.countErrorNew;
            countErrorUpdateInsurers.value = responseInsurers.countErrorUpdate;

            insurers.value = await insurersStore.initializeStore();

            // Admisiones
            admissionsLoader.value = true;
            const responseAdmissions = await importAdmissions(seenAdmissions, admissionsStore, toast);
            successAdmissions.value = responseAdmissions.successComplete;
            countNewAdmissions.value = responseAdmissions.countNew;
            countUpdateAdmissions.value = responseAdmissions.countUpdate;
            countErrorNewAdmissions.value = responseAdmissions.countErrorNew;
            countErrorUpdateAdmissions.value = responseAdmissions.countErrorUpdate;

            admissions.value = await admissionsStore.initializeStore();

            // Facturas
            invoicesLoader.value = true;
            const responseInvoices = await importInvoices(seenInvoices, invoicesStore, toast);
            successInvoices.value = responseInvoices.successComplete;
            countNewInvoices.value = responseInvoices.countNew;
            countUpdateInvoices.value = responseInvoices.countUpdate;
            countErrorNewInvoices.value = responseInvoices.countErrorNew;
            countErrorUpdateInvoices.value = responseInvoices.countErrorUpdate;

            invoices.value = await invoicesStore.initializeStore();
        } catch (error) {
            console.error('Error al procesar el archivo', error);
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar el archivo', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Formato de archivo no válido', life: 3000 });
    }
    isLoading.value = false;
};

const onUploadDevolutions = async (event) => {
    const file = event.files[0];
    if (file && file.name.endsWith('.xlsx')) {
        resetAllCounts();
        isLoadingDevolutions.value = true;
        try {
            const rows = await loadExcelFile(file);
            const isValidHeadersDevolutions = validateHeaders(rows[1], headersDevoluciones);
            if (!isValidHeadersDevolutions.success) {
                toast.add({ severity: 'error', summary: 'Error', detail: `Faltan las cabeceras: ${isValidHeadersDevolutions.missingHeaders.join(', ')}`, life: 3000 });
                return;
            }
            const isValidDataDevolutions = validateData(rows);

            const dataSetDevolutions = processDataDatabaseDevolutions(rows);

            if (!isValidDataDevolutions || dataSetDevolutions.length === 0) {
                toast.add({ severity: 'error', summary: 'Error', detail: 'El archivo no contiene suficientes datos', life: 3000 });
                return;
            }
            const { seenDevolutions } = await classifyDataDevolutions(dataSetDevolutions);

            // Devoluciones
            devolutionsLoader.value = true;
            const responseDevolutions = await importDevolutions(seenDevolutions, devolutionsStore, toast);

            successDevolutions.value = responseDevolutions.successComplete;
            countNewDevolutions.value = responseDevolutions.countNew;
            countUpdateDevolutions.value = responseDevolutions.countUpdate;
            countErrorNewDevolutions.value = responseDevolutions.countErrorNew;
            countErrorUpdateDevolutions.value = responseDevolutions.countErrorUpdate;

            devolutions.value = await devolutionsStore.initializeStore();
            await admissionsStore.fetchAdmissions();
        } catch (error) {
            console.error('Error al procesar el archivo', error);
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al procesar el archivo', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Formato de archivo no válido', life: 3000 });
    }
    isLoadingDevolutions.value = false;
};

onMounted(async () => {
    isLoading.value = true;
    insurers.value = await insurersStore.initializeStore();
    invoices.value = await invoicesStore.initializeStore();
    medical_records.value = await medicalRecordsStore.initializeStore();
    admissions.value = await admissionsStore.initializeStore();
    isLoading.value = false;
    isLoadingDevolutions.value = true;
    devolutions.value = await devolutionsStore.initializeStore();
    isLoadingDevolutions.value = false;
});
</script>
<template>
    <div class="grid grid-cols-12 gap-8">
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Admisiones</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ admissions.length }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-users text-blue-500 !text-xl"></i>
                    </div>
                </div>
                <span class="text-muted-color">Admisiones Generadas <i class="pi pi-file-excel ml-2"></i></span>
                <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Importar" class="w-full mr-2 mt-2 inline-block" :auto="true" @select="onUpload($event)" />
                <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                    <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                </div>
                <div v-if="medicalRecordsLoader" class="font-semibold text-xs mb-4 mt-4" :class="successMedicalRecords ? 'text-green-500' : 'text-red-500'">
                    Historias Clínicas <ProgressSpinner v-if="!successMedicalRecords" style="width: 10px; height: 10px" class="mr-2" />
                    <span class="text-xs text-gray-500">({{ medical_records.length }})</span>
                    <span v-if="successMedicalRecords" class="ml-5">
                        <i class="pi pi-check" aria-hidden="true"></i>
                    </span>
                    <span v-else class="ml-5">
                        <i class="pi pi-times" aria-hidden="true"></i>
                    </span>
                    <div class="mt-2">
                        <Tag v-if="successMedicalRecords" severity="success" class="mr-2 mt-2 text-xs"> {{ countNewMedicalRecords }} nuevos </Tag>
                        <Tag v-if="successMedicalRecords" severity="info" class="mr-2 mt-2 text-xs"> {{ countUpdateMedicalRecords }} actualizados </Tag>
                        <Tag v-if="!successMedicalRecords" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorNewMedicalRecords }} errores al crear </Tag>
                        <Tag v-if="!successMedicalRecords" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorUpdateMedicalRecords }} errores al actualizar </Tag>
                    </div>
                </div>
                <div v-if="insurersLoader" class="font-semibold text-xs mt-4 mb-4" :class="successInsurers ? 'text-green-500' : 'text-red-500'">
                    Aseguradoras <ProgressSpinner v-if="!successInsurers" style="width: 10px; height: 10px" class="mr-2" />
                    <span class="text-xs text-gray-500">({{ insurers.length }})</span>
                    <span v-if="successInsurers" class="ml-5">
                        <i class="pi pi-check" aria-hidden="true"></i>
                    </span>
                    <span v-else class="ml-5">
                        <i class="pi pi-times" aria-hidden="true"></i>
                    </span>
                    <div class="mt-2">
                        <Tag v-if="successInsurers" severity="success" class="mr-2 mt-2 text-xs"> {{ countNewInsurers }} nuevos </Tag>
                        <Tag v-if="successInsurers" severity="info" class="mr-2 mt-2 text-xs"> {{ countUpdateInsurers }} actualizados </Tag>
                        <Tag v-if="!successInsurers" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorNewInsurers }} errores al crear </Tag>
                        <Tag v-if="!successInsurers" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorUpdateInsurers }} errores al actualizar </Tag>
                    </div>
                </div>
                <div v-if="admissionsLoader" class="font-semibold text-xs mt-4 mb-4" :class="successAdmissions ? 'text-green-500' : 'text-red-500'">
                    Admisiones <ProgressSpinner v-if="!successAdmissions" style="width: 10px; height: 10px" />
                    <span class="text-xs text-gray-500">({{ admissions.length }})</span>
                    <span v-if="successAdmissions" class="ml-5">
                        <i class="pi pi-check" aria-hidden="true"></i>
                    </span>
                    <span v-else class="ml-5">
                        <i class="pi pi-times" aria-hidden="true"></i>
                    </span>
                    <div class="mt-2">
                        <Tag v-if="successAdmissions" severity="success" class="mr-2 mt-2 text-xs"> {{ countNewAdmissions }} nuevos </Tag>
                        <Tag v-if="successAdmissions" severity="info" class="mr-2 mt-2 text-xs"> {{ countUpdateAdmissions }} actualizados </Tag>
                        <Tag v-if="!successAdmissions" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorNewAdmissions }} errores al crear </Tag>
                        <Tag v-if="!successAdmissions" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorUpdateAdmissions }} errores al actualizar </Tag>
                    </div>
                </div>
                <div v-if="invoicesLoader" class="font-semibold text-xs mb-4" :class="successInvoices ? 'text-green-500' : 'text-red-500'">
                    Facturas <ProgressSpinner v-if="!successInvoices" style="width: 10px; height: 10px" />
                    <span class="text-xs text-gray-500">({{ invoices.length }})</span>
                    <span v-if="successInvoices" class="ml-5">
                        <i class="pi pi-check" aria-hidden="true"></i>
                    </span>
                    <span v-else class="ml-5">
                        <i class="pi pi-times" aria-hidden="true"></i>
                    </span>
                    <div class="mt-2">
                        <Tag v-if="successInvoices" severity="success" class="mr-2 mt-2 text-xs"> {{ countNewInvoices }} nuevos </Tag>
                        <Tag v-if="successInvoices" severity="info" class="mr-2 mt-2 text-xs"> {{ countUpdateInvoices }} actualizados </Tag>
                        <Tag v-if="!successInvoices" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorNewInvoices }} errores al crear </Tag>
                        <Tag v-if="!successInvoices" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorUpdateInvoices }} errores al actualizar </Tag>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Historias Clínicas</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ medical_records.length }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-history text-orange-500 !text-xl"></i>
                    </div>
                </div>
                <span class="text-muted-color">Exp. Particulares <i class="pi pi-file-excel ml-2"></i></span>
                <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Importar" class="w-full mr-2 mt-2 inline-block" :auto="true" @select="onUpload($event)" />
                <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                    <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                </div>
            </div>
        </div>
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Envios Facturas</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ invoices.length }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-cyan-100 dark:bg-cyan-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-send text-cyan-500 !text-xl"></i>
                    </div>
                </div>
                <span class="text-muted-color">Envios Facturas <i class="pi pi-file-excel ml-2"></i></span>
                <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Importar" class="w-full mr-2 mt-2 inline-block" :auto="true" @select="onUpload($event)" />
                <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                    <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                </div>
            </div>
        </div>
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Devoluciones</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">{{ devolutions.length }}</div>
                    </div>
                    <div class="flex items-center justify-center bg-purple-100 dark:bg-purple-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-ban text-red-500 !text-xl"></i>
                    </div>
                </div>
                <span class="text-muted-color">Devoluciones <i class="pi pi-file-excel ml-2"></i></span>
                <FileUpload v-if="!isLoadingDevolutions" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Importar" class="w-full mr-2 mt-2 inline-block" :auto="true" @select="onUploadDevolutions($event)" />
                <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoadingDevolutions">
                    <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                </div>
                <div v-if="devolutionsLoader" class="font-semibold text-xs mb-4 mt-4" :class="successDevolutions ? 'text-green-500' : 'text-red-500'">
                    Devoluciones <ProgressSpinner v-if="!successDevolutions" style="width: 10px; height: 10px" />
                    <span class="text-xs text-gray-500">({{ devolutions.length }})</span>
                    <span v-if="successDevolutions" class="ml-5">
                        <i class="pi pi-check" aria-hidden="true"></i>
                    </span>
                    <span v-else class="ml-5">
                        <i class="pi pi-times" aria-hidden="true"></i>
                    </span>
                    <div class="mt-2">
                        <Tag v-if="successDevolutions" severity="success" class="mr-2 mt-2 text-xs"> {{ countNewDevolutions }} nuevos </Tag>
                        <Tag v-if="successDevolutions" severity="info" class="mr-2 mt-2 text-xs"> {{ countUpdateDevolutions }} actualizados </Tag>
                        <Tag v-if="!successDevolutions" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorNewDevolutions }} errores al crear </Tag>
                        <Tag v-if="!successDevolutions" severity="danger" class="mr-2 mt-2 text-xs"> {{ countErrorUpdateDevolutions }} errores al actualizar </Tag>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">Notas de Crédito</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">152 Unread</div>
                    </div>
                    <div class="flex items-center justify-center bg-yellow-100 dark:bg-yellow-400/10 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-dollar text-yellow-500 !text-xl"></i>
                    </div>
                </div>
                <span class="text-muted-color">Notas de Crédito <i class="pi pi-file-excel ml-2"></i></span>
                <FileUpload v-if="!isLoading" mode="basic" accept=".xlsx" :maxFileSize="100000000" label="Importar" chooseLabel="Importar" class="w-full mr-2 mt-2 inline-block" :auto="true" @select="onUpload($event)" />
                <div class="mb-4 mt-2 w-full flex justify-center" v-if="isLoading">
                    <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" fill="transparent" animationDuration=".5s" aria-label="Custom ProgressSpinner" />
                </div>
            </div>
        </div>
    </div>
</template>
