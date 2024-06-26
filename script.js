const statusDiv = document.getElementById('status');
const coordinatesDiv = document.getElementById('coordinates');
const map = document.getElementById('map');
const mapContainer = document.getElementById('mapContainer');
const popup = document.getElementById('popup');
const deviceInfoDiv = document.getElementById('deviceInfo');
const saveLogButton = document.getElementById('saveLogButton');

const posScaleX = 0.1;
const posScaleY = -0.1;
const posOffsetX = 32;
const posOffsetY = 60;
const rotOffsetY = 0;

let isDragging = false;
let startX, startY;
let mapX = 0, mapY = 0;
let scale = 1;
const players = {};
const timeoutTimers = {};
let playerCount = 0;
const logData = {};

const userAgentID = navigator.userAgent + "_" + new Date().getTime();

map.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - mapX;
    startY = e.clientY - startY;
    map.style.cursor = 'grabbing';
});

map.addEventListener('mousemove', (e) => {
    if (isDragging) {
        mapX = e.clientX - startX;
        mapY = e.clientY - startY;
        map.style.transform = `translate(${mapX}px, ${mapY}px) scale(${scale})`;
    }
});

map.addEventListener('mouseup', () => {
    isDragging = false;
    map.style.cursor = 'grab';
});

map.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scaleAmount = 0.1;
    scale += e.deltaY > 0 ? -scaleAmount : scaleAmount;
    scale = Math.min(Math.max(0.5, scale), 5);
    map.style.transform = `translate(${mapX}px, ${mapY}px) scale(${scale})`;
});

const client = new Paho.MQTT.Client("wss://cgeeks.jp:8084/mqtt", userAgentID);

client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;
client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
});

function onConnect() {
    console.log("Connected to MQTT broker");
    statusDiv.innerHTML = "Connected to MQTT broker";
    client.subscribe("player/telemetry/#");
}

function onFailure(responseObject) {
    console.log("Failed to connect to MQTT broker: " + responseObject.errorMessage);
    statusDiv.innerHTML = "Failed to connect to MQTT broker: " + responseObject.errorMessage;
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("Connection lost: " + responseObject.errorMessage);
        statusDiv.innerHTML = "Connection lost: " + responseObject.errorMessage;
    }
}

function onMessageArrived(message) {
    const topic = message.destinationName;
    const userId = topic.split('/')[2];
    const telemetry = JSON.parse(message.payloadString);

    // Reset or start the timeout timer for the player
    resetTimeoutTimer(userId);

    const timestamp = new Date().toISOString();
    if (!logData[userId]) {
        logData[userId] = [];
    }
    logData[userId].push(`[${timestamp}] Topic: ${topic}, Message: ${message.payloadString}`);

    const x = (telemetry.posX * posScaleX) + posOffsetX;
    const y = (telemetry.posY * posScaleY) + posOffsetY;
    const rotation = telemetry.angle + rotOffsetY;

    if (!players[userId]) {
        playerCount++;
        updatePlayerCountUI();

        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        marker.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

        // Add player number to the marker
        const playerNumber = document.createElement('div');
        playerNumber.className = 'player-number';
        playerNumber.innerText = playerCount;
        marker.appendChild(playerNumber);

        // Use an image as the icon
        const icon = document.createElement('img');
        icon.src = 'player.png';
        icon.className = 'player-icon';
        marker.appendChild(icon);

        marker.addEventListener('click', () => {
            selectedUserId = userId;
            showDeviceInfo(telemetry.deviceInfo);
        });
        map.appendChild(marker);
        players[userId] = { marker, x, y, rotation, deviceInfo: telemetry.deviceInfo };
    } else {
        const marker = players[userId].marker;
        animateMarker(marker, players[userId], { x, y, rotation });
        players[userId] = { marker, x, y, rotation, deviceInfo: telemetry.deviceInfo };
    }

    // Update device info if the deviceInfoDiv is open for the current user
    if (popup.style.display === 'block' && selectedUserId === userId) {
        showDeviceInfo(players[userId].deviceInfo);
    }
}

function resetTimeoutTimer(userId) {
    if (timeoutTimers[userId]) {
        clearTimeout(timeoutTimers[userId]);
    }
    timeoutTimers[userId] = setTimeout(() => {
        removePlayer(userId);
    }, 10000); // 10 seconds
}

function removePlayer(userId) {
    if (players[userId]) {
        map.removeChild(players[userId].marker);
        delete players[userId];
        delete logData[userId];
        delete timeoutTimers[userId];
        playerCount--;
        updatePlayerCountUI();
    }
}

function normalizeAngle(angle) {
    return ((angle + 180) % 360 + 360) % 360 - 180;
}

function animateMarker(marker, from, to, duration = 1000) {
    const startTime = performance.now();

    function animate(time) {
        const elapsed = time - startTime;
        const t = Math.min(elapsed / duration, 1);
        const newX = from.x + (to.x - from.x) * t;
        const newY = from.y + (to.y - from.y) * t;

        const angleDiff = normalizeAngle(to.rotation - from.rotation);
        const newRotation = from.rotation + angleDiff * t;

        marker.style.left = `${newX}%`;
        marker.style.top = `${newY}%`;
        marker.style.transform = `translate(-50%, -50%) rotate(${newRotation}deg)`;

        if (t < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

function updatePlayerCountUI() {
    coordinatesDiv.innerHTML = `Connected Players: ${playerCount}`;
}

const batteryStatusMap = {
    "0": "Unknown",
    "1": "Charging",
    "2": "Discharging",
    "3": "NotCharging",
    "4": "Full"
};

const thermalStatusMap = {
    "-1": "Unknown",
    "0": "Nominal",
    "1": "Fair",
    "2": "Serious",
    "3": "Critical"
};

let selectedUserId = null;

function showDeviceInfo(deviceInfo) {
    let info = `<p>Device Model: ${deviceInfo.deviceModel}</p>`;
    info += `<p>Device Name: ${deviceInfo.deviceName}</p>`;
    info += `<p>Device ID: ${deviceInfo.deviceUniqueIdentifier}</p>`;
    info += `<p>OS: ${deviceInfo.operatingSystem}</p>`;
    info += `<p>Battery Level: ${(deviceInfo.batteryLevel * 100).toFixed(0)}%</p>`;
    info += `<p>Battery Status: ${batteryStatusMap[deviceInfo.batteryStatus]}</p>`;
    info += `<p>Thermal Status: ${thermalStatusMap[deviceInfo.thermalStatus]}</p>`;
    deviceInfoDiv.innerHTML = info;
    popup.style.display = 'block';
}

popup.addEventListener('click', () => {
    popup.style.display = 'none';
    selectedUserId = null;
});

saveLogButton.addEventListener('click', saveLogToFile);

function saveLogToFile() {
    const saveTime = new Date();
    const saveTimeString = saveTime.toISOString().replace(/[:.]/g, '-');
    
    Object.keys(logData).forEach(userId => {
        const logContent = logData[userId].join('\n');
        const logFileName = `mqtt_log_${userId}_${saveTimeString}.txt`;
        const blob = new Blob([logContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = logFileName;
        a.click();
        URL.revokeObjectURL(url);
    });
}
