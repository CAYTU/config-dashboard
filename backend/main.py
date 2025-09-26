from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from enum import Enum
import yaml
from jinja2 import Template
import json

app = FastAPI(title="ESPHome Config Generator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DeviceType(str, Enum):
    M30 = "m30"
    A32_PRO = "a32_pro"

class CircuitConfig(BaseModel):
    enabled: bool = False
    topic_base: str = ""
    
class A32ProCircuitConfig(BaseModel):
    enabled: bool = False
    state_topic: str = ""
    command_topic: str = ""

class NetworkConfig(BaseModel):
    type: str = Field(..., pattern="^(ethernet|wifi)$")
    wifi_ssid: Optional[str] = None
    wifi_password: Optional[str] = None

class MQTTConfig(BaseModel):
    broker: str = "0.0.0.0"
    username: str = "username"
    password: str = "password" 
    port: int = 1883
    birth_message_topic: str = ""

class ESPHomeConfig(BaseModel):
    device_type: DeviceType = DeviceType.M30
    device_name: str = "m30"
    friendly_name: str = "m30"
    circuits: Dict[int, CircuitConfig] = {}
    a32_circuits: Dict[int, A32ProCircuitConfig] = {}
    network: NetworkConfig
    mqtt: MQTTConfig
    api_key: str = "8G0kVEA0/DqgAavgKNyy9EYUrWo6pEZM38JVMAryJv8="

class M30ConfigGenerator:
    def __init__(self):
        self.circuit_to_address = {
            **{i: 100 + i - 1 for i in range(1, 11)},  
            **{i: 200 + i - 11 for i in range(11, 21)}, 
            **{i: 300 + i - 21 for i in range(21, 31)}  
        }
        
        self.voltage_registers = {10: 110, 20: 210, 30: 310}
        
    def generate_sensors(self, circuits: Dict[int, CircuitConfig]) -> List[Dict]:
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
    
    def generate_hardware_config(self) -> Dict:
        return {
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
            }]
        }

