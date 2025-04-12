// src/components/PetDetail.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPetById, interactWithPet, simulateTime, checkPetStats } from '../services/api';
import { toast, ToastContainer } from 'react-toastify';
import { useWebSocket } from '../context/WebSocketContext';
import 'react-toastify/dist/ReactToastify.css';

// Import pet stat constants
import { 
  MAX_STAT, 
  CRITICAL_STAT_THRESHOLD, 
  GOOD_STAT_THRESHOLD, 
  // FULL_SLEEP_THRESHOLD 
} from '../constants';

const PetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interactionResult, setInteractionResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  
  // Use the shared WebSocket context
  const { connected, relevantMessages, getPetCriticalWarnings } = useWebSocket();
  
  // Ref to store the interval ID for cleanup
  const refreshIntervalRef = useRef(null);
  
  // Configure toast options
  const toastOptions = useMemo(() => ({
    position: "top-right",
    autoClose: false,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true
  }), []);

  // Function to fetch pet data
  const fetchPet = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      
      const data = await getPetById(id);
      setPet(data);
      setLoading(false);
      
      if (isManualRefresh) {
        setRefreshing(false);
      }
      
      setLastRefreshed(new Date());
      return data;
    } catch (err) {
      console.error('Failed to fetch pet details:', err);
      setError('Failed to fetch pet details. Please try again later.');
      setLoading(false);
      if (isManualRefresh) {
        setRefreshing(false);
      }
      return null;
    }
  }, [id]);

  // Update the WebSocket message handler
  useEffect(() => {
    if (relevantMessages && relevantMessages.length > 0 && pet) {
      // For debug purpose
      console.log("Relevant messages:", relevantMessages);
      
      // Check the most recent messages for updates relevant to this pet
      const relevantPetMessages = relevantMessages.filter(data => 
        data.type === 'pet_update' && data.pet_id === parseInt(id)
      );
      
      // Process relevant messages
      relevantPetMessages.forEach(data => {
        // Now process the message
        if (data.update_type === 'status_change') {
          // Create a stable toast ID for status changes
          const statusToastId = `pet-${data.pet_id}-status-${data.data.new_status}`;
          
          // Show notification about status change
          if (data.data.new_status === 'sick') {
            toast.warning(data.data.message || `${pet?.name} is sick!`, {
              ...toastOptions,
              toastId: statusToastId
            });
          } else if (data.data.new_status === 'deceased') {
            toast.error(data.data.message || `${pet?.name} has passed away.`, {
              ...toastOptions,
              toastId: statusToastId
            });
          } else if (data.data.old_status === 'sick' && data.data.new_status === 'alive') {
            toast.success(data.data.message || `${pet?.name} has recovered!`, {
              ...toastOptions,
              toastId: statusToastId
            });
          } else {
            toast.info(data.data.message || `${pet?.name}'s status changed to ${data.data.new_status}.`, {
              ...toastOptions,
              toastId: statusToastId
            });
          }
        } else if (data.update_type === 'evolution') {
          // Create a stable toast ID for evolution
          const evolutionToastId = `pet-${data.pet_id}-evolution-${data.data.new_stage}`;
          
          // Show notification about evolution
          toast.success(data.data.message || `${pet?.name} evolved from ${data.data.old_stage} to ${data.data.new_stage}!`, {
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
    if (pet) {
      // Get the current critical warnings
      const currentWarnings = getPetCriticalWarnings(parseInt(id));
      
      // The possible warning types
      const warningTypes = ["hunger", "happiness", "hygiene", "sleep"];
      
      // Check each warning type
      warningTypes.forEach(type => {
        const stableToastId = `pet-${id}-${type}`;
        
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
    }
  }, [relevantMessages, id, pet, getPetCriticalWarnings, toastOptions]);

  // Initial fetch and polling setup
  useEffect(() => {
    // Initial fetch
    fetchPet();

    const checkStats = async () => {
      try {
        await checkPetStats();
        console.log("Pet stats checked on page load");
      } catch (err) {
        console.error("Error checking pet stats:", err);
      }
    };
    
    checkStats();

    // Set up auto-refresh every 60 seconds
    refreshIntervalRef.current = setInterval(() => {
      fetchPet();
    }, 60000);
    
    // Clean up interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchPet]);

  const handleManualRefresh = () => {
    fetchPet(true);
  };

  const handleInteraction = async (action) => {
    try {
      setInteractionResult(null);
      // Store the current status before the interaction
      const wasAsleep = pet?.status === 'sleeping';
      
      const updatedPet = await interactWithPet(id, action);
      setPet(updatedPet);
      setLastRefreshed(new Date());
      
      // Show appropriate message based on the action and status change
      if (action === 'SLEEP') {
        if (wasAsleep) {
          setInteractionResult("Successfully woke up your pet!");
        } else {
          setInteractionResult("Successfully put your pet to sleep!");
        }
      } else {
        setInteractionResult(`Successfully performed ${action} action!`);
      }
      
      // Force refresh after interaction to get the most current data
      setTimeout(() => fetchPet(), 500);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setInteractionResult(`Error: ${err.response.data.detail}`);
      } else {
        setInteractionResult(`Error performing ${action} action. Please try again.`);
      }
    }
  };

  const handleSimulateTime = async (minutes) => {
    try {
      setInteractionResult(null);
      const updatedPet = await simulateTime(id, minutes);
      setPet(updatedPet);
      setLastRefreshed(new Date());
      setInteractionResult(`Successfully simulated ${minutes} minute(s) passing!`);
      
      // Force refresh after simulation to get the most current data
      setTimeout(() => fetchPet(), 500);
    } catch (err) {
      setInteractionResult(`Error simulating time. Please try again.`);
      console.error('Time simulation error:', err);
    }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger mt-3">{error}</div>;
  if (!pet) return <div className="alert alert-warning mt-3">Pet not found</div>;

  const getStatusColor = (value) => {
    if (value > GOOD_STAT_THRESHOLD) return 'success';
    if (value > CRITICAL_STAT_THRESHOLD) return 'warning';
    return 'danger';
  };

  const getStatusBadgeColor = () => {
    switch(pet.status) {
      case 'deceased':
        return 'danger';
      case 'sick':
        return 'warning';
      case 'sleeping':
        return 'info';
      default:
        return 'success';
    }
  };

  // Format the last refreshed time
  const formatLastRefreshed = () => {
    if (!lastRefreshed) return '';
    
    return lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="container mt-4">
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
      <div className="row">
        <div className="col-md-8 offset-md-2">
          <div className="card">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <div>
                <h2>{pet.name || 'Unknown'} ({pet.pet_type || 'Pet'})</h2>
                <div className="d-flex align-items-center">
                  <p className="mb-0 me-2">Stage: {pet.stage.charAt(0).toUpperCase() + pet.stage.slice(1) || 'Unknown'}</p>
                  <span className={`badge bg-${getStatusBadgeColor()} ms-2`}>
                    {pet.status.charAt(0).toUpperCase() + pet.status.slice(1) || 'Unknown'}
                  </span>
                </div>
              </div>
              <button 
                className="btn btn-light btn-sm" 
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
            <div className="card-body">
              {pet.status === 'deceased' && (
                <div className="alert alert-danger">
                  This pet has passed away and cannot be interacted with.
                </div>
              )}
              
              <div className="d-flex justify-content-between align-items-center">
                <h4>Pet Stats</h4>
                <div>
                  <small className="text-muted">Last updated: {formatLastRefreshed()}</small>
                  <small className="text-muted ms-3">
                    WebSocket: {connected ? <span className="text-success">Connected</span> : <span className="text-danger">Disconnected</span>}
                  </small>
                </div>
              </div>
              
              <div className="mb-3">
                <div className="mb-1">Health: {pet.health}/{MAX_STAT}</div>
                <div className="progress">
                  <div 
                    className={`progress-bar bg-${getStatusColor(pet.health)}`} 
                    role="progressbar" 
                    style={{ width: `${(pet.health / MAX_STAT) * 100}%` }}
                    aria-valuenow={(pet.health / MAX_STAT) * 100} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-1">Hunger: {pet.hunger}/{MAX_STAT}</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.hunger)}`} 
                      role="progressbar" 
                      style={{ width: `${(pet.hunger / MAX_STAT) * 100}%` }}
                      aria-valuenow={(pet.hunger / MAX_STAT) * 100} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-1">Happiness: {pet.happiness}/{MAX_STAT}</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.happiness)}`} 
                      role="progressbar" 
                      style={{ width: `${(pet.happiness / MAX_STAT) * 100}%` }}
                      aria-valuenow={(pet.happiness / MAX_STAT) * 100} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-1">Hygiene: {pet.hygiene}/{MAX_STAT}</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.hygiene)}`} 
                      role="progressbar" 
                      style={{ width: `${(pet.hygiene / MAX_STAT) * 100}%` }}
                      aria-valuenow={(pet.hygiene / MAX_STAT) * 100} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-1">Sleep: {pet.sleep}/{MAX_STAT}</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.sleep)}`} 
                      role="progressbar" 
                      style={{ width: `${(pet.sleep / MAX_STAT) * 100}%` }}
                      aria-valuenow={(pet.sleep / MAX_STAT) * 100} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 mb-3">
                <h4>Interact with your pet</h4>
                {interactionResult && (
                  <div className={`alert ${interactionResult.startsWith('Error') ? 'alert-danger' : 'alert-success'}`}>
                    {interactionResult}
                  </div>
                )}
                <div className="d-flex flex-wrap justify-content-center">
                  <button 
                    className="btn btn-success m-1" 
                    onClick={() => handleInteraction('FEED')}
                    disabled={pet.status === 'deceased' || pet.status === 'sleeping'}
                  >
                    Feed
                  </button>
                  <button 
                    className="btn btn-primary m-1" 
                    onClick={() => handleInteraction('PLAY')}
                    disabled={pet.status === 'deceased' || pet.status === 'sleeping' || pet.sleep < (CRITICAL_STAT_THRESHOLD / 2)}
                  >
                    Play
                  </button>
                  <button 
                    className="btn btn-info m-1 text-white" 
                    onClick={() => handleInteraction('CLEAN')}
                    disabled={pet.status === 'deceased' || pet.status === 'sleeping'}
                  >
                    Clean
                  </button>
                  <button 
                    className="btn btn-secondary m-1" 
                    onClick={() => handleInteraction('SLEEP')}
                    disabled={pet.status === 'deceased'}
                  >
                    {pet.status === 'sleeping' ? 'Wake Up' : 'Sleep'}
                  </button>
                  <button 
                    className="btn btn-warning m-1" 
                    onClick={() => handleInteraction('HEAL')}
                    disabled={pet.status === 'deceased' || pet.status === 'sleeping' || pet.health === MAX_STAT}
                  >
                    Heal
                  </button>
                  <button 
                    className="btn btn-danger m-1" 
                    onClick={() => handleInteraction('TREAT')}
                    disabled={pet.status === 'deceased' || pet.status === 'sleeping'}
                  >
                    Treat
                  </button>
                </div>
              </div>
              
              {/* Time Simulation Controls */}
              <div className="mt-4 mb-3">
                <h5>Testing Controls</h5>
                <div className="d-flex flex-wrap justify-content-center">
                  <button 
                    className="btn btn-outline-secondary m-1" 
                    onClick={() => handleSimulateTime(5)}
                  >
                    Simulate 5 Minutes
                  </button>
                  <button 
                    className="btn btn-outline-secondary m-1" 
                    onClick={() => handleSimulateTime(30)}
                  >
                    Simulate 30 Minutes
                  </button>
                  <button 
                    className="btn btn-outline-secondary m-1" 
                    onClick={() => handleSimulateTime(60)}
                  >
                    Simulate 1 Hour
                  </button>
                </div>
              </div>
              
              <div className="mt-3">
                <h5>Pet Details</h5>
                <ul className="list-group">
                  <li className="list-group-item">Created: {new Date(pet.created_at).toLocaleString()}</li>
                  <li className="list-group-item">Last Interaction: {new Date(pet.last_interaction).toLocaleString()}</li>
                  <li className="list-group-item">Experience: {pet.experience} points</li>
                </ul>
              </div>
              
              <div className="text-center mt-4">
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                  Back to My Pets
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetDetail;