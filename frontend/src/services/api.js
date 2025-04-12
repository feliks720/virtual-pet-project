import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

// Create axios instance with tokens
const api = axios.create({
  baseURL: API_URL,
});

// Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('isLoggedIn');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper function to validate pet data - ensures data consistency
const validatePetData = (petData) => {
  // Basic validation
  if (!petData || typeof petData !== 'object') {
    console.error('Invalid pet data received');
    return null;
  }
  
  // Ensure we got a pet with an ID
  if (!petData.id) {
    console.error('Pet data missing ID');
    return null;
  }
  
  // Ensure all number fields are actually numbers
  const numericFields = ['health', 'hunger', 'happiness', 'hygiene', 'sleep', 'experience'];
  numericFields.forEach(field => {
    if (petData[field] !== undefined && typeof petData[field] !== 'number') {
      petData[field] = parseInt(petData[field]) || 0; // Convert to number or default to 0
    }
  });
  
  return petData;
};

export const loginUser = async (credentials) => {
  try {
    const response = await axios.post(
      `${API_URL}/token-auth/`,
      credentials
    );
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const getPets = async () => {
  try {
    const response = await api.get('/pets/');
    // If we receive an array, validate each pet
    if (Array.isArray(response.data)) {
      return response.data.map(pet => validatePetData(pet)).filter(pet => pet !== null);
    }
    return [];
  } catch (error) {
    console.error('Error fetching pets:', error);
    throw error;
  }
};

export const getPetById = async (id) => {
  try {
    const response = await api.get(`/pets/${id}/`);
    const validatedPet = validatePetData(response.data);
    
    if (!validatedPet) {
      throw new Error('Invalid pet data received from server');
    }
    
    return validatedPet;
  } catch (error) {
    console.error(`Error fetching pet ${id}:`, error);
    throw error;
  }
};

export const createPet = async (petData) => {
  try {
    const response = await api.post('/pets/', petData);
    return validatePetData(response.data);
  } catch (error) {
    console.error('Error creating pet:', error);
    throw error;
  }
};

export const interactWithPet = async (petId, action) => {
  try {
    const response = await api.post(`/pets/${petId}/interact/`, { action });
    const validatedPet = validatePetData(response.data);
    
    if (!validatedPet) {
      throw new Error('Invalid pet data received from server after interaction');
    }
    
    return validatedPet;
  } catch (error) {
    console.error(`Error with ${action} interaction:`, error);
    throw error;
  }
};

export const simulateTime = async (petId, minutes = 5) => {
  try {
    const response = await api.post(`/pets/${petId}/simulate_time/`, { minutes });
    const validatedPet = validatePetData(response.data);
    
    if (!validatedPet) {
      throw new Error('Invalid pet data received from server after time simulation');
    }
    
    return validatedPet;
  } catch (error) {
    console.error('Error simulating time:', error);
    throw error;
  }
};

export const checkPetStats = async () => {
  try {
    // Fix the URL to avoid the duplicate /api/ prefix
    const response = await api.post('/pets/check_stats/');
    return response.data.pets;
  } catch (error) {
    console.error('Error checking pet stats:', error);
    throw error;
  }
};