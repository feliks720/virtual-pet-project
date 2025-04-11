// src/components/WebSocketTest.js
import React, { useState, useEffect } from 'react';

const WebSocketTest = () => {
  const [socketStatus, setSocketStatus] = useState('Disconnected');
  const [messages, setMessages] = useState([]);
  const [testMessage, setTestMessage] = useState('Hello from client');
  
  useEffect(() => {
    // Create direct WebSocket connection to Daphne server
    const socketUrl = 'ws://localhost:8000/ws/pets/';
    
    console.log(`Attempting direct WebSocket connection to: ${socketUrl}`);
    const socket = new WebSocket(socketUrl);
    
    socket.onopen = () => {
      console.log('✅ WebSocket connection SUCCESSFUL');
      setSocketStatus('Connected');
    };
    
    socket.onmessage = (event) => {
      console.log('📨 Message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data]);
      } catch (err) {
        console.error('Error parsing message:', err);
        setMessages(prev => [...prev, { error: 'Failed to parse message', raw: event.data }]);
      }
    };
    
    socket.onerror = (error) => {
      console.error('❌ WebSocket ERROR:', error);
      setSocketStatus('Error: See console');
    };
    
    socket.onclose = (event) => {
      console.log(`⚠️ WebSocket connection closed: code=${event.code}, reason=${event.reason}`);
      setSocketStatus('Disconnected');
    };
    
    // Clean up on unmount
    return () => {
      console.log('Closing WebSocket connection...');
      socket.close();
    };
  }, []);
  
  const sendTestMessage = () => {
    try {
      if (socketStatus === 'Connected') {
        const socket = new WebSocket('ws://localhost:8000/ws/pets/');
        socket.onopen = () => {
          socket.send(JSON.stringify({ message: testMessage }));
          console.log('Test message sent');
          socket.close();
        };
      } else {
        console.error('Cannot send message, socket not connected');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };
  
  return (
    <div className="container mt-5">
      <h2>WebSocket Test</h2>
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            WebSocket Status: 
            <span className={`ms-2 badge ${socketStatus === 'Connected' ? 'bg-success' : 'bg-danger'}`}>
              {socketStatus}
            </span>
          </div>
          <div>
            <button 
              onClick={() => window.location.reload()} 
              className="btn btn-outline-secondary btn-sm"
            >
              Reconnect
            </button>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label">Send Test Message:</label>
            <div className="input-group">
              <input 
                type="text" 
                className="form-control" 
                value={testMessage} 
                onChange={(e) => setTestMessage(e.target.value)}
              />
              <button 
                className="btn btn-primary" 
                onClick={sendTestMessage}
                disabled={socketStatus !== 'Connected'}
              >
                Send
              </button>
            </div>
          </div>
          
          <h5>Received Messages:</h5>
          <div className="border rounded p-3 bg-light" style={{ minHeight: '200px', maxHeight: '300px', overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <p className="text-muted">No messages received yet</p>
            ) : (
              <ul className="list-group">
                {messages.map((msg, idx) => (
                  <li key={idx} className="list-group-item mb-2">
                    <pre className="mb-0">{JSON.stringify(msg, null, 2)}</pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="mt-3">
            <h5>Debugging Tips:</h5>
            <ul className="list-group">
              <li className="list-group-item">
                Make sure Daphne is running: <code>daphne -p 8000 virtual_pet_project.asgi:application</code>
              </li>
              <li className="list-group-item">
                Check that <code>ws://localhost:8000/ws/pets/</code> matches your routing.py path
              </li>
              <li className="list-group-item">
                Verify CORS settings in Django settings.py
              </li>
              <li className="list-group-item">
                Look at browser console (F12) for detailed error messages
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;