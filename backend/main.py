from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
import yaml
from jinja2 import Template
import json

app = FastAPI(title="ESPHome M30 Config Generator", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CircuitConfig(BaseModel):
    enabled: bool = False
    topic_base: str = ""
    
class NetworkConfig(BaseModel):
    type: str = Field(..., pattern="^(ethernet|wifi)$")
    wifi_ssid: Optional[str] = None
    wifi_password: Optional[str] = None

class MQTTConfig(BaseModel):
    broker: str = "0.0.0.0"
    username: str = "username"
    password: str = "password" 
    port: int = 1883

class ESPHomeConfig(BaseModel):
    device_name: str = "m30"
    friendly_name: str = "m30"
    circuits: Dict[int, CircuitConfig] = {}
    network: NetworkConfig
    mqtt: MQTTConfig
    api_key: str = "8G0kVEA0/DqgAavgKNyy9EYUrWo6pEZM38JVMAryJv8="

class ConfigGenerator:
    def __init__(self):
        self.circuit_to_address = {
            **{i: 100 + i - 1 for i in range(1, 11)},  
            **{i: 200 + i - 11 for i in range(11, 21)},  
            **{i: 300 + i - 21 for i in range(21, 31)}  
        }
        
        self.voltage_registers = {10: 110, 20: 210, 30: 310}
        
    def generate_sensors(self, circuits: Dict[int, CircuitConfig]) -> Dict:
        sensors = []
        
        for circuit_id, config in circuits.items():
            if not config.enabled or not config.topic_base:
                continue
                
            base_addr = self.circuit_to_address[circuit_id]
            
            sensors.append({
                'platform': 'modbus_controller',
                'modbus_controller_id': 'modbus_hub_m30',
                'address': base_addr,
                'register_type': 'holding',
                'name': f'm30_{self._get_module(circuit_id)}_current_{self._get_channel(circuit_id)}',
                'id': f'm30_{self._get_module(circuit_id)}_current_{self._get_channel(circuit_id)}',
                'state_topic': f'{config.topic_base}/courant',
                'unit_of_measurement': 'A',
                'accuracy_decimals': 3,
                'value_type': 'U_WORD',
                'filters': [{'multiply': 0.00098}],
                'on_value': [{
                    'then': [{
                        'lambda': f'''
                            float current = id(m30_{self._get_module(circuit_id)}_current_{self._get_channel(circuit_id)}).state;
                            float red = (current - 0.0) / 10.0;
                            float green = (10.0 - current) / 10.0;
                            float blue = 0.0;
                           
                            auto call = id(M30_LED{circuit_id}).turn_on();
                            call.set_brightness(0.6);
                            call.set_rgb(red, green, blue);
                            call.set_color_mode(ColorMode::RGB);
                            call.perform();'''
                    }]
                }]
            })
            

            sensors.append({
                'platform': 'modbus_controller',
                'modbus_controller_id': 'modbus_hub_m30', 
                'address': base_addr + 11,
                'register_type': 'holding',
                'name': f'm30_{self._get_module(circuit_id)}_watt_{self._get_channel(circuit_id)}',
                'id': f'm30_{self._get_module(circuit_id)}_watt_{self._get_channel(circuit_id)}',
                'state_topic': f'{config.topic_base}/puissance',
                'unit_of_measurement': 'W',
                'accuracy_decimals': 1,
                'value_type': 'U_WORD',
                'filters': [{'multiply': 0.1}]
            })
            
  
            sensors.append({
                'platform': 'modbus_controller',
                'modbus_controller_id': 'modbus_hub_m30',
                'address': base_addr + 21,
                'register_type': 'holding', 
                'name': f'm30_{self._get_module(circuit_id)}_energy_{self._get_channel(circuit_id)}',
                'id': f'm30_{self._get_module(circuit_id)}_energy_{self._get_channel(circuit_id)}',
                'state_topic': f'{config.topic_base}/energie',
                'unit_of_measurement': 'kWh',
                'accuracy_decimals': 1,
                'value_type': 'U_WORD'
            })
            
     
            if circuit_id in self.voltage_registers:
                sensors.append({
                    'platform': 'modbus_controller',
                    'modbus_controller_id': 'modbus_hub_m30',
                    'address': self.voltage_registers[circuit_id],
                    'register_type': 'holding',
                    'name': f'm30_{self._get_module(circuit_id)}_voltage',
                    'id': f'm30_{self._get_module(circuit_id)}_voltage', 
                    'state_topic': f'{config.topic_base.rsplit("/", 2)[0]}/BLOC{self._get_module(circuit_id)}/voltage',
                    'unit_of_measurement': 'V',
                    'accuracy_decimals': 1,
                    'value_type': 'U_WORD',
                    'filters': [{'multiply': 0.01}]
                })
                
        return sensors
    
    def _get_module(self, circuit_id: int) -> str:
        if circuit_id <= 10:
            return "1"
        elif circuit_id <= 20:
            return "2" 
        else:
            return "3"
            
    def _get_channel(self, circuit_id: int) -> int:
        return ((circuit_id - 1) % 10) + 1
        
    def generate_lights(self, circuits: Dict[int, CircuitConfig]) -> List[Dict]:
        lights = []
        
        lights.append({
            'platform': 'esp32_rmt_led_strip',
            'id': 'light1', 
            'rgb_order': 'GRB',
            'pin': 'GPIO12',
            'num_leds': 30,
            'rmt_channel': 0,
            'chipset': 'ws2812'
        })
        

        for circuit_id in range(1, 31):
            led_index = self._get_led_index(circuit_id)
            lights.append({
                'platform': 'partition',
                'name': f'M30_LED{circuit_id}',
                'id': f'M30_LED{circuit_id}',
                'segments': [{
                    'id': 'light1',
                    'from': led_index, 
                    'to': led_index
                }]
            })
            
        return lights
    
    def _get_led_index(self, circuit_id: int) -> int:

        if circuit_id <= 10:
            return 15 - circuit_id  
        elif circuit_id <= 15:
            return circuit_id - 11    
        else:
            return circuit_id - 1   
            
    def generate_birth_message(self, circuits: Dict[int, CircuitConfig]) -> str:
        current_topics = []
        power_topics = []
        energy_topics = []
        voltage_topics = []
        
        for circuit_id, config in circuits.items():
            if not config.enabled or not config.topic_base:
                continue
                
            current_topics.append(f'{config.topic_base}/courant')
            power_topics.append(f'{config.topic_base}/puissance') 
            energy_topics.append(f'{config.topic_base}/energie')
            
            if circuit_id in self.voltage_registers:
                base_path = config.topic_base.rsplit("/", 2)[0]
                voltage_topics.append(f'{base_path}/BLOC{self._get_module(circuit_id)}/voltage')
        
        birth_payload = {
            'current': current_topics,
            'power': power_topics, 
            'energy': energy_topics,
            'voltage': voltage_topics
        }
        
        return json.dumps(birth_payload, indent=14)

generator = ConfigGenerator()

@app.post("/api/generate-config")
async def generate_config(config: ESPHomeConfig):
    try:

        sensors = generator.generate_sensors(config.circuits)
        
        lights = generator.generate_lights(config.circuits)
        
        birth_message = generator.generate_birth_message(config.circuits)
        
        esphome_config = {
            'substitutions': {f'max_current_range{i}': '10' for i in range(1, 31)},
            'esphome': {
                'name': config.device_name,
                'friendly_name': config.friendly_name
            },
            'esp32': {
                'board': 'esp32dev',
                'framework': {'type': 'arduino'}
            },
            'logger': {},
            'api': {
                'encryption': {'key': config.api_key}
            }
        }
        
        if config.network.type == 'ethernet':
            esphome_config['ethernet'] = {
                'type': 'LAN8720',
                'mdc_pin': 'GPIO23', 
                'mdio_pin': 'GPIO18',
                'clk_mode': 'GPIO17_OUT',
                'phy_addr': 0
            }
        else:
            esphome_config['wifi'] = {
                'ssid': config.network.wifi_ssid,
                'password': config.network.wifi_password
            }
            
        esphome_config.update({
            'uart': {
                'id': 'modbus_uart',
                'rx_pin': 32,
                'tx_pin': 33, 
                'baud_rate': 115200,
                'stop_bits': 1,
                'data_bits': 8,
                'parity': 'NONE'
            },
            'modbus': {
                'id': 'modbus_hub',
                'uart_id': 'modbus_uart'
            },
            'modbus_controller': [{
                'id': 'modbus_hub_m30',
                'address': 1,
                'modbus_id': 'modbus_hub', 
                'update_interval': '5s'
            }],
            'sensor': sensors,
            'light': lights,
            'mqtt': {
                'broker': config.mqtt.broker,
                'username': config.mqtt.username,
                'password': config.mqtt.password,
                'port': config.mqtt.port,
                'birth_message': {
                    'topic': f'{config.device_name}/topics',
                    'payload': birth_message
                }
            }
        })
        
        yaml_config = yaml.dump(esphome_config, default_flow_style=False, sort_keys=False)
        
        return {"yaml_config": yaml_config, "birth_message": birth_message}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "ESPHome M30 Config Generator API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)