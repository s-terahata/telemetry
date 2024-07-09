const statusDiv = document.getElementById('status');
const coordinatesDiv = document.getElementById('coordinates');
const deviceList = document.getElementById('deviceList')
const map = document.getElementById('map');
const mapContainer = document.getElementById('mapContainer');
const popup = document.getElementById('popup');
const deviceInfoDiv = document.getElementById('deviceInfo');
const saveLogButton = document.getElementById('saveLogButton');
const saveLogAllButton = document.getElementById('saveLogAllButton');
const forceStopButton = document.getElementById('forceStopButton');
const mapInfoDiv = document.getElementById('mapInfo');

// �ݒ�l
const mqttBrokerUrl = "wss://cgeeks.jp:8084/mqtt";
const subscribeTopic = "player/telemetry/#"
const posScaleX = 0.1;
const posScaleY = -0.1;
const posOffsetX = 32;
const posOffsetY = 60;
const rotOffsetY = 0;

const userAgentID = navigator.userAgent + "_" + new Date().getTime();

// �o�b�e���[���
const batteryStatusMap = {
    "0": "Unknown",
    "1": "Charging",
    "2": "Discharging",
    "3": "NotCharging",
    "4": "Full"
};

// �M���
const thermalStatusMap = {
    "-1": "Unknown",
    "0": "Nominal",
    "1": "Fair",
    "2": "Serious",
    "3": "Critical"
};

// �r���[�|�[�g�̃T�C�Y
let viewportOriginWidth = 0;
let viewportOriginHeight = 0;
let viewportWidth = 0;
let viewportHeight = 0;

let isDragging = false;
let startX, startY;

let mapX = 0, mapY = 0;
let scale = 1;

const players = {};
const timeoutTimers = {};
let playerCount = 0;
const logData = {};

// �I�𒆂̃��[�U�[ID
let selectedUserId = null;

// �E�C���h�E���[�h���̏���
window.addEventListener('load', () => {
    viewportWidthOrigin = window.innerWidth;
    viewportHeightOrigin = window.innerHeight;
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
});

// �r���[�|�[�g�̃T�C�Y�ύX���̏���
window.addEventListener('resize', () => {
    const diffX = (window.innerWidth - viewportWidth) / viewportWidthOrigin;
    const diffY = (window.innerHeight - viewportHeight) / viewportHeightOrigin;
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    Object.keys(players).forEach(key => {
        // �ʒu�̕␳
        const player = players[key]
        player.x = player.x + diffX;
        player.y = player.y + diffY;
        // �}�[�J�[�ʒu�̍X�V
        const marker = player.marker;
        marker.style.left = `${player.x}%`;
        marker.style.top = `${player.y}%`;
    });
});

// �}�b�v��Ń}�E�X�{�^������
map.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - mapX;
    startY = e.clientY - mapY;
    map.style.cursor = 'grabbing';
});

// �}�b�v��Ń}�E�X����
map.addEventListener('mousemove', (e) => {
    if (isDragging) {
        mapX = e.clientX - startX;
        mapY = e.clientY - startY;
        changeMapTransform()
    }
});

// �}�b�v��Ń}�E�X�{�^������
map.addEventListener('mouseup', () => {
    isDragging = false;
    map.style.cursor = 'grab';
});

// �}�b�v��Ń}�E�X�z�C�[��
map.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scaleAmount = 0.1;
    scale += e.deltaY > 0 ? -scaleAmount : scaleAmount;
    scale = Math.min(Math.max(0.5, scale), 5);
    changeMapTransform()
});

function changeMapTransform() {
    map.style.transform = `translate(${mapX}px, ${mapY}px) scale(${scale})`;
}

// MQTT�N���C�A���g�{��
const client = new Paho.MQTT.Client(mqttBrokerUrl, userAgentID);

client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;
client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
});

// ���b�Z�[�W���M
function publishMessage(topic, payload) {
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    client.send(message)
    console.log(`Message published: Topic: ${topic}, Payload: ${payload}`)
}

// �ڑ�������
function onConnect() {
    console.log("Connected to MQTT broker");
    statusDiv.innerHTML = "Connected to MQTT broker";
    client.subscribe(subscribeTopic);
}

// �ڑ����s��
function onFailure(responseObject) {
    console.log("Failed to connect to MQTT broker: " + responseObject.errorMessage);
    statusDiv.innerHTML = "Failed to connect to MQTT broker: " + responseObject.errorMessage;
}

