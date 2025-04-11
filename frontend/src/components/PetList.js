// src/components/PetList.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPets } from '../services/api';
import PetCard from './PetCard';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PetList = () => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [socket, setSocket] = useState(null);
  
  // Refs to store the interval ID and socket for cleanup
  const refreshIntervalRef = useRef(null);
  const socketRef = useRef(null);

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

  // Handle WebSocket setup
  useEffect(() => {
    // Create WebSocket connection
    // const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const webSocketUrl = 'ws://localhost:8000/ws/pets/';
    
    console.log(`Connecting to WebSocket at: ${webSocketUrl}`);
    const newSocket = new WebSocket(webSocketUrl);
    socketRef.current = newSocket;
    
    newSocket.onopen = () => {
      console.log('WebSocket connection established');
      setSocket(newSocket);
    };
    
    newSocket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log('WebSocket message received:', data);
      
      if (data.type === 'pet_update') {
        // Handle different update types
        if (data.update_type === 'status_change') {
          // Find the pet in our list
          const petName = pets.find(p => p.id === data.pet_id)?.name || 'Your pet';
          
          // Show notification about status change
          if (data.data.new_status === 'sick') {
            toast.warning(data.data.message || `${petName} is sick!`);
          } else if (data.data.new_status === 'deceased') {
            toast.error(data.data.message || `${petName} has passed away.`);
          } else if (data.data.old_status === 'sick' && data.data.new_status === 'alive') {
            toast.success(data.data.message || `${petName} has recovered!`);
          } else {
            toast.info(data.data.message || `${petName}'s status changed to ${data.data.new_status}.`);
          }
          // Refresh all pets
          fetchPets();
        } else if (data.update_type === 'evolution') {
          // Find the pet in our list
          const petName = pets.find(p => p.id === data.pet_id)?.name || 'Your pet';
          
          // Show notification about evolution
          toast.success(data.data.message || `${petName} evolved from ${data.data.old_stage} to ${data.data.new_stage}!`);
          // Refresh all pets
          fetchPets();
        } else if (data.update_type === 'critical_stats') {
          // Show notifications for critical stats
          if (data.data.warnings && Array.isArray(data.data.warnings)) {
            data.data.warnings.forEach(warning => {
              toast.warning(warning);
            });
          }
          // Refresh all pets
          fetchPets();
        }
      }
    };
    
    newSocket.onclose = (e) => {
      console.log('WebSocket connection closed:', e);
      
      // Try to reconnect after 5 seconds if not an intentional close
      if (e.code !== 1000) {
        setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          // This will trigger the useEffect again
          setSocket(null);
        }, 5000);
      }
    };
    
    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        console.log('Closing WebSocket connection...');
        // Use code 1000 for normal closure
        socketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [pets, fetchPets]);

  // Set up polling - with a longer interval since we have WebSockets
  useEffect(() => {
    // Initial fetch
    fetchPets();
    
    // Set up auto-refresh every 60 seconds (reduced frequency because of WebSockets)
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
            WebSocket: {socket ? <span className="text-success">Connected</span> : <span className="text-danger">Disconnected</span>}
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
        {pets.map(pet => (
          <div className="col-md-6 col-lg-4 mb-4" key={pet.id}>
            <PetCard pet={pet} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PetList;