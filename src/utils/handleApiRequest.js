import cache from '@/utils/cache';

export async function handleApiRequest(apiCall, cacheKey, storeProperty, store) {
    store.loading = true;
    try {
        const { data, success } = await apiCall;
        if (cacheKey) cache.setItem(cacheKey, data);
        store[storeProperty] = data;
        if (data == null) return success;
        return data;
    } catch (error) {
        store.msg = error.message;
        store[storeProperty] = null;
        store.status = error.status_code;
        return store.status;
    } finally {
        store.loading = false;
    }
}
