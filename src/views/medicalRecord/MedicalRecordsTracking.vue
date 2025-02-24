<script setup>
import { useAuthStore } from '@/stores/authStore';
import { useMedicalRecordsRequestsStore } from '@/stores/medicalRecordsRequestsStore';
import { dformat } from '@/utils/day';
import indexedDB from '@/utils/indexedDB';
import { FilterMatchMode } from '@primevue/core/api';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onBeforeMount, onMounted, ref } from 'vue';

const toast = useToast();
const confirm = useConfirm();
const medicalRecordsRequestsStore = useMedicalRecordsRequestsStore();
const authStore = useAuthStore();
const medicalRecords = ref([]);
const medicalRecord = ref(null);
const newRequestDialog = ref(false);
const nickName = ref();
const position = ref();
const filters = ref(null);
const searchMedicalRecord = ref(null);
const starDate = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const endDate = ref(new Date());

function initFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
}
onBeforeMount(() => {
    initFilters();
});
function getStatusClass(status) {
    switch (status) {
        case 'Atendido':
            return 'status-tag status-atendido';
        case 'Pendiente':
            return 'status-tag status-pendiente';
        case 'Rechazado':
            return 'status-tag status-rechazado';
        case 'Devuelto':
            return 'status-tag status-devuelto';
        default:
            return 'status-tag';
    }
}
function clearFilter() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS }
    };
    initFilters();
}
onMounted(async () => {
    nickName.value = authStore.getNickName;
    position.value = authStore.getUser.position;
    const payload = {
        from: dformat(starDate.value, 'YYYY-MM-DD'),
        to: dformat(new Date(endDate.value.setHours(23, 0, 0, 0)), 'YYYY-MM-DD HH:mm:ss')
    };

    const responseMedicalRecords = await medicalRecordsRequestsStore.fetchMedicalRecordsRequestsByDateRange(payload);

    if (responseMedicalRecords.data) {
        medicalRecords.value = responseMedicalRecords.data;

        if (medicalRecords.value.length > 0) {
            medicalRecords.value.forEach((medicalRecord) => {
                medicalRecord.isConfirmedReceipt = !!medicalRecord.confirmed_receipt_date;
                medicalRecord.isConfirmedReturn = !!medicalRecord.confirmed_return_date;
            });
        }
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Datos cargados correctamente', life: 3000 });
    }
});

const searchMedicalRecordsByDate = async () => {
    let payload = {
        from: dformat(starDate.value, 'YYYY-MM-DD'),
        to: dformat(new Date(endDate.value.setHours(23, 0, 0, 0)), 'YYYY-MM-DD HH:mm:ss')
    };
    const { success, data } = await medicalRecordsRequestsStore.fetchMedicalRecordsRequestsByDateRange(payload);

    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
    } else {
        medicalRecords.value = data;
    }
};

const searchByMedicalRecord = async () => {
    //Validacion de numero de numero de historia
    if (searchMedicalRecord.value === '' || searchMedicalRecord.value === null) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Ingrese un número de admisión', life: 3000 });
        return;
    }
    const { success, data } = await medicalRecordsRequestsStore.fetchMedicalRecordsRequestsByNumber(searchMedicalRecord.value);
    if (!success) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar las admisiones', life: 3000 });
    } else {
        medicalRecords.value = data;
    }
};

const sendMedicalRecord = async (medicalRecord) => {
    let payload = {
        id: medicalRecord.id,
        status: 'Atendido',
        requested_nick: nickName.value,
        response_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        remarks: medicalRecord.remarks
    };
    let responseMedicalRecord = await medicalRecordsRequestsStore.updateMedicalRecordsRequest(payload);
    if (responseMedicalRecord.success) {
        let index = medicalRecords.value.findIndex((record) => record.id === medicalRecord.id);
        if (index !== -1) {
            medicalRecords.value[index] = {
                ...responseMedicalRecord.data,
                patient: medicalRecord.patient,
                insurer_name: medicalRecord.insurer_name
            };
            await indexedDB.setItem('medicalRecordsRequests', medicalRecords.value);
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar la historia clínica', life: 3000 });
            return;
        }
    }

    toast.add({ severity: 'success', summary: 'Confirmación', detail: 'Entrega de historia atendido', life: 3000 });
};