// �ؒf��
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.log("Connection lost: " + responseObject.errorMessage);
        statusDiv.innerHTML = "Connection lost: " + responseObject.errorMessage;
    }
}

// ���b�Z�[�W��M��
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

        // �}�b�v�Ƀ}�[�J�[��ǉ�
        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        marker.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;

        // �v���C���[�ԍ����}�[�J�[�ɒǉ�
        const playerNumber = document.createElement('div');
        playerNumber.className = 'player-number';
        playerNumber.innerText = playerCount;
        marker.appendChild(playerNumber);

        // �A�C�R���Ƃ���img�^�O���쐬
        const icon = document.createElement('img');
        icon.src = 'player.png';
        icon.className = 'player-icon';
        marker.appendChild(icon);
        // �}�[�J�[�N���b�N������
        marker.addEventListener('click', () => {
            onSelectDevice(userId, telemetry.deviceInfo)
            scrollSelectItem(userId)
        });
        map.appendChild(marker);

        // ���X�g�Ƀf�o�C�X����ǉ�
        const listItem = createListItem(playerCount, telemetry.deviceInfo)
        // ���X�g���ڃN���b�N������
        listItem.addEventListener('click', () => {
            onSelectDevice(userId, telemetry.deviceInfo)
        });
        deviceList.appendChild(listItem);

        // �v���C���[�����X�V
        players[userId] = { number: playerCount, marker, listItem, x, y, rotation, deviceInfo: telemetry.deviceInfo };
    } else {
        // �����̃v���C���[�����X�V
        const marker = players[userId].marker;
        animateMarker(marker, players[userId], { x, y, rotation });
        const listItem = players[userId].listItem
        updateListItem(listItem, telemetry.deviceInfo)
        players[userId] = { number: players[userId].number, marker, listItem, x, y, rotation, deviceInfo: telemetry.deviceInfo };
    }

    // Update device info if the deviceInfoDiv is open for the current user
    if (popup.style.display === 'block' && selectedUserId === userId) {
        showDeviceInfo(players[userId].number, players[userId].deviceInfo);
    }
}

// �}�[�J�[�܂��̓��X�g���ڂ�I�������Ƃ��̏���
function onSelectDevice(userId) {
    selectedUserId = userId;
    changeSelectPlayer()
    showDeviceInfo(players[userId].number, players[userId].deviceInfo);
}

// �v���C���[���̍X�V
function changeSelectPlayer() {
    Object.keys(players).forEach(key => {
        players[key].marker.classList.remove('selected')
        players[key].listItem.classList.remove('selected')
    })
    players[selectedUserId].marker.classList.add('selected')
    players[selectedUserId].listItem.classList.add('selected')
    focusPlayerMarker(selectedUserId);
}

// �I���������ڂ܂ŃX�N���[������
function scrollSelectItem(userId) {
    const itemRect = players[userId].listItem.getBoundingClientRect();
    const containerRect = deviceList.getBoundingClientRect();
    const scrollTo = itemRect.top - containerRect.top + deviceList.scrollTop;
    deviceList.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
    });

}

// �I�������}�[�J�[�𒆐S�ɕ\������
function focusPlayerMarker(userId) {
    const marker = players[userId].marker;
    // �n�}�̒��S
    const mapRect = map.getBoundingClientRect();
    const mapCenterX = mapRect.left + mapRect.width / 2
    const mapCenterY = mapRect.top + mapRect.height / 2
    // �I���}�[�J�[�̒��S
    const markerRect = marker.getBoundingClientRect();
    const markerCenterX = markerRect.left + markerRect.width / 2
    const markerCenterY = markerRect.top + markerRect.height / 2
    // �ʒu���v�Z
    mapX = Math.floor(mapCenterX - markerCenterX);
    mapY = Math.floor(mapCenterY - markerCenterY);

    changeMapTransform()
}

// �^�C���A�E�g���Z�b�g
function resetTimeoutTimer(userId) {
    if (timeoutTimers[userId]) {
        clearTimeout(timeoutTimers[userId]);
    }
    timeoutTimers[userId] = setTimeout(() => {
        removePlayer(userId);
    }, 10000); // 10 seconds
}

// �v���C���[�ؒf
function removePlayer(userId) {
    if (players[userId]) {
        deviceList.removeChild(players[userId].listItem)
        map.removeChild(players[userId].marker);
        delete players[userId];
        delete logData[userId];
        delete timeoutTimers[userId];
        playerCount--;
        updatePlayerCountUI();
    }
}

