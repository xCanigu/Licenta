import * as ssdp from 'node-ssdp';
import * as XMlJS from 'xml-js';



let carsUrls: Set<string> = new Set();
export let carsInfo: Set<any> = new Set();

function cleanXmlJson(json: any): any {
  if (typeof json !== 'object') {
      return json;
  }
  
  if (json._text) {
      return json._text;
  }
  
  const cleaned: any = {};
  for (const key in json) {
      if (json.hasOwnProperty(key)) {
          cleaned[key] = cleanXmlJson(json[key]);
      }
  }
  return cleaned;
}

function xmlToJson(xml: string): any {
  try {
      const result = XMlJS.xml2json(xml, { compact: true, spaces: 4});
      let parsedJson = JSON.parse(result);
      return cleanXmlJson(parsedJson);
  } catch (error) {
      console.error('Error converting XML to JSON:', error);
      throw error;
  }
}

async function fetchData(url: string): Promise<void> {
  try {
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      let data_temp = await response.text();
      let json_res = xmlToJson(data_temp);
      return json_res;
      //console.log(JSON.stringify(json_res));
  } catch (error) {
      console.error('There was an error!', error);
      throw error;
  }
}

async function fetchUrls(urls: string[]): Promise<any[]> {
  try {
      // Create an array of fetch promises
      const fetchPromises = urls.map(url => fetch(url).then(response => {
          if (!response.ok) {
              throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
          }
          return response.text();
      }));

      // Wait for all promises to resolve
      const results = await Promise.all(fetchPromises);
      return results;
  } catch (error) {
      console.error('Error fetching URLs:', error);
      throw error;
  }
}




export function ssdp_routine(timeout_ms:number, deviceType:string){
  // Create an SSDP client
  const client = new ssdp.Client();
  carsUrls.clear();
  // Event handler for SSDP responses
  client.on('response', (headers, statusCode, rinfo) => {
    //console.log('Got a response to an m-search:', statusCode, headers, rinfo);
    carsUrls.add(headers.LOCATION as string)
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
          carsInfo.clear();
          responses.forEach(car => { carsInfo.add(xmlToJson(car)); });
      })
      .catch(error => {
          console.error('Error:', error);
      });
  }, timeout_ms);
}

//setInterval(ssdp_routine, 11000);





