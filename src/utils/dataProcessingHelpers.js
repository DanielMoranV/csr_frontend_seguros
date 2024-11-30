export const classifyData = (rows, uniqueKey, formatFn) => {
    console.log(formatFn);
    const uniqueData = new Map();
    rows.forEach((row) => {
        const key = row[uniqueKey];
        if (!uniqueData.has(key)) {
            uniqueData.set(key, formatFn(row));
        }
    });
    return Array.from(uniqueData.values());
};

export const syncData = async (newData, existingData, store, entityName) => {
    console.log(entityName);
    const existing = [];
    const fresh = [];

    newData.forEach((item) => {
        const exists = existingData.some((existingItem) => existingItem.id === item.id);
        if (exists) {
            existing.push(item);
        } else {
            fresh.push(item);
        }
    });

    if (existing.length) {
        const { status, success, error } = await store.updateMultiple(existing);
        notifyResult(entityName, 'actualizadas', success, error, status);
    }
    if (fresh.length) {
        const { status, success, error } = await store.createMultiple(fresh);
        notifyResult(entityName, 'creadas', success, error, status);
    }
};

// Función para mostrar notificaciones de resultados
export const notifyResult = (entity, action, success, error, status) => {
    if (!status) {
        toast.add({ severity: 'error', summary: 'Error', detail: `Error al ${action} ${entity.toLowerCase()}`, life: 3000 });
    } else {
        if (success.length) {
            toast.add({ severity: 'success', summary: 'Éxito', detail: `${success.length} ${entity} ${action} correctamente`, life: 3000 });
        }
        if (error.length) {
            toast.add({ severity: 'error', summary: 'Error', detail: `${error.length} ${entity} no ${action}`, life: 3000 });
        }
    }
};

// Funciones para formatear datos
export const formatAdmission = (row) => ({
    admission_number: row.admission_number,
    attendance_date: row.attendance_date,
    type: row.type_attention,
    doctor: row.name_doctor,
    amount: row.amount_attention,
    invoice: row.number_invoice,
    company: row.company,
    insurers: row.name_insurers,
    patient: row.name_patient,
    status: row.number_invoice ? 'Liquidado' : 'Pendiente',
    medical_record: row.number_medical_record
});

export const formatMedicalRecord = (row) => ({
    number_medical_record: row.number_medical_record,
    patient: row.name_patient
});

export const formatInsurer = (row) => ({
    insurers: row.name_insurers
});

export const formatInvoice = (row) => ({
    number_invoice: row.number_invoice,
    issue_date: row.invoice_date,
    amount: row.amount_attention,
    status: row.number_payment ? 'Pagado' : 'Pendiente',
    payment_date: row.payment_date,
    admission_number: row.admission_number
});
