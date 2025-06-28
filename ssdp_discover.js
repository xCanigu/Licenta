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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.carsInfo = void 0;
exports.ssdp_routine = ssdp_routine;
const ssdp = __importStar(require("node-ssdp"));
const XMlJS = __importStar(require("xml-js"));
let carsUrls = new Set();
exports.carsInfo = new Set();
function cleanXmlJson(json) {
    if (typeof json !== 'object') {
        return json;
    }
    if (json._text) {
        return json._text;
    }
    const cleaned = {};
    for (const key in json) {
        if (json.hasOwnProperty(key)) {
            cleaned[key] = cleanXmlJson(json[key]);
        }
    }
    return cleaned;
}
function xmlToJson(xml) {
    try {
        const result = XMlJS.xml2json(xml, { compact: true, spaces: 4 });
        let parsedJson = JSON.parse(result);
        return cleanXmlJson(parsedJson);
    }
    catch (error) {
        console.error('Error converting XML to JSON:', error);
        throw error;
    }
}
function fetchData(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(url);
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            let data_temp = yield response.text();
            let json_res = xmlToJson(data_temp);
            return json_res;
            //console.log(JSON.stringify(json_res));
        }
        catch (error) {
            console.error('There was an error!', error);
            throw error;
        }
    });
}
function fetchUrls(urls) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Create an array of fetch promises
            const fetchPromises = urls.map(url => fetch(url).then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                }
                return response.text();
            }));
            // Wait for all promises to resolve
            const results = yield Promise.all(fetchPromises);
            return results;
        }
        catch (error) {
            console.error('Error fetching URLs:', error);
            throw error;
        }
    });
}
function ssdp_routine(timeout_ms, deviceType) {
    // Create an SSDP client
    const client = new ssdp.Client();
    carsUrls.clear();
    // Event handler for SSDP responses
    client.on('response', (headers, statusCode, rinfo) => {
        //console.log('Got a response to an m-search:', statusCode, headers, rinfo);
        carsUrls.add(headers.LOCATION);
    });
    // Perform an SSDP search
    //client.search('ssdp:all');
    // Alternatively, you can search for a specific service type
    client.search(deviceType);
    // Close the client after a timeout
    setTimeout(() => {
        client.stop();
        //console.log('Stopped SSDP client');
        console.log(carsUrls);
        //carsInfo.forEach(x=> {console.log(JSON.stringify(x, null, 2));});
        fetchUrls(Array.from(carsUrls))
            .then(responses => {
            console.log('Fetched responses:', responses);
            exports.carsInfo.clear();
            responses.forEach(car => { exports.carsInfo.add(xmlToJson(car)); });
        })
            .catch(error => {
            console.error('Error:', error);
        });
    }, timeout_ms);
}
//setInterval(ssdp_routine, 11000);
