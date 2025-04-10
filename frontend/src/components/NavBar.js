// src/components/NavBar.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NavBar = () => {
  const { isLoggedIn, logout } = useAuth();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container">
        <Link className="navbar-brand" to="/">Virtual Pet App</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {isLoggedIn && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/">My Pets</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/new">Create Pet</Link>
                </li>
              </>
            )}
          </ul>
          {isLoggedIn && (
            <button onClick={logout} className="btn btn-outline-light">
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;