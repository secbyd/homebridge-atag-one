const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let hap;

module.exports = (api) => {
  hap = api.hap;
  api.registerAccessory('homebridge-atag-one', 'ATAGOne', ATAGOneAccessory);
};

class ATAGOneAccessory {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    // Configuration
    this.name = config.name || 'ATAG One';
    this.mode = config.mode || 'local'; // 'local' or 'remote'
    this.host = config.host;
    this.email = config.email;
    this.password = config.password;
    this.jarPath = config.jarPath || '/usr/local/lib/node_modules/homebridge-atag-one/atag-one.jar';
    this.javaPath = config.javaPath || 'java';
    this.pollInterval = config.pollInterval || 60000; // 60 seconds
    this.timeout = config.timeout || 30000; // 30 seconds
    this.temperatureDisplayUnits = config.temperatureDisplayUnits || 0; // 0 = Celsius, 1 = Fahrenheit
    this.minTemp = config.minTemp || 5;
    this.maxTemp = config.maxTemp || 30;

    // Validate configuration
    if (this.mode === 'local' && !this.host) {
      throw new Error('Host is required for local mode');
    }
    if (this.mode === 'remote' && (!this.email || !this.password)) {
      throw new Error('Email and password are required for remote mode');
    }

    // Check if JAR file exists
    if (!fs.existsSync(this.jarPath)) {
      this.log.warn(`ATAG One JAR file not found at ${this.jarPath}`);
      this.log.warn('Please download it from https://github.com/kozmoz/atag-one-api/releases');
    }

    // Initialize state
    this.currentTemperature = 20;
    this.targetTemperature = 20;
    this.currentHeatingCoolingState = hap.Characteristic.CurrentHeatingCoolingState.OFF;
    this.targetHeatingCoolingState = hap.Characteristic.TargetHeatingCoolingState.AUTO;
    this.isUpdating = false;

    // Additional properties for extra sensors
    this.outsideTemperature = 0;
    this.dhwTemperature = 0;
    this.waterPressure = 0;
    this.flameActive = false;

    // Set up services
    this.informationService = this.createInformationService();
    this.thermostatService = this.createThermostatService();
    
    // Optional additional services
    this.services = [this.informationService, this.thermostatService];
    
    if (config.exposeOutsideTemperature) {
      this.outsideTemperatureService = this.createOutsideTemperatureService();
      this.services.push(this.outsideTemperatureService);
    }
    
    if (config.exposeWaterPressure) {
      this.waterPressureService = this.createWaterPressureService();
      this.services.push(this.waterPressureService);
    }

    if (config.exposeDHWTemperature) {
      this.dhwTemperatureService = this.createDHWTemperatureService();
      this.services.push(this.dhwTemperatureService);
    }

    // Start polling
    this.startPolling();
    