class A32ProConfigGenerator:
    def __init__(self):
        self.switch_mapping = {
            1: ('xl9535_hub_out1', 0), 2: ('xl9535_hub_out1', 1), 3: ('xl9535_hub_out1', 2), 4: ('xl9535_hub_out1', 3),
            5: ('xl9535_hub_out1', 4), 6: ('xl9535_hub_out1', 5), 7: ('xl9535_hub_out1', 6), 8: ('xl9535_hub_out1', 7),
            9: ('xl9535_hub_out1', 10), 10: ('xl9535_hub_out1', 11), 11: ('xl9535_hub_out1', 12), 12: ('xl9535_hub_out1', 13),
            13: ('xl9535_hub_out1', 14), 14: ('xl9535_hub_out1', 15), 15: ('xl9535_hub_out1', 16), 16: ('xl9535_hub_out1', 17),
            17: ('xl9535_hub_out2', 0), 18: ('xl9535_hub_out2', 1), 19: ('xl9535_hub_out2', 2), 20: ('xl9535_hub_out2', 3),
            21: ('xl9535_hub_out2', 4), 22: ('xl9535_hub_out2', 5), 23: ('xl9535_hub_out2', 6), 24: ('xl9535_hub_out2', 7),
            25: ('xl9535_hub_out2', 10), 26: ('xl9535_hub_out2', 11), 27: ('xl9535_hub_out2', 12), 28: ('xl9535_hub_out2', 13),
            29: ('xl9535_hub_out2', 14), 30: ('xl9535_hub_out2', 15), 31: ('xl9535_hub_out2', 16), 32: ('xl9535_hub_out2', 17)
        }
        
        self.input_mapping = {
            1: ('xl9535_hub_in1', 0), 2: ('xl9535_hub_in1', 1), 3: ('xl9535_hub_in1', 2), 4: ('xl9535_hub_in1', 3),
            5: ('xl9535_hub_in1', 4), 6: ('xl9535_hub_in1', 5), 7: ('xl9535_hub_in1', 6), 8: ('xl9535_hub_in1', 7),
            9: ('xl9535_hub_in1', 10), 10: ('xl9535_hub_in1', 11), 11: ('xl9535_hub_in1', 12), 12: ('xl9535_hub_in1', 13),
            13: ('xl9535_hub_in1', 14), 14: ('xl9535_hub_in1', 15), 15: ('xl9535_hub_in1', 16), 16: ('xl9535_hub_in1', 17),
            17: ('xl9535_hub_in2', 0), 18: ('xl9535_hub_in2', 1), 19: ('xl9535_hub_in2', 2), 20: ('xl9535_hub_in2', 3),
            21: ('xl9535_hub_in2', 4), 22: ('xl9535_hub_in2', 5), 23: ('xl9535_hub_in2', 6), 24: ('xl9535_hub_in2', 7),
            25: ('xl9535_hub_in2', 10), 26: ('xl9535_hub_in2', 11), 27: ('xl9535_hub_in2', 12), 28: ('xl9535_hub_in2', 13),
            29: ('xl9535_hub_in2', 14), 30: ('xl9535_hub_in2', 15), 31: ('xl9535_hub_in2', 16), 32: ('xl9535_hub_in2', 17),
            33: ('pcf8574_in_3', 0), 34: ('pcf8574_in_3', 1), 35: ('pcf8574_in_3', 2), 36: ('pcf8574_in_3', 3),
            37: ('pcf8574_in_3', 4), 38: ('pcf8574_in_3', 5), 39: ('pcf8574_in_3', 6), 40: ('pcf8574_in_3', 7)
        }
        
    def generate_switches(self, circuits: Dict[int, A32ProCircuitConfig]) -> List[Dict]:
        switches = []
        
        switches.append({
            'platform': 'gpio',
            'pin': 45,
            'name': 'LED'
        })
        
        for circuit_id, config in circuits.items():
            if not config.enabled or not config.state_topic or not config.command_topic:
                continue
                
            if circuit_id > 32:  
                continue
                
            expander, pin_num = self.switch_mapping[circuit_id]
            
            switches.append({
                'platform': 'gpio',
                'name': f'A32 Pro Switch{circuit_id:02d}',
                'id': f'a32_pro_switch{circuit_id:02d}',
                'pin': {
                    'xl9535': expander,
                    'number': pin_num,
                    'mode': 'OUTPUT',
                    'inverted': True
                },
                'state_topic': config.state_topic,
                'command_topic': config.command_topic
            })
            
        return switches
        
    def generate_binary_sensors(self) -> List[Dict]:
        sensors = []

        for i in range(1, 33):
            expander, pin_num = self.input_mapping[i]
            sensor = {
                'platform': 'gpio',
                'name': f'A32 Pro DI{i:02d}',
                'pin': {
                    'xl9535': expander,
                    'number': pin_num,
                    'mode': 'INPUT',
                    'inverted': True
                }
            }

            if i <= 4:
                sensor['id'] = f'a32_pro_di{i:02d}'
            sensors.append(sensor)
        
        additional_sensors = [
            {'name': 'A32 Pro TMP1', 'pin': {'number': 1, 'inverted': True}},
            {'name': 'A32 Pro TMP2', 'pin': {'number': 2, 'inverted': True}},
            {'name': 'A32 Pro DL', 'pin': {'number': 0, 'inverted': True}},
            {'name': 'A32 Pro DTUYA', 'pin': {'number': 21, 'inverted': True}},
        ]
        
        for i, sensor in enumerate(additional_sensors):
            sensors.insert(16 + i, {
                'platform': 'gpio',
                'name': sensor['name'],
                'pin': sensor['pin']
            })
        
        for i in range(33, 41):
            expander, pin_num = self.input_mapping[i]
            sensors.append({
                'platform': 'gpio',
                'name': f'A32 Pro DI{i:02d}',
                'pin': {
                    'pcf8574': expander,
                    'number': pin_num,
                    'mode': 'INPUT',
                    'inverted': True
                }
            })
            
        return sensors
        
    def generate_birth_message(self, circuits: Dict[int, A32ProCircuitConfig]) -> str:
        command_topics = []
        state_topics = []
        
        for circuit_id, config in circuits.items():
            if not config.enabled or not config.state_topic or not config.command_topic:
                continue
                
            command_topics.append(config.command_topic)
            state_topics.append(config.state_topic)
        
        birth_payload = {
            'command': command_topics,
            'state': state_topics
        }
        
        return json.dumps(birth_payload, indent=14)
    
    def generate_hardware_config(self) -> Dict:
        """Generate hardware configuration for A32 Pro based on official config"""
        return {
            'i2c': [{
                'id': 'bus_a',
                'sda': 11,
                'scl': 10,
                'scan': True,
                'frequency': '400kHz'
            }],
            'xl9535': [
                {'id': 'xl9535_hub_out1', 'address': 0x21},
                {'id': 'xl9535_hub_out2', 'address': 0x22},
                {'id': 'xl9535_hub_in1', 'address': 0x24},
                {'id': 'xl9535_hub_in2', 'address': 0x25}
            ],
            'pcf8574': [
                {'id': 'pcf8574_in_3', 'address': 0x23}
            ],
            'gp8403': {
                'id': 'my_gp8403',
                'voltage': '10V'
            },
            'output': [
                {'platform': 'gp8403', 'id': 'gp8403_output_1', 'gp8403_id': 'my_gp8403', 'channel': 0},
                {'platform': 'gp8403', 'id': 'gp8403_output_2', 'gp8403_id': 'my_gp8403', 'channel': 1}
            ],
            'light': [
                {'platform': 'monochromatic', 'name': 'A32 Pro-DAC-0', 'id': 'a32_pro_dac_0', 'output': 'gp8403_output_1', 'gamma_correct': 1.0},
                {'platform': 'monochromatic', 'name': 'A32 Pro-DAC-1', 'id': 'a32_pro_dac_1', 'output': 'gp8403_output_2', 'gamma_correct': 1.0}
            ],
            'sensor': [
                {
                    'platform': 'adc', 'pin': 7, 'name': 'A32 Pro A1 Voltage', 'update_interval': '5s',
                    'attenuation': '11db', 'filters': [{'lambda': 'if (x >= 3.11) { return x * 1.60256; } else if (x <= 0.15) { return 0; } else { return x * 1.51; }'}]
                },
                {
                    'platform': 'adc', 'pin': 6, 'name': 'A32 Pro A2 Voltage', 'update_interval': '5s',
                    'attenuation': '11db', 'filters': [{'lambda': 'if (x >= 3.11) { return x * 1.60256; } else if (x <= 0.15) { return 0; } else { return x * 1.51; }'}]
                },
                {
                    'platform': 'adc', 'pin': 5, 'name': 'A32 Pro A3 Current', 'update_interval': '5s',
                    'unit_of_measurement': 'mA', 'attenuation': '11db', 'filters': [{'multiply': 6.66666666}]
                },
                {
                    'platform': 'adc', 'pin': 4, 'name': 'A32 Pro A4 Current', 'update_interval': '5s',
                    'unit_of_measurement': 'mA', 'attenuation': '11db', 'filters': [{'multiply': 6.66666666}]
                }
            ]
        }

