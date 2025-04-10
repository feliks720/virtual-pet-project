import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPetById, interactWithPet, simulateTime } from '../services/api';

const PetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interactionResult, setInteractionResult] = useState(null);

  useEffect(() => {
    const fetchPet = async () => {
      try {
        const data = await getPetById(id);
        setPet(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch pet details. Please try again later.');
        setLoading(false);
      }
    };

    fetchPet();
  }, [id]);

  const handleInteraction = async (action) => {
    try {
      setInteractionResult(null);
      // Store the current status before the interaction
      const wasAsleep = pet.status === 'sleeping';
      
      const updatedPet = await interactWithPet(id, action);
      setPet(updatedPet);
      
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
      setInteractionResult(`Successfully simulated ${minutes} minute(s) passing!`);
    } catch (err) {
      setInteractionResult(`Error simulating time. Please try again.`);
      console.error('Time simulation error:', err);
    }
  };

  if (loading) return <div className="text-center mt-5"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger mt-3">{error}</div>;
  if (!pet) return <div className="alert alert-warning mt-3">Pet not found</div>;

  const getStatusColor = (value) => {
    if (value > 70) return 'success';
    if (value > 30) return 'warning';
    return 'danger';
  };

  // Function to convert from 0-1000 scale to percentage for display
  const calculatePercentage = (value) => {
    // Make sure value is a valid number before dividing
    if (typeof value !== 'number' || isNaN(value)) {
      return '0'; // Return 0 if value is not a valid number
    }
    return Math.floor(value / 10).toString(); // Convert from 0-1000 to 0-100 for display
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-8 offset-md-2">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h2>{pet.name || 'Unknown'} ({pet.pet_type || 'Pet'})</h2>
              <p className="mb-0">Stage: {pet.stage || 'Unknown'} | Status: {pet.status || 'Unknown'}</p>
            </div>
            <div className="card-body">
              {pet.status === 'deceased' && (
                <div className="alert alert-danger">
                  This pet has passed away and cannot be interacted with.
                </div>
              )}
              
              <h4>Pet Stats</h4>
              <div className="mb-3">
                <div className="mb-1">Health: {calculatePercentage(pet.health)}%</div>
                <div className="progress">
                  <div 
                    className={`progress-bar bg-${getStatusColor(pet.health / 10)}`} 
                    role="progressbar" 
                    style={{ width: `${pet.health / 10}%` }}
                    aria-valuenow={pet.health / 10} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-1">Hunger: {calculatePercentage(pet.hunger)}%</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.hunger / 10)}`} 
                      role="progressbar" 
                      style={{ width: `${pet.hunger / 10}%` }}
                      aria-valuenow={pet.hunger / 10} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-1">Happiness: {calculatePercentage(pet.happiness)}%</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.happiness / 10)}`} 
                      role="progressbar" 
                      style={{ width: `${pet.happiness / 10}%` }}
                      aria-valuenow={pet.happiness / 10} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-1">Hygiene: {calculatePercentage(pet.hygiene)}%</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.hygiene / 10)}`} 
                      role="progressbar" 
                      style={{ width: `${pet.hygiene / 10}%` }}
                      aria-valuenow={pet.hygiene / 10} 
                      aria-valuemin="0" 
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-1">Sleep: {calculatePercentage(pet.sleep)}%</div>
                  <div className="progress mb-3">
                    <div 
                      className={`progress-bar bg-${getStatusColor(pet.sleep / 10)}`} 
                      role="progressbar" 
                      style={{ width: `${pet.sleep / 10}%` }}
                      aria-valuenow={pet.sleep / 10} 
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
                    disabled={pet.status === 'deceased' || pet.status === 'sleeping' || pet.sleep < 100}
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
                    disabled={pet.status === 'deceased' || pet.status === 'sleeping' || pet.health === 1000}
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