const dbName = 'LocalCacheDB';
const storeName = 'CacheStore';

const openDB = () =>
    new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });

const performTransaction = async (callback, mode = 'readwrite') => {
    const db = await openDB();
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        callback(store);
    });
};

const base64EncodeUnicode = (str) => {
    const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(`0x${p1}`));
    return btoa(utf8Bytes);
};

const base64DecodeUnicode = (str) => {
    const percentEncodedStr = atob(str)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('');
    return decodeURIComponent(percentEncodedStr);
};

export default {
    /**
     * @param {string} key
     * @param {object} value
     * @return {Promise<void>}
     */
    setItem: async (key, value) => {
        const encrypted = base64EncodeUnicode(JSON.stringify(value));
        await performTransaction((store) => {
            store.put({ key, value: encrypted });
        });
    },

    /**
     * @param {string} key
     * @returns {Promise<boolean>}
     */
    hasThis: async (key) => {
        return new Promise(async (resolve) => {
            const db = await openDB();
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result !== undefined);
            request.onerror = () => resolve(false);
        });
    },

    /**
     * @param {string} key
     * @returns {Promise<object | null>}
     */
    getItem: async (key) => {
        return new Promise(async (resolve) => {
            const db = await openDB();
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                if (request.result) {
                    resolve(JSON.parse(base64DecodeUnicode(request.result.value)));
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    },

    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    removeItem: async (key) => {
        await performTransaction((store) => {
            store.delete(key);
        });
    },

    /**
     * @returns {Promise<void>}
     */
    cleanAll: async () => {
        await performTransaction((store) => {
            store.clear();
        });
    },

    refresh: async () => {
        const token = await this.getItem('token');
        const currentUser = await this.getItem('currentUser');

        await this.cleanAll();

        if (token) {
            await this.setItem('token', token);
        }
        if (currentUser) {
            await this.setItem('currentUser', currentUser);
        }
    },
    async initialize() {
        try {
            await openDB();
            console.log('IndexedDB initialized successfully.');
        } catch (error) {
            console.error('Error initializing IndexedDB:', error);
        }
    }
};
