// src/context/WebSocketContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext();

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  // Create a criticalStats map to track current critical stats by pet ID
  const [criticalStats, setCriticalStats] = useState({});
  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  // For debugging
  useEffect(() => {
    console.log("Current critical stats:", criticalStats);
  }, [criticalStats]);
  
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
        
        // Process critical stats specially
        if (data.type === 'pet_update' && data.update_type === 'critical_stats') {
          console.log('DEBUG USE: CRITICAL STATS UPDATE RAW:', JSON.stringify(data));
          
          const petId = data.pet_id;
          const warnings = data.data.warnings || [];
          
          // Add debug logging
          console.log(`Processing critical stats update for pet ${petId}, warnings:`, warnings);
          
          // Update our tracker of critical stats
          setCriticalStats(prev => {
            // Create a new object to avoid reference issues
            const newCriticalStats = { ...prev };
            
            // If there are warnings, track them by type
            if (warnings.length > 0) {
              // Create a new warnings object for this pet
              const petWarnings = {};
              
              warnings.forEach(warning => {
                if (warning.includes("hungry")) petWarnings.hunger = warning;
                else if (warning.includes("unhappy")) petWarnings.happiness = warning;
                else if (warning.includes("cleaning")) petWarnings.hygiene = warning;
                else if (warning.includes("tired")) petWarnings.sleep = warning;
              });
              
              // Set the warnings for this pet
              newCriticalStats[petId] = petWarnings;
              console.log(`Updated critical stats for pet ${petId}:`, petWarnings);
            } 
            // If there are no warnings, clear this pet's critical stats
            else {
              if (newCriticalStats[petId]) {
                console.log(`Clearing critical stats for pet ${petId}`);
                delete newCriticalStats[petId];
              }
            }
            
            return newCriticalStats;
          });
        }
        
        // Always update the messages array
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
  
  // Get current critical warnings for a pet
  const getPetCriticalWarnings = useCallback((petId) => {
    const petStats = criticalStats[petId] || {};
    return Object.values(petStats);
  }, [criticalStats]);
  
  // Filter messages to only include current critical stats
  const getFilteredMessages = useCallback(() => {
    // Start with non-critical-stats messages
    const filteredMessages = messages.filter(msg => {
      return msg.type !== 'pet_update' || msg.update_type !== 'critical_stats';
    });
    
    // Add one critical stats message per pet's active warning types
    Object.entries(criticalStats).forEach(([petId, warnings]) => {
      const petIdNum = parseInt(petId);
      
      // For each warning type this pet has, add a message
      Object.entries(warnings).forEach(([warningType, warningMessage]) => {
        filteredMessages.push({
          type: 'pet_update',
          pet_id: petIdNum,
          update_type: 'critical_stats',
          data: {
            warnings: [warningMessage],
            warning_type: warningType
          }
        });
      });
    });
    
    return filteredMessages;
  }, [messages, criticalStats]);
  
  return (
    <WebSocketContext.Provider value={{ 
      connected, 
      messages, // Keep original messages for reference
      sendMessage,
      getPetCriticalWarnings,
      relevantMessages: getFilteredMessages(), // Only include current relevant messages
      latestMessages: messages.slice(-20) // Keep this for backward compatibility 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};