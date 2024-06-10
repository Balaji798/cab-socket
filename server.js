const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8000;

app.use(express.json());

const users = [];  // Store connected user sockets
const drivers = [];  // Store connected driver sockets

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'user') {
        handleUserActions(data, ws);
      } else if (data.type === 'driver') {
        handleDriverActions(data, ws);
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
      // Handle the error, e.g., send an error response to the client
      ws.send(JSON.stringify({ error: 'Invalid JSON format' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Handle disconnection logic, such as removing the user or driver from the array
  });
});


function handleUserActions(data, ws) {
  if (data.action === 'requestRide') {
    let attempts = 0;
    const findAvailableDriver = () => {
      const availableDriver = drivers.find(driver => driver.available);
      if (availableDriver) {
        availableDriver.socket.send(JSON.stringify({ type: 'rideRequest', data: { userId: data.userId, location: data.location }}));
        availableDriver.available = false;
      } else {
        attempts++;
        if (attempts <= 3) {
          setTimeout(findAvailableDriver, 15000); // Retry after 15 seconds
        } else {
          ws.send(JSON.stringify({ message: 'No available drivers' }));
        }
      }
    };

    findAvailableDriver();
  }
  users.push({ userId: data.userId, socket: ws });
}


function handleDriverActions(data, ws) {
  if (data.action === 'available') {
    drivers.push({ driverId: data.driverId, socket: ws, available: true });
  } else if (data.action === 'acceptRide') {
    const user = users.find(user => user.userId === data.userId);
    if (user) {
      const otp = generateOTP();
      user.socket.send(JSON.stringify({ type: 'rideAccepted', data: { otp }}));
      ws.send(JSON.stringify({ message: 'Ride accepted', otp }));
    }
  } else if (data.action === 'rejectRide') {
    const user = users.find(user => user.userId === data.userId);
    if (user) {
      user.socket.send(JSON.stringify({ message: 'Ride rejected, try again' }));
      handleUserActions({ action: 'requestRide', userId: data.userId, location: data.location }, user.socket);
    }
  }
}

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});