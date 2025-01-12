import Swal from 'sweetalert2';

export const handleResponseToast = (success, message, status, toast) => {
    if (success) {
        toast.add({ severity: 'success', summary: 'Éxito', detail: message, life: 3000 });
    } else if (status >= 400 && status <= 499) {
        toast.add({ severity: 'warn', summary: 'Advertencia', detail: message, life: 3000 });
    } else if (status >= 500) {
        toast.add({ severity: 'error', summary: 'Error', detail: message, life: 3000 });
    }
};

export const handleResponseMultipleNew = async (newRecords, store, toast) => {
    const { status, success, error } = await store.createMultiple(newRecords);
    let countSuccess = success.length;
    let countError = error.length;

    let message = store.getMessage;
    if (!status) {
        toast.add({ severity: 'error', summary: 'Error', detail: message, life: 3000 });
        return { success: false };
    } else {
        toast.add({ severity: 'success', summary: 'Success', detail: countSuccess + ' ' + message, life: 3000 });
        if (countError > 0) {
            toast.add({ severity: 'error', summary: 'Error', detail: countError + ' ' + 'Registros no creados', life: 3000 });
        }
    }
    return { success: true, countSuccess, countError };
};

export const handleResponseMultipleUpdate = async (updatedRecords, store, toast) => {
    const { status, success, error } = await store.updateMultiple(updatedRecords);
    let countSuccess = success.length;
    let countError = error.length;
    let message = store.getMessage;
    if (!status) {
        toast.add({ severity: 'error', summary: 'Error', detail: message, life: 3000 });
        return { success: false };
    } else {
        toast.add({ severity: 'success', summary: 'Success', detail: countSuccess + ' ' + message, life: 3000 });
        if (countError > 0) {
            toast.add({ severity: 'error', summary: 'Error', detail: countError + ' ' + message, life: 3000 });
        }
    }
    return { success: true, countSuccess, countError };
};

export async function handleResponseStore(promise, store) {
    try {
        const startTime = performance.now();
        const { data } = await promise;
        const endTime = performance.now();
        const requestTime = endTime - startTime;

        if (import.meta.env.VITE_DEBUG) {
            console.info('----MODO DEBUG----');
            console.log('data', data);
            // calcular en segundos
            console.log(`Tiempo de petición: ${requestTime / 1000} s`);
        }
        store.loading = false;
        store.message = 'Operación exitosa';
        store.success = true;
        store.status = 200;
        return { data };
    } catch (error) {
        if (import.meta.env.VITE_DEBUG) {
            console.info('----MODO DEBUG----');
            console.log('error', error.code);
            if (error.code === 'ERR_NETWORK') {
                Swal.fire({
                    title: 'Sin Conexión a red SISCLIN',
                    text: 'La consulta se ejecutará al respaldo en la nube',
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
            } else {
                Swal.fire({
                    title: 'Error',
                    text: error.message || 'Ocurrió un error inesperado',
                    icon: 'error',
                    confirmButtonText: 'Aceptar'
                });
            }
        }
        store.loading = false;
        store.message = error.message || 'Error desconocido';
        store.status = error.status_code || 500;
        store.success = false;
        return { data: null };
    }
}
