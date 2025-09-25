import React, { useState } from 'react';
import { Download, Settings, Wifi, Monitor, Database } from 'lucide-react';

const ESPHomeConfigGenerator = () => {
  const [config, setConfig] = useState({
    device_name: 'm30',
    friendly_name: 'm30',
    api_key: '8G0kVEA0/DqgAavgKNyy9EYUrWo6pEZM38JVMAryJv8=',
    circuits: Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      enabled: false,
      topic_base: ''
    })),
    network: {
      type: 'ethernet',
      wifi_ssid: '',
      wifi_password: ''
    },
    mqtt: {
      broker: '10.217.55.20',
      username: 'username',
      password: 'password',
      port: 1883
    }
  });

  const [generatedConfig, setGeneratedConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('circuits');

  const updateCircuit = (index, field, value) => {
    const newCircuits = [...config.circuits];
    newCircuits[index][field] = value;
    setConfig({ ...config, circuits: newCircuits });
  };

  const toggleAllCircuits = (enabled) => {
    const newCircuits = config.circuits.map(circuit => ({
      ...circuit,
      enabled,
      topic_base: enabled ? circuit.topic_base || `TOPICS-PREFIX/CIRCUIT-${circuit.id}/Device` : circuit.topic_base
    }));
    setConfig({ ...config, circuits: newCircuits });
  };

  const generateConfig = async () => {
    setLoading(true);
    try {
      const requestData = {
        device_name: config.device_name,
        friendly_name: config.friendly_name,
        api_key: config.api_key,
        circuits: config.circuits.reduce((acc, circuit) => {
          acc[circuit.id] = {
            enabled: circuit.enabled,
            topic_base: circuit.topic_base
          };
          return acc;
        }, {}),
        network: config.network,
        mqtt: config.mqtt
      };

      const response = await fetch('http://localhost:8000/generate-config', {
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

  const enabledCount = config.circuits.filter(c => c.enabled).length;

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-auto">
      <div className="w-full px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ESPHome M30 Config Generator
          </h1>
          <p className="text-gray-600">
            Configure your Kincony M30 energy meter with custom MQTT topics and network settings
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-[calc(100vh-200px)]">
          {/* Configuration Panel */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'circuits', name: 'Circuits', icon: Database },
                    { id: 'network', name: 'Network', icon: config.network.type === 'wifi' ? Wifi : Monitor },
                    { id: 'device', name: 'Device', icon: Settings }
                  ].map(({ id, name, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                        activeTab === id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {name}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {/* Circuits Tab */}
                {activeTab === 'circuits' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          Circuit Configuration
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          {enabledCount} of 30 circuits enabled
                        </p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => toggleAllCircuits(true)}
                          className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Enable All
                        </button>
                        <button
                          onClick={() => toggleAllCircuits(false)}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Disable All
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {config.circuits.map((circuit, index) => (
                        <div
                          key={circuit.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            circuit.enabled ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={circuit.enabled}
                                onChange={(e) => updateCircuit(index, 'enabled', e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm font-medium text-gray-900">
                                Circuit {circuit.id}
                              </span>
                              {circuit.id === 10 || circuit.id === 20 || circuit.id === 30 ? (
                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                  +Voltage
                                </span>
                              ) : null}
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="e.g., TOPICS-PREFIX/BUREAU-DIRECTEUR/Climatiseur"
                                value={circuit.topic_base}
                                onChange={(e) => updateCircuit(index, 'topic_base', e.target.value)}
                                disabled={!circuit.enabled}
                                className={`w-full px-3 py-2 text-sm border rounded-md ${
                                  circuit.enabled
                                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                    : 'border-gray-200 bg-gray-100 text-gray-400'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Network Tab */}
                {activeTab === 'network' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">
                      Network Configuration
                    </h2>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Connection Type
                        </label>
                        <div className="flex space-x-4">
                          {['ethernet', 'wifi'].map((type) => (
                            <label key={type} className="flex items-center">
                              <input
                                type="radio"
                                checked={config.network.type === type}
                                onChange={() => setConfig({
                                  ...config,
                                  network: { ...config.network, type }
                                })}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-700 capitalize flex items-center gap-1">
                                {type === 'wifi' ? <Wifi className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                                {type}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {config.network.type === 'wifi' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              WiFi SSID
                            </label>
                            <input
                              type="text"
                              value={config.network.wifi_ssid}
                              onChange={(e) => setConfig({
                                ...config,
                                network: { ...config.network, wifi_ssid: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Your WiFi Network Name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              WiFi Password
                            </label>
                            <input
                              type="password"
                              value={config.network.wifi_password}
                              onChange={(e) => setConfig({
                                ...config,
                                network: { ...config.network, wifi_password: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="WiFi Password"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">MQTT Broker</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Broker IP
                            </label>
                            <input
                              type="text"
                              value={config.mqtt.broker}
                              onChange={(e) => setConfig({
                                ...config,
                                mqtt: { ...config.mqtt, broker: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Password
                            </label>
                            <input
                              type="password"
                              value={config.mqtt.password}
                              onChange={(e) => setConfig({
                                ...config,
                                mqtt: { ...config.mqtt, password: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Device Tab */}
                {activeTab === 'device' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">
                      Device Settings
                    </h2>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Device Name
                          </label>
                          <input
                            type="text"
                            value={config.device_name}
                            onChange={(e) => setConfig({ ...config, device_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., m30"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Friendly Name
                          </label>
                          <input
                            type="text"
                            value={config.friendly_name}
                            onChange={(e) => setConfig({ ...config, friendly_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., M30 Energy Monitor"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          API Encryption Key
                        </label>
                        <input
                          type="text"
                          value={config.api_key}
                          onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="API encryption key"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Base64 encoded encryption key for Home Assistant API
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <div className="space-y-6">
            {/* Generation Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Generate Configuration
              </h3>
              
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Enabled Circuits:</span>
                    <span className="font-medium">{enabledCount}/30</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network:</span>
                    <span className="font-medium capitalize">{config.network.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MQTT Broker:</span>
                    <span className="font-medium">{config.mqtt.broker}</span>
                  </div>
                </div>
                
                <button
                  onClick={generateConfig}
                  disabled={loading || enabledCount === 0}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4" />
                      Generate Config
                    </>
                  )}
                </button>
                
                {generatedConfig && (
                  <button
                    onClick={downloadConfig}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download YAML
                  </button>
                )}
              </div>
            </div>

            {/* Config Preview */}
            {generatedConfig && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Generated Configuration
                </h3>
                
                <div className="bg-gray-900 rounded-md p-4 max-h-64 overflow-auto">
                  <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                    {generatedConfig.substring(0, 10000)}
                    {generatedConfig.length > 10000 && '...'}
                  </pre>
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                  {generatedConfig.length > 10000 ? (
                    <>Showing first 1000 characters. Download for complete file.</>
                  ) : (
                    <>Configuration ready for download.</>
                  )}
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