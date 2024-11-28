import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/dashboard',
            component: AppLayout,
            children: [
                {
                    path: '/dashboard',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/profile',
                    name: 'profile',
                    component: () => import('@/views/users/Profile.vue')
                },
                {
                    path: '/databases',
                    name: 'databases',
                    component: () => import('@/views/databases/Databases.vue')
                }
            ]
        },
        // {
        //     path: '/landing',
        //     name: 'landing',
        //     component: () => import('@/views/pages/Landing.vue')
        // },
        {
            path: '/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },

        {
            path: '/',
            name: 'login',
            component: () => import('@/views/auth/Login.vue')
        },
        {
            path: '/accessdenied',
            name: 'accessDenied',
            component: () => import('@/views/auth/Access.vue')
        },
        {
            path: '/error',
            name: 'error',
            component: () => import('@/views/auth/Error.vue')
        },
        {
            path: '/:catchAll(.*)',
            redirect: '/notfound'
        }
    ]
});

export default router;