    this.log.info(`ATAG One Thermostat initialized in ${this.mode} mode`);
  }

  createInformationService() {
    const informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'ATAG')
      .setCharacteristic(hap.Characteristic.Model, 'ATAG One')
      .setCharacteristic(hap.Characteristic.SerialNumber, this.host || 'Remote')
      .setCharacteristic(hap.Characteristic.FirmwareRevision, '1.0.0');

    return informationService;
  }

  createThermostatService() {
    const service = new hap.Service.Thermostat(this.name);

    // Current Temperature (read-only)
    service.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .onGet(() => {
        this.log.debug(`Getting current temperature: ${this.currentTemperature}°C`);
        return this.currentTemperature;
      });

    // Target Temperature
    service.getCharacteristic(hap.Characteristic.TargetTemperature)
      .setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: 0.5
      })
      .onGet(() => {
        this.log.debug(`Getting target temperature: ${this.targetTemperature}°C`);
        return this.targetTemperature;
      })
      .onSet(async (value) => {
        this.log.info(`Setting target temperature to ${value}°C`);
        await this.setTargetTemperature(value);
      });

    // Current Heating/Cooling State (read-only)
    service.getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
      .onGet(() => {
        this.log.debug(`Getting current heating/cooling state: ${this.currentHeatingCoolingState}`);
        return this.currentHeatingCoolingState;
      });

    // Target Heating/Cooling State
    service.getCharacteristic(hap.Characteristic.TargetHeatingCoolingState)
      .setProps({
        validValues: [
          hap.Characteristic.TargetHeatingCoolingState.OFF,
          hap.Characteristic.TargetHeatingCoolingState.HEAT,
          hap.Characteristic.TargetHeatingCoolingState.AUTO
        ]
      })
      .onGet(() => {
        return this.targetHeatingCoolingState;
      })
      .onSet(async (value) => {
        this.log.info(`Setting target heating/cooling state to ${value}`);
        this.targetHeatingCoolingState = value;
        // You might want to implement actual mode switching here
        await this.updateATAGData();
      });

    // Temperature Display Units
    service.getCharacteristic(hap.Characteristic.TemperatureDisplayUnits)
      .onGet(() => {
        return this.temperatureDisplayUnits;
      })
      .onSet((value) => {
        this.temperatureDisplayUnits = value;
      });

    return service;
  }

  createOutsideTemperatureService() {
    const service = new hap.Service.TemperatureSensor('Outside Temperature', 'outside');
    
    service.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .onGet(() => {
        this.log.debug(`Getting outside temperature: ${this.outsideTemperature}°C`);
        return this.outsideTemperature;
      });

    return service;
  }

  createWaterPressureService() {
    // Use a custom service or pressure sensor if available
    const service = new hap.Service.LeakSensor('Water Pressure', 'pressure');
    
    service.getCharacteristic(hap.Characteristic.LeakDetected)
      .onGet(() => {
        // Convert pressure to leak detected (low pressure = leak detected)
        const lowPressure = this.waterPressure < 1.0;
        this.log.debug(`Water pressure: ${this.waterPressure} bar, low pressure alarm: ${lowPressure}`);
        return lowPressure ? hap.Characteristic.LeakDetected.LEAK_DETECTED : hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED;
      });

    return service;
  }

  createDHWTemperatureService() {
    const service = new hap.Service.TemperatureSensor('Hot Water Temperature', 'dhw');
    
    service.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .onGet(() => {
        this.log.debug(`Getting DHW temperature: ${this.dhwTemperature}°C`);
        return this.dhwTemperature;
      });

    return service;
  }

  async updateATAGData() {
    if (this.isUpdating) {
      this.log.debug('Update already in progress, skipping');
      return;
    }

    this.isUpdating = true;
    
    try {
      const data = await this.executeATAGCommand();
      this.parseATAGData(data);
      this.updateHomeKitCharacteristics();
    } catch (error) {
      this.log.error('Failed to update ATAG data:', error.message);
    } finally {
      this.isUpdating = false;
    }
  }

  async executeATAGCommand(setTemp = null) {
    return new Promise((resolve, reject) => {
      let args = ['-jar', this.jarPath];

      if (this.mode === 'local') {
        args.push('-d', this.host);
      } else {
        args.push('-r', '-e', this.email, '-p', this.password);
      }

      if (setTemp !== null) {
        args.push('-t', setTemp.toString());
      }

      this.log.debug(`Executing: ${this.javaPath} ${args.join(' ')}`);

      const child = spawn(this.javaPath, args, {
        timeout: this.timeout
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  }

  parseATAGData(output) {
    try {
      // Extract JSON from output (similar to FHEM module)
      const jsonMatch = output.match(/(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\s*$/s);
      
      if (!jsonMatch) {
        throw new Error('No JSON data found in output');
      }

      const data = JSON.parse(jsonMatch[1]);
      
      // Update internal state
      if (data.roomTemperature !== undefined) {
        this.currentTemperature = parseFloat(data.roomTemperature);
      }
      
      if (data.targetTemperature !== undefined) {
        this.targetTemperature = parseFloat(data.targetTemperature);
      }
      
      if (data.outsideTemperature !== undefined) {
        this.outsideTemperature = parseFloat(data.outsideTemperature);
      }
      
      if (data.dhwWaterTemperature !== undefined) {
        this.dhwTemperature = parseFloat(data.dhwWaterTemperature);
      }
      
      if (data.chWaterPressure !== undefined) {
        this.waterPressure = parseFloat(data.chWaterPressure);
      }

      // Determine heating state based on flame status or heating activity
      if (data.flameStatus !== undefined) {
        this.flameActive = data.flameStatus !== 'Off';
        
        if (this.flameActive) {
          this.currentHeatingCoolingState = hap.Characteristic.CurrentHeatingCoolingState.HEAT;
        } else if (this.currentTemperature < this.targetTemperature - 0.5) {
          this.currentHeatingCoolingState = hap.Characteristic.CurrentHeatingCoolingState.HEAT;
        } else {
          this.currentHeatingCoolingState = hap.Characteristic.CurrentHeatingCoolingState.OFF;
        }
      }

      this.log.debug(`Updated data - Current: ${this.currentTemperature}°C, Target: ${this.targetTemperature}°C, Heating: ${this.currentHeatingCoolingState}`);
      
    } catch (error) {
      this.log.error('Failed to parse ATAG data:', error.message);
      this.log.debug('Raw output:', output);
      throw error;
    }
  }

  updateHomeKitCharacteristics() {
    // Update thermostat service
    this.thermostatService.updateCharacteristic(hap.Characteristic.CurrentTemperature, this.currentTemperature);
    this.thermostatService.updateCharacteristic(hap.Characteristic.TargetTemperature, this.targetTemperature);
    this.thermostatService.updateCharacteristic(hap.Characteristic.CurrentHeatingCoolingState, this.currentHeatingCoolingState);

    // Update additional services if they exist
    if (this.outsideTemperatureService) {
      this.outsideTemperatureService.updateCharacteristic(hap.Characteristic.CurrentTemperature, this.outsideTemperature);
    }

    if (this.waterPressureService) {
      const lowPressure = this.waterPressure < 1.0;
      this.waterPressureService.updateCharacteristic(
        hap.Characteristic.LeakDetected, 
        lowPressure ? hap.Characteristic.LeakDetected.LEAK_DETECTED : hap.Characteristic.LeakDetected.LEAK_NOT_DETECTED
      );
    }

    if (this.dhwTemperatureService) {
      this.dhwTemperatureService.updateCharacteristic(hap.Characteristic.CurrentTemperature, this.dhwTemperature);
    }
  }

  async setTargetTemperature(temperature) {
    try {
      await this.executeATAGCommand(temperature);
      this.targetTemperature = temperature;
      this.thermostatService.updateCharacteristic(hap.Characteristic.TargetTemperature, temperature);
      
      // Schedule an update to get the new state
      setTimeout(() => {
        this.updateATAGData();
      }, 2000);
      
    } catch (error) {
      this.log.error('Failed to set target temperature:', error.message);
      throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }

  startPolling() {
    // Initial update
    this.updateATAGData();
    
    // Set up periodic updates
    setInterval(() => {
      this.updateATAGData();
    }, this.pollInterval);
  }

  getServices() {
    return this.services;
  }
}
