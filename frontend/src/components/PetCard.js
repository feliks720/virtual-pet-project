// src/components/PetCard.js
import React from 'react';
import { Link } from 'react-router-dom';
import { MAX_STAT, CRITICAL_STAT_THRESHOLD, GOOD_STAT_THRESHOLD } from '../constants';

const PetCard = ({ pet }) => {
  // Calculate status colors
  const getStatusColor = (value) => {
    if (value > GOOD_STAT_THRESHOLD) return 'success';
    if (value > CRITICAL_STAT_THRESHOLD) return 'warning';
    return 'danger';
  };

  // Calculate the appropriate status badge color
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

  // Format the evolution stage with capitalization
  const formatStage = (stage) => {
    return stage.charAt(0).toUpperCase() + stage.slice(1);
  };

  return (
    <div className="card mb-3">
      <div className="card-header bg-light">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">{pet.name || 'Unknown'} ({pet.pet_type || 'Pet'})</h5>
          <span className={`badge bg-${getStatusBadgeColor()}`}>
            {pet.status?.charAt(0).toUpperCase() + pet.status?.slice(1) || 'Unknown'}
          </span>
        </div>
        <h6 className="card-subtitle mb-2 text-muted mt-1">
          Stage: {formatStage(pet.stage) || 'Unknown'}
        </h6>
      </div>
      <div className="card-body">
        <div className="mb-2">
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
          <div className="col-6">
            <div className="mb-1">Hunger: {pet.hunger}/{MAX_STAT}</div>
            <div className="progress mb-2">
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
          <div className="col-6">
            <div className="mb-1">Happiness: {pet.happiness}/{MAX_STAT}</div>
            <div className="progress mb-2">
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
          <div className="col-6">
            <div className="mb-1">Hygiene: {pet.hygiene}/{MAX_STAT}</div>
            <div className="progress mb-2">
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
          <div className="col-6">
            <div className="mb-1">Sleep: {pet.sleep}/{MAX_STAT}</div>
            <div className="progress mb-2">
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
        
        {pet.status === 'deceased' ? (
          <div className="alert alert-danger mt-3 mb-0">
            This pet has passed away.
          </div>
        ) : (
          <Link to={`/pets/${pet.id}`} className="btn btn-primary mt-3">
            Interact with {pet.name}
          </Link>
        )}
      </div>
    </div>
  );
};

export default PetCard;