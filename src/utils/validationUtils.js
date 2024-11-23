export function validateDNI(dni) {
    return /^\d{8}$/.test(dni);
}
export function validateRUC(ruc) {
    return /^\d{11}$/.test(ruc);
}

export function validateEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}

export function validatePhone(phone) {
    return /^\d{9}$/.test(phone);
}

export function capitalizeName(name) {
    return name.replace(/\b\w/g, (char) => char.toUpperCase());
}
export function toUpperCaseText(text) {
    return text.toUpperCase();
}
export function padWithZeros(number) {
    return number.toString().padStart(8, '0');
}
export function restrictToNumbers(event) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
        event.preventDefault();
    }
}

export function findIndexById(id, array) {
    return array.findIndex((item) => item.id === id);
}

export function formatCurrency(value) {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2
    }).format(value);
}
