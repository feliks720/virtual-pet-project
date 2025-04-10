// src/components/PetList.js
import React, { useState, useEffect } from 'react';
import { getPets } from '../services/api';
import PetCard from './PetCard';

const PetList = () => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPets = async () => {
      try {
        const data = await getPets();
        setPets(data);
        setLoading(false);
      } catch (err) {
        if (err.response && err.response.status === 403) {
          setError('You need to log in to view your pets.');
        } else {
          setError('Failed to fetch pets. Please try again later.');
        }
        setLoading(false);
      }
    };

    fetchPets();
  }, []);

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
      <h2 className="mb-4">My Pets</h2>
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