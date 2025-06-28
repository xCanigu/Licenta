"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net = __importStar(require("net"));
const readline = __importStar(require("readline"));
const express_1 = __importDefault(require("express"));
const http = __importStar(require("http"));
const ws_1 = __importDefault(require("ws"));
const path_1 = __importDefault(require("path"));
const SSDP_DISCOVER = __importStar(require("./ssdp_discover"));
let CarSockets = {};
let carsInfo = Array();
// Define the TCP server address and port
const TCP_SERVER_HOST = '192.168.117.20'; //127.0.0.1   192.168.241.128
const TCP_SERVER_PORT = 6789; // 9090 for Hercules 6789 for car
const HTTP_SERVER_PORT = 3000;
// Create an Express app
const app = (0, express_1.default)();
const HTTPserver = http.createServer(app);
app.use(express_1.default.static('public'));
// SSDP routine to discover cars
setInterval(() => {
    SSDP_DISCOVER.ssdp_routine(15000, 'urn:schemas-upnp-org:device:NXP-CAR:1');
}, 15500);
// Broadcast data to all connected WebSocket clients
function broadcast(data, wss_) {
    wss_.clients.forEach((client) => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(data);
        }
    });
}
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/car-info', (req, res) => {
    carsInfo = Array.from(SSDP_DISCOVER.carsInfo);
    carsInfo = carsInfo.map(item => {
        var _a;
        item = item.root;
        delete item.specVersion;
        delete item._attributes;
        let url = new URL(item.URLBase);
        item.carName = ((_a = CarSockets[item.hostname]) === null || _a === void 0 ? void 0 : _a.carName) || item.device.UDN;
        return item;
    });
    res.status(200).json(carsInfo);
});
app.get('/', (req, res) => {
    res.status(200).sendFile(path_1.default.join(__dirname, 'public', 'cars_page.html'));
});
app.get('/car-monitor/:car_ipv4', (req, res) => {
    const carIPv4 = req.params.car_ipv4;
    if (CarSockets.hasOwnProperty(carIPv4)) {
        console.log(`Connection already exists for ${carIPv4}`);
        const carName = CarSockets[carIPv4].carName;
        if (carName) {
            // Serve the correct page immediately
            const pageFile = `monitor_page_${carName.toLowerCase()}.html`;
            const fullPath = path_1.default.join(__dirname, 'public', pageFile);
            return res.sendFile(fullPath);
        }
        else {
            CarSockets[carIPv4].pendingRes = res;
            setTimeout(() => {
                var _a;
                if ((_a = CarSockets[carIPv4]) === null || _a === void 0 ? void 0 : _a.pendingRes) {
                    console.warn(`Car ${carIPv4} did not send NAME: in time. Sending fallback monitor_page.html`);
                    CarSockets[carIPv4].pendingRes.sendFile(path_1.default.join(__dirname, 'public', 'monitor_page.html'));
                    CarSockets[carIPv4].pendingRes = undefined;
                }
            }, 10000); // 10 seconds
            return;
        }
    }
    try {
        let tcpClient = new net.Socket();
        tcpClient.on('error', (err) => {
            console.error(`Failed to connect to TCP server at ${carIPv4}:${TCP_SERVER_PORT}. Error: ${err.message}`);
            cleanupCarConnection(carIPv4);
        });
        tcpClient.on('close', (err) => {
            console.error(`TCP server closed ${carIPv4}:${TCP_SERVER_PORT}. Error: ${err}`);
            cleanupCarConnection(carIPv4);
        });
        tcpClient.connect(TCP_SERVER_PORT, carIPv4, () => {
            console.log(`Connected to TCP server at ${carIPv4}:${TCP_SERVER_PORT}`);
            let rl = readline.createInterface({
                input: tcpClient,
                output: process.stdout,
                terminal: false
            });
            // rl.on('line', (input) => {
            //     //console.log(`RECVED_TCP_CLIENT_MSG: ${input}`);
            //     if (CarSockets.hasOwnProperty(carIPv4)) {
            //         broadcast(input, CarSockets[carIPv4].wsServer);
            //     }
            // });
            let isFirstMessage = true;
            let carName = carIPv4; // default fallback
            rl.on('line', (input) => {
                var _a;
                if (isFirstMessage || !CarSockets[carIPv4].carName) {
                    const firstField = input.split(';')[0];
                    const nameMatch = firstField.match(/^NAME:(.+)$/);
                    if (nameMatch) {
                        carName = nameMatch[1].trim();
                        console.log(`Car ${carIPv4} identified as ${carName}`);
                        CarSockets[carIPv4].carName = carName;
                        const response = (_a = CarSockets[carIPv4]) === null || _a === void 0 ? void 0 : _a.pendingRes;
                        if (response) {
                            const pageFile = `monitor_page_${carName.toLowerCase()}.html`;
                            const fullPath = path_1.default.join(__dirname, 'public', pageFile);
                            response.sendFile(fullPath);
                            CarSockets[carIPv4].pendingRes = undefined;
                        }
                        isFirstMessage = false; // name found, done
                    }
                    else {
                        console.log(`First field did not contain NAME:, received: ${firstField}`);
                    }
                    // don't block broadcast, but don't consider message valid data yet
                    return;
                }
                else {
                    // your regular broadcast
                    if (CarSockets[carIPv4]) {
                        broadcast(input, CarSockets[carIPv4].wsServer);
                    }
                }
            });
            if (CarSockets.hasOwnProperty(carIPv4)) {
                return;
            }
            let wsServer = new ws_1.default.Server({ server: HTTPserver, path: `/car-monitor/${carIPv4}` });
            wsServer.on('error', (error) => {
                console.log("WebSocket server error:", error.message);
                cleanupCarConnection(carIPv4);
            });
            wsServer.on('close', () => {
                console.log("WebSocket server closed");
                cleanupCarConnection(carIPv4);
            });
            wsServer.on('connection', (ws) => {
                console.log("New WebSocket connection established");
                ws.on('message', (message) => {
                    console.log(`RECVED_WS_CLIENT_MSG: ${message}`);
                    tcpClient.write(message.toString());
                    //broadcast(message.toString(), wsServer);
                });
                ws.on('close', (err) => {
                    console.error(`Websocket closed ${carIPv4}:${TCP_SERVER_PORT}. Error: ${err}`);
                    if (CarSockets.hasOwnProperty(carIPv4) && CarSockets[carIPv4].wsServer.clients.size === 0) {
                        cleanupCarConnection(carIPv4);
                    }
                });
            });
            let carDataCommunication = {
                path: `/car-monitor/${carIPv4}`,
                tcpClient: tcpClient,
                wsServer: wsServer,
                rl: rl
            };
            CarSockets[carIPv4] = carDataCommunication;
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});
function cleanupCarConnection(carIPv4) {
    if (CarSockets.hasOwnProperty(carIPv4)) {
        CarSockets[carIPv4].rl.close();
        CarSockets[carIPv4].wsServer.close();
        CarSockets[carIPv4].tcpClient.destroy();
        delete CarSockets[carIPv4];
        console.log("closed");
    }
}
// Start the HTTP server
HTTPserver.listen(HTTP_SERVER_PORT, () => {
    console.log(`HTTP server listening on port ${HTTP_SERVER_PORT}`);
});
/*

// Start the TCP server
const tcpServer = net.createServer((socket) => {
    console.log('TCP client connected');

    const rl = readline.createInterface({
        input: socket,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', (input) => {
        console.log(`RECVED_TCP_CLIENT_MSG: ${input}`);
        // Assuming you want to broadcast to all connected WebSocket clients
        Object.values(CarSockets).forEach((carData) => {
            broadcast(input, carData.wsServer);
        });
    });

    socket.on('end', () => {
        console.log('TCP client disconnected');
    });
});

tcpServer.listen(TCP_SERVER_PORT, () => {
    console.log(`TCP server listening on port ${TCP_SERVER_PORT}`);
});
*/ 
