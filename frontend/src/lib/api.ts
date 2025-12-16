import axios from 'axios';

// Tell TypeScript that `import.meta.env` has our variable
declare global {
  interface ImportMetaEnv {
    readonly VITE_BACKEND_URL: string;
    readonly VITE_APP_NAME: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Now read it properly:
const rawBackend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const backend = String(rawBackend).replace(/\/$/, '');

const api = axios.create({
  baseURL: `${backend}/api`,
});

export const BACKEND_URL = backend;

// Upload menu item image
export const uploadMenuItemImage = async (
  imageFile: File,
  category: string,
  sub_category: string | null,
  item_name: string
): Promise<string> => {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('category', category);
  formData.append('sub_category', sub_category || '');
  formData.append('item_name', item_name);

  const response = await api.post('/upload/menu-item-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.image_url;
};

// Delete menu item image
export const deleteMenuItemImage = async (image_url: string): Promise<void> => {
  await api.delete('/upload/menu-item-image', {
    data: { image_url },
  });
};

export default api;
