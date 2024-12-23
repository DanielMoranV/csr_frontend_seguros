import axios from './axios';

// Auth
export const login = (payload) => axios.post('/auth/login', payload);
export const register = (payload) => axios.post('/auth/register', payload);
export const logout = () => axios.post('/auth/logout');
export const refresh = () => axios.post('/auth/refresh');
export const me = () => axios.post('/auth/me');

// Users
export const updateProfile = (payload, id) => axios.put(`/users/${id}`, payload);
export const uploadUsers = (payload) => axios.post('/users/upload', payload);
export const fetchUsers = () => axios.get('/users');
export const createUser = (payload) => axios.post('/users', payload);
export const deleteUser = (id) => axios.delete(`/users/${id}`);
export const updateUser = (payload, id) => axios.put(`/users/${id}`, payload);

// Medical Records
export const fetchMedicalRecords = () => axios.get('/medical-records');
export const createMedicalRecord = (payload) => axios.post('/medical-records', payload);
export const updateMedicalRecord = (payload, id) => axios.put(`/medical-records/${id}`, payload);
export const deleteMedicalRecord = (id) => axios.delete(`/medical-records/${id}`);
export const createMedicalRecords = (payload) => axios.post('/medical-records/store', payload);
export const updateMedicalRecords = (payload) => axios.patch('/medical-records/update', payload);
// Insurers
export const fetchInsurers = () => axios.get('/insurers');
export const createInsurer = (payload) => axios.post('/insurers', payload);
export const updateInsurer = (payload, id) => axios.put(`/insurers/${id}`, payload);
export const deleteInsurer = (id) => axios.delete(`/insurers/${id}`);
export const createInsurers = (payload) => axios.post('/insurers/store', payload);
export const updateInsurers = (payload) => axios.patch('/insurers/update', payload);

// Admissions
export const fetchAdmissions = () => axios.get('/admissions');
export const createAdmission = (payload) => axios.post('/admissions', payload);
export const updateAdmission = (payload, id) => axios.put(`/admissions/${id}`, payload);
export const deleteAdmission = (id) => axios.delete(`/admissions/${id}`);
export const createAdmissions = (payload) => axios.post('/admissions/store', payload);
export const updateAdmissions = (payload) => axios.patch('/admissions/update', payload);
export const fetchAdmissionsDateRange = (payload) => axios.post('/admissions/date-range', payload);
export const fetchAdmissionByNumber = (number) => axios.get(`/admissions/by-number/${number}`);

// Invoices
export const fetchInvoices = () => axios.get('/invoices');
export const createInvoice = (payload) => axios.post('/invoices', payload);
export const updateInvoice = (payload, id) => axios.put(`/invoices/${id}`, payload);
export const deleteInvoice = (id) => axios.delete(`/invoices/${id}`);
export const createInvoices = (payload) => axios.post('/invoices/store', payload);
export const updateInvoices = (payload) => axios.patch('/invoices/update', payload);

// Devolutions
export const fetchDevolutions = () => axios.get('/devolutions');
export const createDevolution = (payload) => axios.post('/devolutions', payload);
export const updateDevolution = (payload, id) => axios.put(`/devolutions/${id}`, payload);
export const deleteDevolution = (id) => axios.delete(`/devolutions/${id}`);
export const createDevolutions = (payload) => axios.post('/devolutions/store', payload);
export const updateDevolutions = (payload) => axios.patch('/devolutions/update', payload);
export const fetchDevolutionsDateRange = (payload) => axios.post('/devolutions/date-range', payload);

// Settlements
export const fetchSettlements = () => axios.get('/settlements');
export const createSettlement = (payload) => axios.post('/settlements', payload);
export const updateSettlement = (payload, id) => axios.put(`/settlements/${id}`, payload);
export const deleteSettlement = (id) => axios.delete(`/settlements/${id}`);
export const createSettlements = (payload) => axios.post('/settlements/store', payload);
export const updateSettlements = (payload) => axios.patch('/settlements/update', payload);