const confirmRejectMedicalRecord = (data) => {
    if (!data.remarks) {
        toast.add({ severity: 'error', summary: 'Rejected', detail: 'Detallar el motivo del rechazo en el campo OBSERVACIÓN', life: 3000 });
        return;
    }

    confirm.require({
        message: 'Motivo: ' + data.remarks,
        header: 'Rechazar Envío Historia',
        icon: 'pi pi-info-circle',
        rejectLabel: 'Cancelar',
        rejectProps: {
            label: 'Cancelar',
            severity: 'secondary',
            outlined: true
        },
        acceptProps: {
            label: 'Rechazar',
            severity: 'danger'
        },
        accept: async () => {
            let payload = {
                ...data,
                status: 'Rechazado',
                requested_nick: nickName.value,
                response_date: new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
            let responseMedicalRecord = await medicalRecordsRequestsStore.updateMedicalRecordsRequest(payload);
            if (responseMedicalRecord.success) {
                let index = medicalRecords.value.findIndex((record) => record.id === data.id);
                if (index !== -1) {
                    medicalRecords.value[index] = {
                        ...responseMedicalRecord.data,
                        patient: data.patient,
                        insurer_name: data.insurer_name
                    };
                    await indexedDB.setItem('medicalRecordsRequests', medicalRecords.value);
                } else {
                    toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar la historia clínica', life: 3000 });
                    return;
                }
            }

            toast.add({ severity: 'info', summary: 'Confirmación', detail: 'Entrega de historia rechazado', life: 3000 });
        },
        reject: () => {
            toast.add({ severity: 'error', summary: 'Cancelar', detail: 'Has cancelado la operación', life: 3000 });
        }
    });
};

const editRemarks = async (medicalRecord) => {
    let payload = {
        id: medicalRecord.id,
        remarks: medicalRecord.remarks
    };
    let responseMedicalRecord = await medicalRecordsRequestsStore.updateMedicalRecordsRequest(payload);
    if (responseMedicalRecord.success) {
        let index = medicalRecords.value.findIndex((item) => item.id === medicalRecord.id);
        medicalRecords.value[index].remarks = medicalRecord.remarks;
        await indexedDB.setItem('medicalRecordsRequests', medicalRecords.value);
        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Comentario actualizado correctamente', life: 3000 });
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar el comentario', life: 3000 });
    }
};
const searchPatient = async () => {
    let dataPatient = await medicalRecordsRequestsStore.searchPatient(medicalRecord.value.medical_record_number);

    medicalRecord.value = {
        ...dataPatient
    };
    if (!dataPatient) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se encontró el paciente', life: 3000 });
    }
};

const createNewRequest = () => {
    medicalRecord.value = {
        medical_record_number: ''
    };
    newRequestDialog.value = true;
};

const saveNewRequest = async () => {
    let payload = {
        requester_nick: nickName.value,
        medical_record_number: medicalRecord.value.medical_record_number,
        request_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        status: 'Pendiente',
        remarks: medicalRecord.value.remarks
    };
    let responseNewRequest = await medicalRecordsRequestsStore.createMedicalRecordsRequest(payload);
    newRequestDialog.value = false;
    if (responseNewRequest.success) {
        let newRequest = {
            id: responseNewRequest.data.id,
            request_date: responseNewRequest.data.request_date,
            requester_nick: responseNewRequest.data.requester_nick,
            status: 'Pendiente',
            patient: medicalRecord.value.patient,
            insurer_name: medicalRecord.value.insurer_name,
            medical_record_number: medicalRecord.value.medical_record_number,
            remarks: medicalRecord.value.remarks
        };
        medicalRecords.value.unshift(newRequest);
        await indexedDB.setItem('medicalRecordsRequests', medicalRecords.value);

        toast.add({ severity: 'success', summary: 'Éxito', detail: 'Solicitud enviada correctamente', life: 3000 });
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al enviar la solicitud', life: 3000 });
    }
};

