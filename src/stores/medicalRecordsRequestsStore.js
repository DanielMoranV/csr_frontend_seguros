import {
    createMedicalRecordsRequest,
    createMedicalRecordsRequests,
    deleteMedicalRecordsRequest,
    fetchMedicalRecordsRequests,
    fetchMedicalRecordsRequestsByDateRange,
    fetchMedicalRecordsRequestsByNumber,
    updateMedicalRecordsRequest,
    updateMedicalRecordsRequests
} from '@/api';
import FastApiService from '@/service/FastApiService';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useMedicalRecordsRequestsStore = defineStore('medicalRecordsRequestsStore', {
    state: () => ({
        medicalRecordsRequests: [],
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getMedicalRecordsRequests(state) {
            return state.medicalRecordsRequests;
        },
        getMessage(state) {
            return state.message;
        }
    },
    actions: {
        async initializeStore() {
            // Carga inicial desde IndexedDB
            this.loading = true;
            const medicalRecordsRequestsFromCache = await indexedDB.getItem('medicalRecordsRequests');
            this.medicalRecordsRequests = medicalRecordsRequestsFromCache || [];
            if (this.medicalRecordsRequests.length === 0) {
                await this.fetchMedicalRecordsRequests();
            }
            this.loading = false;
            return this.medicalRecordsRequests;
        },

        async fetchMedicalRecordsRequests() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchMedicalRecordsRequests(), this);
            if (this.success) {
                this.medicalRecordsRequests = data;
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            } else {
                this.medicalRecordsRequests = [];
            }
            return { success: this.success, data: this.medicalRecordsRequests };
        },

        async searchPatient(number) {
            this.loading = true;
            let { results, errors } = await FastApiService.patientsByNumbers([number]);
            console.log('errors', errors);
            this.loading = false;
            return results[0];
        },

        async fetchMedicalRecordsRequestsByDateRange(payload) {
            this.loading = true;

            const { data } = await handleResponseStore(fetchMedicalRecordsRequestsByDateRange(payload), this);

            if (this.success && Array.isArray(data)) {
                // Filtrar solo elementos válidos
                this.medicalRecordsRequests = data.filter((request) => request?.medical_record_number);

                // Extraer los números de historia clínica, eliminando ceros iniciales
                const patientsNumbers = this.medicalRecordsRequests.map((request) => request.medical_record_number?.replace(/^0+/, '') || '');

                // Verificar si hay números de pacientes válidos antes de la consulta
                if (patientsNumbers.length > 0) {
                    let { results, errors } = await FastApiService.patientsByNumbers(patientsNumbers);

                    // Imprimir errores si existen
                    if (errors?.length) {
                        console.error('Errores en la consulta a FastAPI:', errors);
                    }

                    // Asegurar que `results` es un array antes de procesarlo
                    if (Array.isArray(results)) {
                        const combinedArray = this.medicalRecordsRequests.map((request) => {
                            const patient = results.find((result) => result?.medical_record_number?.replace(/^0+/, '') === request?.medical_record_number?.replace(/^0+/, ''));
                            return { ...request, ...(patient || {}) }; // Combinar solo si se encuentra el paciente
                        });

                        // Filtrar datos sin `medical_record_number`
                        const filteredCombinedArray = combinedArray.filter((item) => item?.medical_record_number);

                        // Guardar en IndexedDB solo si hay datos válidos
                        if (filteredCombinedArray.length > 0) {
                            await indexedDB.setItem('medicalRecordsRequests', filteredCombinedArray);
                        }

                        this.medicalRecordsRequests = filteredCombinedArray;
                    }
                }
            } else {
                this.medicalRecordsRequests = [];
            }

            this.loading = false;
            return { success: this.success, data: this.medicalRecordsRequests };
        },
        async fetchMedicalRecordsRequestsByNumber(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(fetchMedicalRecordsRequestsByNumber(payload), this);
            if (this.success) {
                this.medicalRecordsRequests = data;

                const patientsNumbers = data.map((patientsList) => patientsList.medical_record_number.replace(/^0+/, ''));

                let { results, errors } = await FastApiService.patientsByNumbers(patientsNumbers);
                // Combinar los arrays
                console.log('errors', errors);
                // Combinar los arrays
                const combinedArray = data.map((request) => {
                    const patient = results.find((result) => result.medical_record_number.replace(/^0+/, '') === request.medical_record_number.replace(/^0+/, ''));
                    return { ...request, ...patient };
                });
                // Filtrar elementos sin coincidencia si es necesario
                const filteredCombinedArray = combinedArray.filter((item) => item.medical_record_number);
                await indexedDB.setItem('medicalRecordsRequests', filteredCombinedArray);
                this.medicalRecordsRequests = filteredCombinedArray;
            } else {
                this.medicalRecordsRequests = [];
            }
            this.loading = false;
            return { success: this.success, data: this.medicalRecordsRequests };
        },

        async createMedicalRecordsRequest(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createMedicalRecordsRequest(payload), this);
            if (this.success) {
                //this.medicalRecordsRequests.push(data);
                //await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
                this.message = 'Solicitud de historia clínica creada correctamente...';
            }
            return { success: this.success, data };
        },
        async updateMedicalRecordsRequest(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(updateMedicalRecordsRequest(payload, payload.id), this);
            // Agregar este log para depuración
            if (this.success) {
                // const index = this.medicalRecordsRequests.findIndex((medicalRecordsRequest) => medicalRecordsRequest.id === data.id);
                // if (index !== -1) {
                //     this.medicalRecordsRequests[index] = data;
                //     await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
                // } else {
                //     console.error('No se encontró el registro médico con el ID:', data.id); // Agregar este log para depuración
                // }
                this.medicalRecordsRequests = data;
                this.message = 'Solicitud de historia clínica actualizada correctamente...';
            }
            return { success: this.success, data: this.medicalRecordsRequests };
        },
        async deleteMedicalRecordsRequest(id) {
            this.loading = true;
            const { data } = await handleResponseStore(deleteMedicalRecordsRequest(id), this);
            if (this.success) {
                this.medicalRecordsRequests = this.medicalRecordsRequests.filter((medicalRecordsRequest) => medicalRecordsRequest.id !== id);
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            }
        },
        async createMultiple(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(createMedicalRecordsRequests(payload), this);
            if (this.success) {
                this.medicalRecordsRequests = this.medicalRecordsRequests.concat(data);
                await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
            }
            return { success: this.success, data: this.medicalRecordsRequests };
        },
        async updateMultiple(payload) {
            this.loading = true;
            const { data } = await handleResponseStore(updateMedicalRecordsRequests(payload), this);
            if (this.success) {
                this.medicalRecordsRequests = data;
                // await indexedDB.setItem('medicalRecordsRequests', this.medicalRecordsRequests);
                this.message = { type: 'success', text: 'Solicitudes de historias clínicas actualizadas correctamente...' };
            }
            return { status: this.success, success: data.success, error: data.errors };
        }
    }
});
