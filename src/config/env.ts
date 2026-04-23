export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL as string,
  MODE: import.meta.env.MODE,
};
if (!env.API_BASE_URL) throw new Error('VITE_API_BASE_URL is required');