// �p�x�̐��K��
function normalizeAngle(angle) {
    return ((angle + 180) % 360 + 360) % 360 - 180;
}

// �}�[�J�[�̃A�j���[�V����
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

// ���X�g�A�C�e���̍쐬
function createListItem(playerCount, deviceInfo) {
    const itemHeader = document.createElement('h3');
    itemHeader.innerHTML = `Device ${playerCount}`

    const itemBody = document.createElement('dl');
    itemBody.classList.add("definition-list")
//  itemBody.innerHTML = createListItemHtml(deviceInfo)

    const listItem = document.createElement('li');
    listItem.classList.add('information');
    listItem.appendChild(itemHeader);
    listItem.appendChild(itemBody);

    return listItem;
}

// ���X�g�A�C�e���̍X�V
function updateListItem(listItem, deviceInfo) {
    const itemBody = listItem.querySelector(".definition-list");
//  itemBody.innerHTML = createListItemHtml(deviceInfo)
}

// ���X�g�A�C�e���̓��e�쐬
function createListItemHtml(deviceInfo) {
    let itemText = `<dt>Connection</dt><dd>Connected</dd>`;
    itemText += `<dt>Battery Level</dt><dd>${(deviceInfo.batteryLevel * 100).toFixed(0)}%</dd>`;
    itemText += `<dt>Battery Status</dt><dd>${batteryStatusMap[deviceInfo.batteryStatus]}</dd>`;
    itemText += `<dt>Thermal Status</dt><dd>${thermalStatusMap[deviceInfo.thermalStatus]}</dd>`;
    return itemText;
}

// �v���C���[�v��UI�̍X�V
function updatePlayerCountUI() {
    coordinatesDiv.innerHTML = `Connected Players: ${playerCount}`;
}

// �f�o�C�X���̕\��
function showDeviceInfo(number, deviceInfo) {
    // �w�b�_���
    const header = popup.querySelector("h2")
    header.innerHTML = `Device ${number} Info`
    // �{�̏��
    const body = deviceInfoDiv.querySelector(".definition-list");
    let info = `<dt>Device Model</dt><dd>${deviceInfo.deviceModel}</dd>`;
    info += `<dt>Device Name</dt><dd>${deviceInfo.deviceName}</dd>`;
    info += `<dt>Device ID</dt><dd>${deviceInfo.deviceUniqueIdentifier}</dd>`;
    info += `<dt>OS</dt><dd>${deviceInfo.operatingSystem}</dd>`;
    info += `<dt>Battery Level</dt><dd>${(deviceInfo.batteryLevel * 100).toFixed(0)}%</dd>`;
    info += `<dt>Battery Status</dt><dd>${batteryStatusMap[deviceInfo.batteryStatus]}</dd>`;
    info += `<dt>Thermal Status</dt><dd>${thermalStatusMap[deviceInfo.thermalStatus]}</dd>`;
    body.innerHTML = info;

    popup.style.display = 'block';
}

// �|�b�v�A�b�v�N���b�N��
popup.addEventListener('click', () => {
    popup.style.display = 'none';
    selectedUserId = null;
});

// �S���O�ۑ��{�^���N���b�N
saveLogAllButton.addEventListener('click', saveLogToFileAll);

// ���O�ۑ��{�^���N���b�N
saveLogButton.addEventListener('click', () => {
    const saveTime = new Date();
    const saveTimeString = saveTime.toISOString().replace(/[:.]/g, '-');
    saveLogToFile(selectedUserId, saveTimeString);
});

// �S�̂̃��O�t�@�C���o��
function saveLogToFileAll() {
    const saveTime = new Date();
    const saveTimeString = saveTime.toISOString().replace(/[:.]/g, '-');
    
    Object.keys(logData).forEach(userId => {
        saveLogToFile(userId, saveTimeString);
    });
}

// �w�胆�[�U�[�̃��O���o��
function saveLogToFile(userId, timeString) {
    const logContent = logData[userId].join('\n');
    const logFileName = `mqtt_log_${userId}_${timeString}.txt`;
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logFileName;
    a.click();
    URL.revokeObjectURL(url);
}

// �ً}��~�{�^���N���b�N
forceStopButton.addEventListener('click', () => {
    publishStopSignal(selectedUserId);
});

// �ً}��~�̃V�O�i����MQTT�Ŕ��M
function publishStopSignal(userId) {
    // ���b�Z�[�W���e�A�g�s�b�N����̂��߃��O�����o��
    console.log(`Stopped Player ${userId}.`)
}