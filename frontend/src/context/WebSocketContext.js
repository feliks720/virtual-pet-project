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
  // Add a new state to track processed message timestamps
  const [processedMessageTimestamps, setProcessedMessageTimestamps] = useState({});
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
        
        // Special handling for critical stats to ensure they always get processed
        if (data.type === 'pet_update' && data.update_type === 'critical_stats') {
          console.log('CRITICAL STATS UPDATE RECEIVED:', JSON.stringify(data));
          
          const petId = data.pet_id;
          const warnings = data.data.warnings || [];
          
          console.log(`Processing critical stats update for pet ${petId}, warnings:`, warnings);
          
          // Always update critical stats regardless of duplicates
          setCriticalStats(prev => {
            const newCriticalStats = { ...prev };
            
            if (warnings.length > 0) {
              const petWarnings = {};
              
              warnings.forEach(warning => {
                if (warning.includes("hungry")) petWarnings.hunger = warning;
                else if (warning.includes("unhappy")) petWarnings.happiness = warning;
                else if (warning.includes("cleaning")) petWarnings.hygiene = warning;
                else if (warning.includes("tired")) petWarnings.sleep = warning;
              });
              
              newCriticalStats[petId] = petWarnings;
              console.log(`Updated critical stats for pet ${petId}:`, petWarnings);
            } 
            else {
              if (newCriticalStats[petId]) {
                console.log(`Clearing critical stats for pet ${petId}`);
                delete newCriticalStats[petId];
              }
            }
            
            return newCriticalStats;
          });
          
          // Always add critical stats to messages
          setMessages(prev => {
            // Force pet ID to be numeric
            const petIdNum = parseInt(petId, 10);
            const newData = {...data, pet_id: petIdNum};
            
            // Check if we already have this exact warning set in the messages
            const isDuplicate = prev.some(msg => 
              msg.type === 'pet_update' && 
              msg.update_type === 'critical_stats' && 
              msg.pet_id === petIdNum &&
              JSON.stringify(msg.data.warnings) === JSON.stringify(warnings)
            );
            
            if (!isDuplicate) {
              console.log("Adding new critical stats message to messages array");
              const newMessages = [...prev, newData];
              return newMessages.slice(-100);
            }
            
            console.log("Skipping duplicate critical stats message");
            return prev;
          });
        }
        else {
          // For non-critical stats messages, check for duplicates
          const messageTimestamp = data.data?.timestamp;
          let shouldProcessMessage = true;
          
          if (messageTimestamp) {
            const messageId = `${data.pet_id}-${data.update_type}-${messageTimestamp}`;
            
            if (processedMessageTimestamps[messageId]) {
              console.log(`Skipping duplicate message with ID: ${messageId}`);
              shouldProcessMessage = false;
            } else {
              setProcessedMessageTimestamps(prev => ({
                ...prev,
                [messageId]: true
              }));
            }
          }
          
          if (shouldProcessMessage) {
            setMessages(prev => {
              const newMessages = [...prev, data];
              return newMessages.slice(-100);
            });
          }
        }
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
  }, [isLoggedIn, processedMessageTimestamps]); // Add processedMessageTimestamps as a dependency
  
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
  
  // Clean up old processed message timestamps after a certain period
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // Get current timestamp
      const now = Date.now();
      // Keep messages from the last 5 minutes only
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      
      setProcessedMessageTimestamps(prev => {
        const newTimestamps = {};
        let cleaned = 0;
        
        // Only keep timestamps newer than 5 minutes ago
        Object.entries(prev).forEach(([key, timestamp]) => {
          const timestampParts = key.split('-');
          const msgTimestamp = parseInt(timestampParts[timestampParts.length - 1]);
          
          if (!isNaN(msgTimestamp) && msgTimestamp * 1000 > fiveMinutesAgo) {
            newTimestamps[key] = timestamp;
          } else {
            cleaned++;
          }
        });
        
        if (cleaned > 0) {
          console.log(`Cleaned up ${cleaned} old message timestamps`);
        }
        
        return newTimestamps;
      });
    }, 60000); // Check every minute
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
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
      const petIdNum = parseInt(petId, 10);
      
      // For each warning type this pet has, add a message
      Object.entries(warnings).forEach(([warningType, warningMessage]) => {
        console.log(`Adding critical ${warningType} message for pet ${petId}: ${warningMessage}`);
        
        filteredMessages.push({
          type: 'pet_update',
          pet_id: petIdNum,
          update_type: 'critical_stats',
          data: {
            warnings: [warningMessage],
            warning_type: warningType,
            timestamp: Date.now() / 1000 // Current timestamp
          }
        });
      });
    });
    
    console.log("Filtered messages:", filteredMessages);
    return filteredMessages;
  }, [messages, criticalStats]);
  
  // Create a function to check if a message is a duplicate
  const isDuplicateMessage = useCallback((messageId) => {
    // If the messageId contains 'critical_stats', special handling for stats checks
    if (messageId.includes('critical_stats')) {
      // For critical stats, we'll be more lenient to ensure the initial check works
      const parts = messageId.split('-');
      const petId = parts[0];
      const updateType = parts[1];
      
      // Look for any message with the same pet ID and update type 
      // that was processed in the last second (to handle initial stats check)
      const now = Date.now() / 1000;
      
      for (const key in processedMessageTimestamps) {
        if (key.startsWith(`${petId}-${updateType}-`)) {
          const timestamp = parseFloat(key.split('-')[2]);
          // If there's a very recent message (within 0.5 seconds), consider it a duplicate
          if (now - timestamp < 0.5) {
            return true;
          }
        }
      }
      return false;
    }
    
    // For other messages, exact match is required
    return processedMessageTimestamps[messageId] === true;
  }, [processedMessageTimestamps]);
  
  return (
    <WebSocketContext.Provider value={{ 
      connected, 
      messages, // Keep original messages for reference
      sendMessage,
      getPetCriticalWarnings,
      relevantMessages: getFilteredMessages(), // Only include current relevant messages
      latestMessages: messages.slice(-20), // Keep this for backward compatibility
      isDuplicateMessage // Add this new function to check for duplicates 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};