@app.post("/api/generate-config")
async def generate_config(config: ESPHomeConfig):
    try:
        if config.device_type == DeviceType.M30:
            generator = M30ConfigGenerator()
            
            sensors = generator.generate_sensors(config.circuits)
            lights = generator.generate_lights(config.circuits)
            birth_message = generator.generate_birth_message(config.circuits)
            hardware_config = generator.generate_hardware_config()
            
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
            
            esphome_config.update(hardware_config)
            esphome_config['sensor'] = sensors
            esphome_config['light'] = lights
            
        elif config.device_type == DeviceType.A32_PRO:
            generator = A32ProConfigGenerator()
            
            switches = generator.generate_switches(config.a32_circuits)
            binary_sensors = generator.generate_binary_sensors()
            birth_message = generator.generate_birth_message(config.a32_circuits)
            hardware_config = generator.generate_hardware_config()
            
            esphome_config = {
                'esphome': {
                    'name': config.device_name,
                    'friendly_name': config.friendly_name
                },
                'esp32': {
                    'board': 'esp32-s3-devkitc-1',
                    'framework': {'type': 'arduino'}  
                },
                'logger': {},  
                'api': {
                    'encryption': {'key': config.api_key}
                }
            }
            
            esphome_config.update(hardware_config)
            esphome_config['switch'] = switches
            esphome_config['binary_sensor'] = binary_sensors
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported device type")
            
        if config.network.type == 'ethernet':
            if config.device_type == DeviceType.M30:
                esphome_config['ethernet'] = {
                    'type': 'LAN8720',
                    'mdc_pin': 'GPIO23', 
                    'mdio_pin': 'GPIO18',
                    'clk_mode': 'GPIO17_OUT',
                    'phy_addr': 0
                }
            else:
                esphome_config['ethernet'] = {
                    'type': 'W5500',
                    'clk_pin': 'GPIO42',
                    'mosi_pin': 'GPIO44',
                    'miso_pin': 'GPIO40',
                    'cs_pin': 'GPIO39',
                    'interrupt_pin': 'GPIO41',
                    'reset_pin': 'GPIO43'
                }
        else:
            esphome_config['wifi'] = {
                'ssid': config.network.wifi_ssid,
                'password': config.network.wifi_password
            }
            
        # Add MQTT config with configurable birth message topic
        esphome_config['mqtt'] = {
            'broker': config.mqtt.broker,
            'username': config.mqtt.username,
            'password': config.mqtt.password,
            'port': config.mqtt.port,
            'birth_message': {
                'topic': config.mqtt.birth_message_topic or f'{config.device_name}/topics',
                'payload': birth_message
            }
        }
        
        yaml_config = yaml.dump(esphome_config, default_flow_style=False, sort_keys=False, 
                                indent=2, allow_unicode=True)
        
        return {"yaml_config": yaml_config, "birth_message": birth_message}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/")
async def api_root():
    return {"message": "ESPHome Config Generator API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)