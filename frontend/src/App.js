// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import NavBar from './components/NavBar';
import PetList from './components/PetList';
import PetDetail from './components/PetDetail';
import PetForm from './components/PetForm';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import 'bootstrap/dist/css/bootstrap.min.css';
import WebSocketTest from './components/WebSocketTest';

function AppWithRouter() {
  return (
    <div className="App">
      <NavBar />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <PetList />
            </ProtectedRoute>
          } />
          <Route path="/pets/:id" element={
            <ProtectedRoute>
              <PetDetail />
            </ProtectedRoute>
          } />
          <Route path="/new" element={
            <ProtectedRoute>
              <PetForm />
            </ProtectedRoute>
          } />
          <Route path="/socket-test" element={<WebSocketTest />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppWithRouter />
      </AuthProvider>
    </Router>
  );
}

export default App;