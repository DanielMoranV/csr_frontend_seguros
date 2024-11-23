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
