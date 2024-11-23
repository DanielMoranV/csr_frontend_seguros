export const handleResponseToast = (success, message, status, toast) => {
    if (success) {
        toast.add({ severity: 'success', summary: 'Éxito', detail: message, life: 3000 });
    } else if (status >= 400 && status <= 499) {
        toast.add({ severity: 'warn', summary: 'Advertencia', detail: message, life: 3000 });
    } else if (status >= 500) {
        toast.add({ severity: 'error', summary: 'Error', detail: message, life: 3000 });
    }
};

export async function handleResponseStore(promise, store) {
    try {
        const { data } = await promise;
        if (import.meta.env.VITE_DEBUG) {
            console.info('----MODO DEBUG----');
            console.log('data', data);
        }
        store.loading = false;
        store.message = 'Operación exitosa';
        store.success = true;
        store.status = 200;
        return { data };
    } catch (error) {
        if (import.meta.env.VITE_DEBUG) {
            console.info('----MODO DEBUG----');
            console.log('error', error);
        }
        store.loading = false;
        store.message = error.message || 'Error desconocido';
        store.status = error.status_code || 500;
        store.success = false;
        return { data: null };
    }
}
