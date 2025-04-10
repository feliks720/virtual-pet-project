// src/components/PetForm.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPet } from '../services/api';

const PetForm = () => {
  const navigate = useNavigate();
  const [petData, setPetData] = useState({
    name: '',
    pet_type: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPetData({
      ...petData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createPet(petData);
      setLoading(false);
      navigate('/');
    } catch (err) {
      setLoading(false);
      if (err.response && err.response.data) {
        setError(JSON.stringify(err.response.data));
      } else {
        setError('Failed to create pet. Please try again later.');
      }
    }
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-6 offset-md-3">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h2>Create a New Pet</h2>
            </div>
            <div className="card-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group mb-3">
                  <label htmlFor="name">Pet Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="name"
                    name="name"
                    value={petData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group mb-3">
                  <label htmlFor="pet_type">Pet Type</label>
                  <select
                    className="form-control"
                    id="pet_type"
                    name="pet_type"
                    value={petData.pet_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a pet type</option>
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="rabbit">Rabbit</option>
                    <option value="bird">Bird</option>
                    <option value="dragon">Dragon</option>
                  </select>
                </div>
                <div className="text-center">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Creating...
                      </>
                    ) : (
                      'Create Pet'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetForm;