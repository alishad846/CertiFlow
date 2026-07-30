import axios from 'axios';

// Create Axios instance with base configuration
const apiClient = axios.create({
  // baseURL: process.env.REACT_APP_API_URL || 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // CertiFlow's session JWT lives in an httpOnly cookie (`token`) — it cannot be read by JS and
  // sent as a Bearer header. Send credentials so the browser attaches the cookie on same-site
  // (web:3000 -> api:4000) XHRs; the API's cors() reflects the origin + credentials for this.
  withCredentials: true,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add authorization token if available
    const token = sessionStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Return only the data from successful responses
    return response.data;
  },
  (error) => {
    // Handle common error cases
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Handle unauthorized: maybe redirect to login
          console.error('Unauthorized request');
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          console.error('An error occurred');
      }
    } else if (error.request) {
      // No response received
      console.error('No response received from server');
    } else {
      // Error setting up request
      console.error('Error setting up request');
    }
    return Promise.reject(error);
  }
);

// Export API methods
export const api = {
  get: (url: string, config = {}) => apiClient.get(url, config),
  post: (url: string, data: unknown, config = {}) => apiClient.post(url, data, config),
  put: (url: string, data: unknown, config = {}) => apiClient.put(url, data, config),
  delete: (url: string, config = {}) => apiClient.delete(url, config),
  patch: (url: string, data: unknown, config = {}) => apiClient.patch(url, data, config),
};

export default apiClient;