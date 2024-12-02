import { createUser, deleteUser, fetchUsers, updateProfileUser, updateUser, uploadUsers } from '@/api';
import indexedDB from '@/utils/indexedDB';
import { handleResponseStore } from '@/utils/response';
import { defineStore } from 'pinia';

export const useUsersStore = defineStore('userStore', {
    state: () => ({
        users: indexedDB.getItem('users'),
        user: indexedDB.getItem('user'),
        message: {},
        success: false,
        status: null,
        loading: false
    }),
    getters: {
        getUsers(state) {
            return state.users;
        },
        getUser(state) {
            return state.user;
        },
        getMsg(state) {
            return state.message;
        }
    },
    actions: {
        async fetchUsers() {
            this.loading = true;
            const { data } = await handleResponseStore(fetchUsers(), this);
            if (this.success) {
                data.forEach((user) => {
                    if (!user.role) {
                        user.role = { name: 'No Asignado' };
                    }

                    if (!user.company) {
                        user.company = { company_name: 'No Asignado' };
                    }
                });
                this.users = data;
                indexedDB.setItem('users', this.users);
            } else {
                this.users = [];
            }
            return this.success;
        },
        async createUser(payload) {
            this.loading = true;
            payload.password = payload.dni;
            payload.password_confirmation = payload.dni;
            const { data } = await handleResponseStore(createUser(payload), this);
            if (this.success) {
                this.user = data;
                this.users.push(data);
                this.message = 'Usuario creado correctamente';
                indexedDB.setItem('users', this.users);
            } else {
                this.user = null;
            }
            return this.success;
        },
        async uploadUsers(payload) {
            const dataUsers = payload.map((user) => ({
                dni: String(user.dni),
                name: user.name,
                phone: user.phone,
                email: user.email,
                password: String(user.dni),
                password_confirmation: String(user.dni),
                role: user.role
            }));

            const requestData = { users: dataUsers };
            const { data } = await handleResponseStore(uploadUsers(requestData), this);
            if (this.success) {
                data.success.forEach((element) => this.users.push(element));
                indexedDB.setItem('users', this.users);
                // let currentUser = authStore.getUser;
                // data.success.forEach(async (element) => {
                //     let parameters = {
                //         warehouse_id: currentUser.parameter.warehouse_id,
                //         sunat_send: currentUser.parameter.sunat_send,
                //         locked: true,
                //         company_id: currentUser.parameter.company_id,
                //         user_id: element.id
                //     };

                //     await parametersStore.createParameter(parameters);
                // });
            }
            return { status: this.success, success: data.success, errors: data.errors };
        },
        async updateUser(payload, id) {
            this.loading = true;
            const { data } = await handleResponseStore(updateUser(payload, id), this);
            if (this.success) {
                this.user = data;
                indexedDB.setItem('user', this.user);
                this.users = this.users.map((user) => (user.id === id ? data : user));
                indexedDB.setItem('users', this.users);
                this.message = 'Usuario actualizado correctamente';
            }
            return this.success;
        },
        async updateListUser(payload, id) {
            // Encuentra el índice del usuario en la lista de usuarios almacenada en `this.users`
            const userIndex = this.users.findIndex((user) => user.id === id);

            if (userIndex !== -1) {
                // Actualiza el usuario en `this.users` con los nuevos datos de `payload`
                this.users[userIndex] = {
                    ...this.users[userIndex], // Mantenemos las propiedades existentes
                    ...payload // Sobrescribimos solo las propiedades que están en `payload`
                };

                // También puedes actualizar el caché si es necesario
                indexedDB.setItem('users', this.users);
            }
        },
        async updateProfileUser(payload, id) {
            this.loading = true;
            const { data } = await handleResponseStore(updateProfileUser(payload, id), this);
            if (this.success) {
                indexedDB.setItem('user', data);
                this.user = data;
            }
            return this.success;
        },
        async deleteUser(id) {
            this.loading = true;
            const { data } = await handleResponseStore(deleteUser(id), this);
            if (this.success) {
                if (this.success) {
                    if (data == 'Usuario deshabilitado exitosamente') {
                        // Encuentra el usuario por id y actualiza la propiedad is_active a false
                        const userIndex = this.users.findIndex((user) => user.id === id);
                        if (userIndex !== -1) {
                            this.users[userIndex].is_active = false;
                        }
                        this.message = data;
                    } else {
                        // Eliminar el usuario del estado local si fue eliminado físicamente
                        this.users = this.users.filter((user) => user.id !== id);
                        this.message = 'Usuario eliminado exitosamente';
                    }
                    // Actualizar el caché con la lista de usuarios actualizada
                    indexedDB.setItem('users', this.users);
                }
            }
            return this.success;
        }
    }
});
