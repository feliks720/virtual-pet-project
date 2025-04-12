// src/components/PetList.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPets } from '../services/api';
import PetCard from './PetCard';
import { toast, ToastContainer } from 'react-toastify';
import { useWebSocket } from '../context/WebSocketContext';
import 'react-toastify/dist/ReactToastify.css';

const PetList = () => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Use the shared WebSocket context
  const { connected, relevantMessages, getPetCriticalWarnings } = useWebSocket();
  
  // Ref to store the interval ID for cleanup
  const refreshIntervalRef = useRef(null);
  
  // Configure toast options
  const toastOptions = {
    position: "top-right",
    autoClose: false,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true
  };

  // Function to fetch pets
  const fetchPets = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      
      const data = await getPets();
      
      // Ensure we received an array
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received from server');
      }
      
      setPets(data);
      setLoading(false);
      
      if (isManualRefresh) {
        setRefreshing(false);
      }
      
      setLastRefreshed(new Date());
      return data;
    } catch (err) {
      console.error('Error fetching pets:', err);
      if (err.response && err.response.status === 403) {
        setError('You need to log in to view your pets.');
      } else {
        setError('Failed to fetch pets. Please try again later.');
      }
      setLoading(false);
      if (isManualRefresh) {
        setRefreshing(false);
      }
      return [];
    }
  }, []);

  // Update the WebSocket message handler
  useEffect(() => {
    if (relevantMessages && relevantMessages.length > 0 && pets.length > 0) {
      // For debug purpose
      console.log("Relevant messages:", relevantMessages);
      
      // Check the most recent messages for updates
      const petUpdateMessages = relevantMessages.filter(data => 
        data.type === 'pet_update'
      );
      
      // Process messages
      petUpdateMessages.forEach(data => {
        // Find the pet in our list if it exists
        const pet = pets.find(p => p.id === data.pet_id);
        const petName = pet?.name || 'Your pet';
        
        // Now process the message
        if (data.update_type === 'status_change') {
          // Create a stable toast ID for status changes
          const statusToastId = `pet-${data.pet_id}-status-${data.data.new_status}`;
          
          // Show notification about status change
          if (data.data.new_status === 'sick') {
            toast.warning(data.data.message || `${petName} is sick!`, {
              ...toastOptions,
              toastId: statusToastId
            });
          } else if (data.data.new_status === 'deceased') {
            toast.error(data.data.message || `${petName} has passed away.`, {
              ...toastOptions,
              toastId: statusToastId
            });
          } else if (data.data.old_status === 'sick' && data.data.new_status === 'alive') {
            toast.success(data.data.message || `${petName} has recovered!`, {
              ...toastOptions,
              toastId: statusToastId
            });
          } else {
            toast.info(data.data.message || `${petName}'s status changed to ${data.data.new_status}.`, {
              ...toastOptions,
              toastId: statusToastId
            });
          }
        } else if (data.update_type === 'evolution') {
          // Create a stable toast ID for evolution
          const evolutionToastId = `pet-${data.pet_id}-evolution-${data.data.new_stage}`;
          
          // Show notification about evolution
          toast.success(data.data.message || `${petName} evolved from ${data.data.old_stage} to ${data.data.new_stage}!`, {
            ...toastOptions,
            toastId: evolutionToastId
          });
        } else if (data.update_type === 'critical_stats') {
          // For critical stats, use consistent toast IDs for each warning type
          if (data.data.warnings && Array.isArray(data.data.warnings)) {
            data.data.warnings.forEach(warning => {
              // Extract what type of warning this is
              let warningType = "unknown";
              
              if (warning.includes("hungry")) {
                warningType = "hunger";
              } else if (warning.includes("unhappy")) {
                warningType = "happiness";
              } else if (warning.includes("cleaning")) {
                warningType = "hygiene";
              } else if (warning.includes("tired")) {
                warningType = "sleep";
              }
              
              // Create a stable toast ID that won't change between message updates
              const stableToastId = `pet-${data.pet_id}-${warningType}`;
              
              // Use the stable ID to prevent duplicate toasts
              toast.warning(warning, { 
                ...toastOptions,
                toastId: stableToastId
              });
            });
          }
        }
      });
    }
    
    // Clean up any stale toast notifications that are no longer valid
    pets.forEach(pet => {
      // Get the current critical warnings
      const currentWarnings = getPetCriticalWarnings(pet.id);
      
      // The possible warning types
      const warningTypes = ["hunger", "happiness", "hygiene", "sleep"];
      
      // Check each warning type
      warningTypes.forEach(type => {
        const stableToastId = `pet-${pet.id}-${type}`;
        
        // If we have a toast for this type but no current warning, dismiss it
        const hasWarningOfType = currentWarnings.some(warning => {
          if (type === "hunger" && warning.includes("hungry")) return true;
          if (type === "happiness" && warning.includes("unhappy")) return true;
          if (type === "hygiene" && warning.includes("cleaning")) return true;
          if (type === "sleep" && warning.includes("tired")) return true;
          return false;
        });
        
        if (!hasWarningOfType) {
          // Dismiss any toast with this ID
          toast.dismiss(stableToastId);
        }
      });
    });
  }, [relevantMessages, pets, getPetCriticalWarnings, toastOptions]);

  // Initial fetch and polling setup
  useEffect(() => {
    // Initial fetch
    fetchPets();
    
    // Set up auto-refresh every 60 seconds
    refreshIntervalRef.current = setInterval(() => {
      fetchPets();
    }, 60000);
    
    // Clean up interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchPets]);

  const handleManualRefresh = () => {
    fetchPets(true);
  };

  // Format the last refreshed time
  const formatLastRefreshed = () => {
    if (!lastRefreshed) return '';
    
    return lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger mt-3">{error}</div>;
  if (pets.length === 0) {
    return (
      <div className="text-center mt-5">
        <h3>You don't have any pets yet!</h3>
        <p>Create a new pet to get started.</p>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>My Pets</h2>
        <div>
          <small className="text-muted me-2">Last updated: {formatLastRefreshed()}</small>
          <small className="text-muted me-3">
            WebSocket: {connected ? <span className="text-success">Connected</span> : <span className="text-danger">Disconnected</span>}
          </small>
          <button 
            className="btn btn-outline-primary btn-sm" 
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Refreshing...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-clockwise me-1"></i>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
      <div className="row">
        {pets
          .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically by name
          .map(pet => (
            <div className="col-md-6 col-lg-4 mb-4" key={pet.id}>
              <PetCard pet={pet} />
            </div>
          ))
        }
      </div>
    </div>
  );
};

export default PetList;