const editConfirmedReceiptDate = async (medicalRecord) => {
    if (medicalRecord.isConfirmedReceipt) {
        //  asignar fecha y hora actual en formato para mysql
        const currentDate = new Date();
        const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`;
        medicalRecord.confirmed_receipt_date = formattedDate;
    } else {
        medicalRecord.confirmed_receipt_date = null;
    }

    let payload = {
        ...medicalRecord,
        confirmed_receipt_date: medicalRecord.confirmed_receipt_date
    };
    let responseMedicalRecord = await medicalRecordsRequestsStore.updateMedicalRecordsRequest(payload);

    if (responseMedicalRecord.success) {
        let index = medicalRecords.value.findIndex((item) => item.medical_record_number === medicalRecord.medical_record_number);
        if (index !== -1) {
            medicalRecords.value[index].medical_record_request = medicalRecord.medical_record_request;
            // modificar en indexedDB
            await indexedDB.setItem('admissionsLists', medicalRecords.value);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Confirmación de recepción de historia ' + medicalRecord.medical_record_number + ' actualizada correctamente', life: 3000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'No se encontró la solicitud de historia', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar la solicitud de historia', life: 3000 });
    }
};

const editConfirmedReturn = async (medicalRecord) => {
    if (medicalRecord.isConfirmedReturn) {
        //  asignar fecha y hora actual en formato para mysql
        const currentDate = new Date();
        const formattedDate = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')} ${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate.getSeconds().toString().padStart(2, '0')}`;
        medicalRecord.confirmed_return_date = formattedDate;
    } else {
        medicalRecord.confirmed_return_date = null;
    }

    let payload = {
        ...medicalRecord,
        confirmed_return_date: medicalRecord.confirmed_return_date,
        status: 'Devuelto'
    };
    medicalRecord.status = 'Devuelto';
    let responseMedicalRecord = await medicalRecordsRequestsStore.updateMedicalRecordsRequest(payload);

    if (responseMedicalRecord.success) {
        let index = medicalRecords.value.findIndex((item) => item.medical_record_number === medicalRecord.medical_record_number);
        if (index !== -1) {
            medicalRecords.value[index].medical_record_request = medicalRecord.medical_record_request;

            // modificar en indexedDB
            await indexedDB.setItem('admissionsLists', medicalRecords.value);
            toast.add({ severity: 'success', summary: 'Éxito', detail: 'Confirmación de devolución de historia ' + medicalRecord.medical_record_number + ' actualizada correctamente', life: 3000 });
        } else {
            toast.add({ severity: 'error', summary: 'Error', detail: 'No se encontró la solicitud de historia', life: 3000 });
        }
    } else {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar la solicitud de historia', life: 3000 });
    }
};
</script>
<template>
    <div class="card">
        <Toolbar class="mb-6">
            <template #start>
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="searchMedicalRecord" placeholder="N° Historia" />
                </IconField>
                <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchByMedicalRecord" />
            </template>

            <template #end>
                <DatePicker v-model="starDate" placeholder="Fecha Inicial" class="mr-2" />
                <DatePicker v-model="endDate" placeholder="Fecha Final" class="mr-2" />
                <Button label="Buscar" icon="pi pi-search" class="mr-2" @click="searchMedicalRecordsByDate" />
            </template>
        </Toolbar>
        <ConfirmDialog></ConfirmDialog>
        <DataTable
            ref="dt"
            :style="{ fontSize: '11px', fontFamily: 'Arial, sans-serif' }"
            :value="medicalRecords"
            dataKey="id"
            v-model:filters="filters"
            :loading="medicalRecordsRequestsStore.loading"
            :globalFilterFields="['admission_number', 'insurer_name', 'invoice_number', 'patient', 'medical_record_number', 'status', 'remarks', 'requested_nick', 'requester_nick', 'id']"
            :paginator="true"
            :rows="10"
            size="small"
            :rowsPerPageOptions="[5, 10, 20]"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} Historias Clínicas"
            editMode="cell"
        >
            <template #header>
                <div class="flex flex-wrap gap-2 items-center justify-between">
                    <h1 class="m-0">Gestión admisiones de seguro CSR</h1>

                    <Button type="button" icon="pi pi-filter-slash" label="Limpiar Filtros" outlined @click="clearFilter()" />
                    <Button type="button" severity="success" icon="pi pi-plus" label="Nueva Solicitud" @click="createNewRequest()" />
                    <IconField>
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="filters['global'].value" placeholder="Buscar..." />
                    </IconField>
                </div>
            </template>
            <template #empty> No hay datos. </template>
            <template #loading> Cargando datos. Por favor, espere. </template>
            <Column field="id" header="ID" sortable />
            <Column field="medical_record_number" header="N° Historia" sortable />
            <Column field="patient" header="Paciente" sortable />
            <Column field="insurer_name" header="Aseguradora" sortable />
            <Column field="requester_nick" header="Solicitante" sortable />
            <Column field="request_date" header="Fecha Solicitud" sortable>
                <template #body="slotProps">
                    {{ slotProps.data.request_date ? dformat(slotProps.data.request_date, 'DD/MM/YYYY HH:mm:ss') : '-' }}
                </template>
            </Column>
            <Column field="requested_nick" header="Respondido Por: " sortable />
            <Column field="response_date" header="Fecha Respuesta" sortable>
                <template #body="slotProps">
                    {{ slotProps.data.response_date ? dformat(slotProps.data.response_date, 'DD/MM/YYYY HH:mm:ss') : '-' }}
                </template>
            </Column>
            <Column field="remarks" header="Comentario" sortable>
                <template #body="slotProps">
                    {{ slotProps.data.remarks || '-' }}
                </template>
                <template #editor="slotProps">
                    <InputText v-model="slotProps.data.remarks" @blur="editRemarks(slotProps.data)" />
                </template>
            </Column>
            <Column field="isConfirmedReceipt" header="Confirm. Entr." sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.response_date">
                        <Checkbox :disabled="slotProps.data.isConfirmedReceipt || nickName !== slotProps.data.requester_nick" v-model="slotProps.data.isConfirmedReceipt" binary @blur="editConfirmedReceiptDate(slotProps.data)" />
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="isConfirmedReturn" header="Confirm. Dev. Exp." sortable>
                <template #body="slotProps">
                    <span v-if="slotProps.data.confirmed_receipt_date">
                        <Checkbox :disabled="slotProps.data.isConfirmedReturn || position !== 'ARCHIVO HISTORIAS'" v-model="slotProps.data.isConfirmedReturn" binary @blur="editConfirmedReturn(slotProps.data)" />
                    </span>
                    <span v-else>
                        <i class="pi pi-clock text-yellow-500"></i>
                    </span>
                </template>
            </Column>
            <Column field="status" header="Estado" sortable>
                <template #body="slotProps">
                    <span :class="getStatusClass(slotProps.data.status)">
                        {{ slotProps.data.status }}
                    </span>
                </template>
            </Column>
            <Column field="actions" header="Acciones" v-if="position === 'ARCHIVO HISTORIAS'">
                <template #body="slotProps">
                    <span v-if="slotProps.data.status == 'Pendiente'" class="flex gap-2">
                        <Button type="button" icon="pi pi-send" class="p-button-rounded p-button-outlined p-button-sm" @click="sendMedicalRecord(slotProps.data)" />
                        <Button type="button" icon="pi pi-times" class="p-button-rounded p-button-danger p-button-outlined p-button-sm" @click="confirmRejectMedicalRecord(slotProps.data)" />
                    </span>
                </template>
            </Column>
        </DataTable>
    </div>
    <Dialog v-model:visible="newRequestDialog" :style="{ width: '40vw' }" header="Añadir Solicitud de Historia" :modal="true" :closable="true">
        <div class="flex flex-col gap-6">
            <div style="display: flex; align-items: center; gap: 0.5rem">
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="medicalRecord.medical_record_number" placeholder="N° Historia Clínica" v-keyfilter.int autofocus />
                </IconField>
                <Button label="Buscar" icon="pi pi-search" class="ml-2" @click="searchPatient(medicalRecord.medical_record_number)" :loading="medicalRecordsRequestsStore.loading" />
            </div>
            <div>
                <label for="medical_record_number" class="block font-bold mb-3">N° Historia</label>
                <InputText id="medical_record_number" v-model.trim="medicalRecord.medical_record_number" required="true" fluid disabled />
            </div>
            <div>
                <label for="patient" class="block font-bold mb-3">Paciente</label>
                <InputText id="patient" v-model.trim="medicalRecord.patient" required="true" fluid disabled />
            </div>
            <div>
                <label for="insurer_name" class="block font-bold mb-3">Aseguradora</label>
                <InputText id="patient" v-model.trim="medicalRecord.insurer_name" required="true" fluid disabled />
            </div>
            <div>
                <label for="remarks" class="block font-bold mb-3">Comentario</label>
                <InputText id="remarks" v-model.trim="medicalRecord.remarks" fluid />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="newRequestDialog = false" />
            <Button label="Guardar" icon="pi pi-check" @click="saveNewRequest" />
        </template>
    </Dialog>
</template>
<style scoped>
.status-tag {
    padding: 0.2em 0.6em;
    border-radius: 0.25em;
    color: white;
    font-weight: bold;
}

.status-atendido {
    background-color: green;
}

.status-pendiente {
    background-color: orange;
}

.status-rechazado {
    background-color: red;
}

.status-devuelto {
    background-color: blue;
}
</style>
