import React, { useState, useEffect } from 'react';
import { 
  Download, Settings, Wifi, Monitor, Database, Zap, Cpu, 
  CheckCircle, AlertCircle, ChevronRight, Copy, Eye, EyeOff,
  Sparkles, Network, Router, MessageSquare, Key
} from 'lucide-react';

const ESPHomeConfigGenerator = () => {
  const [config, setConfig] = useState({
    device_type: 'm30',
    device_name: 'm30',
    friendly_name: 'm30',
    api_key: '8G0kVEA0/DqgAavgKNyy9EYUrWo6pEZM38JVMAryJv8=',
    circuits: Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      enabled: false,
      topic_base: ''
    })),
    a32_circuits: Array.from({ length: 32 }, (_, i) => ({
      id: i + 1,
      enabled: false,
      state_topic: '',
      command_topic: ''
    })),
    network: {
      type: 'ethernet',
      wifi_ssid: '',
      wifi_password: ''
    },
    mqtt: {
      broker: '0.0.0.0',
      username: 'username',
      password: 'password',
      port: 1883,
      birth_message_topic: ''
    }
  });

  const [generatedConfig, setGeneratedConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('device-type');
  const [showPasswords, setShowPasswords] = useState({});
  const [configCopied, setConfigCopied] = useState(false);
  const [completionStatus, setCompletionStatus] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem('esphome-config');
    if (saved) {
      try {
        const parsedConfig = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsedConfig }));
      } catch (e) {
        console.warn('Failed to load saved config');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('esphome-config', JSON.stringify(config));
    updateCompletionStatus();
  }, [config]);

  const updateCompletionStatus = () => {
    const status = {
      device: !!(config.device_name && config.friendly_name),
      circuits: getCurrentCircuits().some(c => c.enabled),
      network: config.network.type === 'ethernet' || 
               (config.network.wifi_ssid && config.network.wifi_password),
      mqtt: !!(config.mqtt.broker && config.mqtt.username)
    };
    setCompletionStatus(status);
  };

  const togglePassword = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const updateCircuit = (index, field, value) => {
    if (config.device_type === 'm30') {
      const newCircuits = [...config.circuits];
      newCircuits[index][field] = value;
      setConfig({ ...config, circuits: newCircuits });
    } else {
      const newCircuits = [...config.a32_circuits];
      newCircuits[index][field] = value;
      setConfig({ ...config, a32_circuits: newCircuits });
    }
  };

  const toggleAllCircuits = (enabled) => {
    if (config.device_type === 'm30') {
      const newCircuits = config.circuits.map(circuit => ({
        ...circuit,
        enabled,
        topic_base: enabled ? circuit.topic_base || `TOPICS-PREFIX/LOCATION-${circuit.id}/Device` : circuit.topic_base
      }));
      setConfig({ ...config, circuits: newCircuits });
    } else {
      const newCircuits = config.a32_circuits.map(circuit => ({
        ...circuit,
        enabled,
        state_topic: enabled ? circuit.state_topic || `TOPICS-PREFIX/LOCATION-${circuit.id}/Device/state` : circuit.state_topic,
        command_topic: enabled ? circuit.command_topic || `TOPICS-PREFIX/LOCATION-${circuit.id}/Device/command` : circuit.command_topic
      }));
      setConfig({ ...config, a32_circuits: newCircuits });
    }
  };

  const getCurrentCircuits = () => {
    return config.device_type === 'm30' ? config.circuits : config.a32_circuits;
  };

  const getMaxCircuits = () => {
    return config.device_type === 'm30' ? 30 : 32;
  };

  const generateConfig = async () => {
    setLoading(true);
    try {
      const requestData = {
        device_type: config.device_type,
        device_name: config.device_name,
        friendly_name: config.friendly_name,
        api_key: config.api_key,
        network: config.network,
        mqtt: config.mqtt
      };

      if (config.device_type === 'm30') {
        requestData.circuits = config.circuits.reduce((acc, circuit) => {
          acc[circuit.id] = {
            enabled: circuit.enabled,
            topic_base: circuit.topic_base
          };
          return acc;
        }, {});
      } else {
        requestData.a32_circuits = config.a32_circuits.reduce((acc, circuit) => {
          acc[circuit.id] = {
            enabled: circuit.enabled,
            state_topic: circuit.state_topic,
            command_topic: circuit.command_topic
          };
          return acc;
        }, {});
      }

      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Failed to generate config');
      }

      const result = await response.json();
      setGeneratedConfig(result.yaml_config);
    } catch (error) {
      alert('Error generating config: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadConfig = () => {
    const blob = new Blob([generatedConfig], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.device_name}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(generatedConfig);
      setConfigCopied(true);
      setTimeout(() => setConfigCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy config');
    }
  };

  const enabledCount = getCurrentCircuits().filter(c => c.enabled).length;
  const maxCircuits = getMaxCircuits();
  const isConfigComplete = Object.values(completionStatus).every(Boolean);

  const TabButton = ({ id, name, icon: Icon, status }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`group flex items-center gap-3 py-4 px-4 border-b-2 font-medium text-sm transition-all duration-200 ${
        activeTab === id
          ? 'border-blue-500 text-blue-600 bg-blue-50/50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{name}</span>
      {status && (
        <CheckCircle className="w-3 h-3 text-green-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
      {activeTab === id && <ChevronRight className="w-3 h-3 ml-auto" />}
    </button>
  );

  const StatusCard = ({ title, description, status, icon: Icon }) => (
    <div className={`p-4 rounded-lg border transition-all duration-200 ${
      status ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${status ? 'text-green-600' : 'text-gray-400'}`} />
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{title}</h4>
          <p className="text-xs text-gray-600">{description}</p>
        </div>
        {status && <CheckCircle className="w-4 h-4 text-green-500" />}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-indigo-50/10">
<div className="w-full px-4 py-6">
 
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                KINCONY CONFIGURATION DASHBOARD
              </h1>
              <p className="text-gray-600 mt-1 max-w-lg">
                This tool allow us to generate ESPHome configurations for Kincony Board with real-time validation
              </p>
            </div>
          </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <StatusCard 
                  title="Device" 
                  description="Type & settings"
                  status={completionStatus.device}
                  icon={Cpu}
                  gradient={completionStatus.device ? "from-blue-500 to-blue-600" : "from-gray-300 to-gray-400"}
                />
                <StatusCard 
                  title={config.device_type === 'm30' ? "Circuits" : "Switches"} 
                  description={`${enabledCount}/${maxCircuits} enabled`}
                  status={completionStatus.circuits}
                  icon={config.device_type === 'm30' ? Database : Zap}
                  gradient={completionStatus.circuits ? "from-green-500 to-green-600" : "from-gray-300 to-gray-400"}
                />
                <StatusCard 
                  title="Network" 
                  description={config.network.type}
                  status={completionStatus.network}
                  icon={Network}
                  gradient={completionStatus.network ? "from-purple-500 to-purple-600" : "from-gray-300 to-gray-400"}
                />
                <StatusCard 
                  title="MQTT" 
                  description="Broker configured"
                  status={completionStatus.mqtt}
                  icon={MessageSquare}
                  gradient={completionStatus.mqtt ? "from-indigo-500 to-indigo-600" : "from-gray-300 to-gray-400"}
                />
              </div>
</div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
 
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

              <div className="border-b border-gray-100 bg-gray-50/50">
                <nav className="flex">
                  <TabButton 
                    id="device-type" 
                    name="Device" 
                    icon={Cpu}
                    status={completionStatus.device}
                  />
                  <TabButton 
                    id="circuits" 
                    name={config.device_type === 'm30' ? 'Circuits' : 'Switches'}
                    icon={config.device_type === 'm30' ? Database : Zap}
                    status={completionStatus.circuits}
                  />
                  <TabButton 
                    id="network" 
                    name="Network" 
                    icon={config.network.type === 'wifi' ? Wifi : Monitor}
                    status={completionStatus.network}
                  />
                  <TabButton 
                    id="device-settings" 
                    name="Settings" 
                    icon={Settings}
                    status={completionStatus.device}
                  />
                </nav>
              </div>
              <div className="p-8 bg-gradient-to-b from-white via-white/95 to-white/90">
{activeTab === 'device-type' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Choose Your Device
                      </h2>
                      <p className="text-gray-600">
                        Select the Kincony device you want to configure
                      </p>
                    </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
{[
                        {
                          type: 'm30',
                          name: 'Kincony M30',
                          description: 'Energy monitoring with 30 circuits',
                          icon: Database,
                          color: 'blue',
                          features: [
                            'Current, Power, Energy sensors',
                            'RGB LED status indicators', 
                            'Modbus RTU communication',
                            'ESP32 + LAN8720 Ethernet'
                          ]
                        },
                        {
                          type: 'a32_pro',
                          name: 'Kincony A32 Pro',
                          description: 'Relay control with 32 switches',
                          icon: Zap,
                          color: 'green',
                          features: [
                            '32 relay outputs',
                            '40 digital inputs',
                            'I2C expanders (XL9535, PCF8574)',
                            'ESP32-S3 + W5500 Ethernet'
                          ]
                        }
                      ].map(device => (
                        <div
                          key={device.type}
                          className={`group p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 ${
                            config.device_type === device.type
                              ? `border-${device.color}-500 bg-gradient-to-br from-${device.color}-50/70 to-white shadow-lg`
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
onClick={() => setConfig({ 
                            ...config, 
                            device_type: device.type, 
                            device_name: device.type === 'm30' ? 'm30' : 'a32-pro',
                            friendly_name: device.type === 'm30' ? 'M30 Energy Monitor' : 'A32 Pro Controller'
                          })}
                        >
                          <div className="flex items-center mb-4">
                            <div className={`p-3 rounded-xl mr-4 ${
                              config.device_type === device.type
                                ? `bg-${device.color}-100`
                                : 'bg-gray-100 group-hover:bg-gray-200'
                            }`}>
                              <device.icon className={`w-6 h-6 ${
                                config.device_type === device.type
                                  ? `text-${device.color}-600`
                                  : 'text-gray-600'
                              }`} />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
                              <p className="text-sm text-gray-600">{device.description}</p>
                            </div>
                          </div>
                          <ul className="space-y-2">
                            {device.features.map((feature, idx) => (
                              <li key={idx} className="flex items-center text-sm text-gray-600">
                                <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'circuits' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                          {config.device_type === 'm30' ? 'Circuit Configuration' : 'Switch Configuration'}
                        </h2>
                        <p className="text-gray-600">
                          Configure MQTT topics for your {config.device_type === 'm30' ? 'energy monitoring circuits' : 'relay switches'}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span className={`px-3 py-1 rounded-full ${
                            enabledCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {enabledCount} of {maxCircuits} enabled
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAllCircuits(true)}
                          className="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Enable All
                        </button>
                        <button
                          onClick={() => toggleAllCircuits(false)}
                          className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Disable All
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3 h-[calc(100vh-400px)] overflow-y-auto pr-2">
{getCurrentCircuits().map((circuit, index) => (
                        <div
                          key={circuit.id}
                          className={`p-4 border rounded-xl transition-all duration-200 ${
                            circuit.enabled 
                              ? 'border-blue-200 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-4 w-full">
<div className="flex items-center pt-1">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={circuit.enabled}
                                onChange={(e) => updateCircuit(index, 'enabled', e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
<div className="ml-3">
                                <span className="text-sm font-medium text-gray-900">
                                  {config.device_type === 'm30' ? `Circuit ${circuit.id}` : `Switch ${circuit.id}`}
                                </span>
                                {config.device_type === 'm30' && [10, 20, 30].includes(circuit.id) && (
                                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                    +Voltage
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 w-full">
                              {config.device_type === 'm30' ? (
                                <div className="w-full">
                                  <input
                                    type="text"
                                    placeholder="e.g., TOPICS-PREFIX/BUREAU-DIRECTEUR/Climatiseur"
                                    value={circuit.topic_base}
                                    onChange={(e) => updateCircuit(index, 'topic_base', e.target.value)}
                                    disabled={!circuit.enabled}
                                    className={`w-full px-4 py-3 border rounded-lg transition-all ${
                                      circuit.enabled
                                        ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white'
                                        : 'border-gray-200 bg-gray-100 text-gray-400'
                                    }`}
                                  />
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
<input
                                    type="text"
                                    placeholder="State topic (e.g., .../state)"
                                    value={circuit.state_topic}
                                    onChange={(e) => updateCircuit(index, 'state_topic', e.target.value)}
                                    disabled={!circuit.enabled}
                                    className={`w-full px-4 py-2 text-sm border rounded-lg transition-all ${
                                      circuit.enabled
                                        ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white'
                                        : 'border-gray-200 bg-gray-100 text-gray-400'
                                    }`}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Command topic (e.g., .../command)"
                                    value={circuit.command_topic}
                                    onChange={(e) => updateCircuit(index, 'command_topic', e.target.value)}
                                    disabled={!circuit.enabled}
                                    className={`w-full px-4 py-2 text-sm border rounded-lg transition-all ${
                                      circuit.enabled
                                        ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white'
                                        : 'border-gray-200 bg-gray-100 text-gray-400'
                                    }`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'network' && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Network Configuration
                      </h2>
                      <p className="text-gray-600">
                        Configure how your device connects to the network
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-4">
                          Connection Type
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { type: 'ethernet', icon: Monitor, label: 'Ethernet', desc: 'Wired connection' },
                            { type: 'wifi', icon: Wifi, label: 'WiFi', desc: 'Wireless connection' }
                          ].map(({ type, icon: Icon, label, desc }) => (
                            <label key={type} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                              config.network.type === type
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}>
                              <input
                                type="radio"
                                checked={config.network.type === type}
                                onChange={() => setConfig({
                                  ...config,
                                  network: { ...config.network, type }
                                })}
                                className="sr-only"
                              />
                              <Icon className={`w-5 h-5 mr-3 ${
                                config.network.type === type ? 'text-blue-600' : 'text-gray-400'
                              }`} />
                              <div>
                                <div className="font-medium text-gray-900">{label}</div>
                                <div className="text-xs text-gray-500">{desc}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {config.network.type === 'wifi' && (
                  <div className="p-6 bg-gradient-to-br from-gray-50/70 to-white rounded-xl space-y-4 shadow-sm">
<h3 className="font-semibold text-gray-900 flex items-center">
                            <Wifi className="w-4 h-4 mr-2" />
                            WiFi Settings
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Network Name (SSID)
                              </label>
                              <input
                                type="text"
                                value={config.network.wifi_ssid}
                                onChange={(e) => setConfig({
                                  ...config,
                                  network: { ...config.network, wifi_ssid: e.target.value }
                                })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Your WiFi Network Name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                              </label>
                              <div className="relative">
                                <input
                                  type={showPasswords.wifi ? "text" : "password"}
                                  value={config.network.wifi_password}
                                  onChange={(e) => setConfig({
                                    ...config,
                                    network: { ...config.network, wifi_password: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="WiFi Password"
                                />
                                <button
                                  type="button"
                                  onClick={() => togglePassword('wifi')}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                  {showPasswords.wifi ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  <div className="p-6 bg-gradient-to-br from-gray-50/70 to-white rounded-xl space-y-6 shadow-sm">
<h3 className="font-semibold text-gray-900 flex items-center">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          MQTT Broker Settings
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Broker IP Address
                            </label>
                            <input
                              type="text"
                              value={config.mqtt.broker}
                              onChange={(e) => setConfig({
                                ...config,
                                mqtt: { ...config.mqtt, broker: e.target.value }
                              })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="192.168.1.100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Port
                            </label>
                            <input
                              type="number"
                              value={config.mqtt.port}
                              onChange={(e) => setConfig({
                                ...config,
                                mqtt: { ...config.mqtt, port: parseInt(e.target.value) || 1883 }
                              })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="1883"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Username
                            </label>
                            <input
                              type="text"
                              value={config.mqtt.username}
                              onChange={(e) => setConfig({
                                ...config,
                                mqtt: { ...config.mqtt, username: e.target.value }
                              })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="mqtt_user"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Password
                            </label>
                            <div className="relative">
                              <input
                                type={showPasswords.mqtt ? "text" : "password"}
                                value={config.mqtt.password}
                                onChange={(e) => setConfig({
                                  ...config,
                                  mqtt: { ...config.mqtt, password: e.target.value }
                                })}
                                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="mqtt_password"
                              />
                              <button
                                type="button"
                                onClick={() => togglePassword('mqtt')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showPasswords.mqtt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Birth Message Topic
                          </label>
                          <input
                            type="text"
                            value={config.mqtt.birth_message_topic}
                            onChange={(e) => setConfig({
                              ...config,
                              mqtt: { ...config.mqtt, birth_message_topic: e.target.value }
                            })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={`${config.device_name}/topics (default)`}
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            MQTT topic for birth message. Leave empty to use default: {config.device_name}/topics
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'device-settings' && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        Device Settings
                      </h2>
                      <p className="text-gray-600">
                        Configure device identity and security settings
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                  <div className="p-6 bg-gradient-to-br from-gray-50/70 to-white rounded-xl space-y-4 shadow-sm">
<h3 className="font-semibold text-gray-900 flex items-center">
                          <Cpu className="w-4 h-4 mr-2" />
                          Device Identity
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Device Name
                            </label>
                            <input
                              type="text"
                              value={config.device_name}
                              onChange={(e) => setConfig({ ...config, device_name: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={config.device_type === 'm30' ? 'e.g., m30' : 'e.g., a32-pro'}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Used for ESPHome node name and MQTT topics
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Friendly Name
                            </label>
                            <input
                              type="text"
                              value={config.friendly_name}
                              onChange={(e) => setConfig({ ...config, friendly_name: e.target.value })}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={config.device_type === 'm30' ? 'e.g., M30 Energy Monitor' : 'e.g., A32 Pro Controller'}
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Human-readable name shown in Home Assistant
                            </p>
                          </div>
                        </div>
                      </div>
                  <div className="p-6 bg-gradient-to-br from-gray-50/70 to-white rounded-xl space-y-4 shadow-sm">
<h3 className="font-semibold text-gray-900 flex items-center">
                          <Key className="w-4 h-4 mr-2" />
                          Security Settings
                        </h3>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Encryption Key
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords.api ? "text" : "password"}
                              value={config.api_key}
                              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                              placeholder="Base64 encoded encryption key"
                            />
                            <button
                              type="button"
                              onClick={() => togglePassword('api')}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPasswords.api ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Base64 encoded encryption key for secure Home Assistant API communication
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

         
          <div className="space-y-6">
         
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 backdrop-blur-sm bg-white/90">
<h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Configuration Summary
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Device:</span>
                    <span className="font-medium text-gray-900 flex items-center">
                      {config.device_type === 'm30' ? (
                        <><Database className="w-4 h-4 mr-1" /> Kincony M30</>
                      ) : (
                        <><Zap className="w-4 h-4 mr-1" /> Kincony A32 Pro</>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Enabled {config.device_type === 'm30' ? 'Circuits' : 'Switches'}:</span>
                    <span className={`font-medium px-2 py-1 rounded-full text-xs ${
                      enabledCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {enabledCount}/{maxCircuits}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Network:</span>
                    <span className="font-medium text-gray-900 flex items-center capitalize">
                      {config.network.type === 'wifi' ? (
                        <><Wifi className="w-4 h-4 mr-1" /> WiFi</>
                      ) : (
                        <><Monitor className="w-4 h-4 mr-1" /> Ethernet</>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">MQTT Broker:</span>
                    <span className="font-medium text-gray-900 font-mono text-xs">
                      {config.mqtt.broker}:{config.mqtt.port}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Birth Topic:</span>
                    <span className="font-medium text-gray-900 font-mono text-xs">
                      {config.mqtt.birth_message_topic || `${config.device_name}/topics`}
                    </span>
                  </div>
                </div>

                
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-600 mb-2">
                    <span>Configuration Progress</span>
                    <span>{Object.values(completionStatus).filter(Boolean).length}/4 Complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-blue-500 via-green-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500 shadow-inner"
style={{ width: `${(Object.values(completionStatus).filter(Boolean).length / 4) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <button
                  onClick={generateConfig}
                  disabled={loading || !isConfigComplete}
                  className={`w-full py-4 px-6 rounded-xl font-medium flex items-center justify-center gap-3 transition-all duration-200 ${
                    loading 
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                      : isConfigComplete
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-300 cursor-not-allowed text-gray-500'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
                      Generating Configuration...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Configuration
                    </>
                  )}
                </button>

                {!isConfigComplete && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                      <span className="text-sm text-yellow-800">
                        Complete all sections to generate configuration
                      </span>
                    </div>
                  </div>
                )}
                
                {generatedConfig && (
                  <div className="space-y-3">
                    <button
                      onClick={downloadConfig}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-6 rounded-xl hover:from-green-700 hover:to-green-800 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Download className="w-4 h-4" />
                      Download YAML File
                    </button>
                    <button
                      onClick={copyConfig}
                      className={`w-full py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                        configCopied
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {configCopied ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy to Clipboard
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Preview */}
            {generatedConfig && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 backdrop-blur-sm bg-white/90">
<h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Configuration Preview
                </h3>
                  <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-auto shadow-inner border border-gray-800">
                  <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap leading-relaxed [text-shadow:_0_0_2px_rgba(74,222,128,0.5)]">
{generatedConfig}
                    {/* {generatedConfig.length > 1500 && '\n... (truncated)'} */}
                  </pre>
                </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-200 pt-3">
<span>
                    {/* {generatedConfig.length > 1500 ? (
                      `Showing first 1500 characters of ${generatedConfig.length} total`
                    ) : (
                      `${generatedConfig.length} characters`
                    )} */}
                  </span>
                  <span className="text-green-500 font-medium bg-green-100/50 px-2 py-1 rounded-full">
Ready for ESPHome
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ESPHomeConfigGenerator;