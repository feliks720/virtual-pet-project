// src/context/WebSocketContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Wrap the function with useCallback
  const connectWebSocket = useCallback(() => {
    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    const token = localStorage.getItem('token');

    // Include token in the WebSocket URL for authentication
    const wsUrl = `ws://localhost:8000/ws/pets/?token=${token || ''}`;
    
    console.log('Connecting to WebSocket...');
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connection established');
      setConnected(true);
      reconnectAttemptsRef.current = 0; // Reset counter on successful connection
    };
    
    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('RAW WebSocket message received:', e.data);
        console.log('Parsed WebSocket message:', data);
    
        setMessages(prev => {
          const newMessages = [...prev, data];
          // Keep only the latest 100 messages
          return newMessages.slice(-100);
        });
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    socket.onclose = (e) => {
      console.log('WebSocket connection closed:', e);
      setConnected(false);
      
      // Only attempt to reconnect if not an intentional close and not logged out
      if (e.code !== 1000 && isLoggedIn && reconnectAttemptsRef.current < maxReconnectAttempts) {
        // Exponential backoff for reconnection
        const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`Attempting to reconnect in ${backoffTime/1000} seconds...`);
        
        setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connectWebSocket();
        }, backoffTime);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    socketRef.current = socket;
  }, [isLoggedIn]); // Add isLoggedIn as a dependency since it's used in the function
  
  // Connect when the component mounts or when auth state changes
  useEffect(() => {
    if (isLoggedIn) {
      connectWebSocket();
    } else if (socketRef.current) {
      // Close connection when logged out
      socketRef.current.close(1000, 'User logged out');
      socketRef.current = null;
    }
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [isLoggedIn, connectWebSocket]); // Add connectWebSocket to the dependencies
  
  // Function to allow components to send messages
  const sendMessage = (message) => {
    if (socketRef.current && connected) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  };
  
  return (
    <WebSocketContext.Provider value={{ 
      connected, 
      messages, 
      sendMessage,
      latestMessages: messages.slice(-20) // Provide the most recent messages
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};