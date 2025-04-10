import React from 'react';
import { Link } from 'react-router-dom';

const PetCard = ({ pet }) => {
  // Calculate status colors
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
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h5 className="card-title">{pet.name || 'Unknown'} ({pet.pet_type || 'Pet'})</h5>
        <h6 className="card-subtitle mb-2 text-muted">
          Stage: {pet.stage || 'Unknown'} | Status: {pet.status || 'Unknown'}
        </h6>
      </div>
      <div className="card-body">
        <div className="mb-2">
          <div className="mb-1">Health: {calculatePercentage(pet.health)}%</div>
          <div className="progress">
            <div 
              className={`progress-bar bg-${getStatusColor(pet.health / 10)}`} 
              role="progressbar" 
              style={{ width: `${calculatePercentage(pet.health)}%` }}
              aria-valuenow={calculatePercentage(pet.health)} 
              aria-valuemin="0" 
              aria-valuemax="100"
            ></div>
          </div>
        </div>
        <div className="row">
          <div className="col-6">
            <div className="mb-1">Hunger: {calculatePercentage(pet.hunger)}%</div>
            <div className="progress mb-2">
              <div 
                className={`progress-bar bg-${getStatusColor(pet.hunger / 10)}`} 
                role="progressbar" 
                style={{ width: `${calculatePercentage(pet.hunger)}%` }}
                aria-valuenow={calculatePercentage(pet.hunger)} 
                aria-valuemin="0" 
                aria-valuemax="100"
              ></div>
            </div>
          </div>
          <div className="col-6">
            <div className="mb-1">Happiness: {calculatePercentage(pet.happiness)}%</div>
            <div className="progress mb-2">
              <div 
                className={`progress-bar bg-${getStatusColor(pet.happiness / 10)}`} 
                role="progressbar" 
                style={{ width: `${calculatePercentage(pet.happiness)}%` }}
                aria-valuenow={calculatePercentage(pet.happiness)} 
                aria-valuemin="0" 
                aria-valuemax="100"
              ></div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-6">
            <div className="mb-1">Hygiene: {calculatePercentage(pet.hygiene)}%</div>
            <div className="progress mb-2">
              <div 
                className={`progress-bar bg-${getStatusColor(pet.hygiene / 10)}`} 
                role="progressbar" 
                style={{ width: `${calculatePercentage(pet.hygiene)}%` }}
                aria-valuenow={calculatePercentage(pet.hygiene)} 
                aria-valuemin="0" 
                aria-valuemax="100"
              ></div>
            </div>
          </div>
          <div className="col-6">
            <div className="mb-1">Sleep: {calculatePercentage(pet.sleep)}%</div>
            <div className="progress mb-2">
              <div 
                className={`progress-bar bg-${getStatusColor(pet.sleep / 10)}`} 
                role="progressbar" 
                style={{ width: `${calculatePercentage(pet.sleep)}%` }}
                aria-valuenow={calculatePercentage(pet.sleep)} 
                aria-valuemin="0" 
                aria-valuemax="100"
              ></div>
            </div>
          </div>
        </div>
        <Link to={`/pets/${pet.id}`} className="btn btn-primary mt-3">
          Interact with {pet.name}
        </Link>
      </div>
    </div>
  );
};

export default PetCard;