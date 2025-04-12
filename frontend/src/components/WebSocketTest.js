// src/components/WebSocketTest.js
import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const WebSocketTest = () => {
  const { connected, latestMessages, sendMessage } = useWebSocket();
  const [testMessage, setTestMessage] = useState('Hello from client');
  
  const sendTestMessage = () => {
    try {
      if (connected) {
        // Use the shared sendMessage function from the context
        const success = sendMessage({ message: testMessage });
        if (success) {
          console.log('Test message sent');
        } else {
          console.error('Failed to send message');
        }
      } else {
        console.error('Cannot send message, socket not connected');
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };
  
  return (
    <div className="container mt-5">
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
      <h2>WebSocket Test</h2>
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            WebSocket Status: 
            <span className={`ms-2 badge ${connected ? 'bg-success' : 'bg-danger'}`}>
              {connected ? 'Connected' : 'Disconnected'}
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
                disabled={!connected}
              >
                Send
              </button>
            </div>
          </div>
          
          {/* Test toast notification button */}
          <div className="mb-3">
            <button 
              onClick={() => {
                toast.warning("Test toast notification");
                console.log("Test toast triggered");
              }}
              className="btn btn-warning"
            >
              Test Toast Notification
            </button>
          </div>

          {/* Direct WebSocket test button */}
          <div className="mb-3">
            <button 
              onClick={() => {
                const testData = {
                  type: 'pet_update',
                  pet_id: 2,
                  update_type: 'critical_stats',
                  data: {warnings: ['Test direct WebSocket message']}
                };
                
                console.log("Sending test data via context:", testData);
                sendMessage(testData);
              }}
              className="btn btn-info text-white"
              disabled={!connected}
            >
              Send Test Pet Update
            </button>
          </div>
          
          <h5>Received Messages:</h5>
          <div className="border rounded p-3 bg-light" style={{ minHeight: '200px', maxHeight: '300px', overflowY: 'auto' }}>
            {latestMessages.length === 0 ? (
              <p className="text-muted">No messages received yet</p>
            ) : (
              <ul className="list-group">
                {latestMessages.map((msg, idx) => (
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
              <li className="list-group-item">
                Authentication token is now automatically included in WebSocket connections
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;