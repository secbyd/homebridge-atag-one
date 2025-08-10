# homebridge-atag-one

A Homebridge plugin for ATAG One thermostats using the [kozmoz/atag-one-api](https://github.com/kozmoz/atag-one-api) Java library.

This plugin allows you to control your ATAG One thermostat through Apple HomeKit, including temperature control and monitoring of additional sensors.

## Features

- **Temperature Control**: Set and monitor room temperature
- **HomeKit Integration**: Full Apple HomeKit support with Siri control
- **Dual Connection Modes**: Local (direct IP) and remote (ATAG portal) connectivity
- **Additional Sensors**: Optional outside temperature, hot water temperature, and water pressure monitoring
- **Real-time Updates**: Automatic polling of thermostat status
- **Easy Configuration**: Simple setup through Homebridge Config UI

## Prerequisites

1. **Java Runtime Environment**: Required to run the ATAG One API
2. **Homebridge**: Working Homebridge installation
3. **ATAG One Thermostat**: Compatible ATAG One device
4. **Network Access**: For local mode (direct IP) or internet access for remote mode

## Installation

### Method 1: Manual Installation

```bash
# Install the plugin
npm install -g https://github.com/secbyd/homebridge-atag-one

# Install Java if not already installed
sudo apt update
sudo apt install default-jre  # On Debian/Ubuntu
```

## Setup

### Step 1: Download ATAG One API

Download the latest JAR file from the [kozmoz/atag-one-api releases](https://github.com/kozmoz/atag-one-api/releases):

```bash
# Download to plugin directory
sudo wget https://github.com/kozmoz/atag-one-api/releases/latest/download/atag-one.jar \
  -P /usr/local/lib/node_modules/homebridge-atag-one/

# Or download to custom location
wget https://github.com/kozmoz/atag-one-api/releases/latest/download/atag-one.jar
```

### Step 2: Test the Connection

Test the API connection before configuring Homebridge:

```bash
# Local mode test
java -jar /path/to/atag-one.jar -d 192.168.1.20

# Remote mode test
java -jar /path/to/atag-one.jar -r -e your.email@example.com -p yourpassword
```

### Step 3: Configure Homebridge

Add the accessory to your Homebridge config:

#### Local Mode Configuration

```json
{
  "accessories": [
    {
      "accessory": "ATAGOne",
      "name": "Living Room Thermostat",
      "mode": "local",
      "host": "192.168.1.20",
      "jarPath": "/usr/local/lib/node_modules/homebridge-atag-one/atag-one.jar",
      "pollInterval": 60,
      "exposeOutsideTemperature": true,
      "exposeDHWTemperature": true,
      "exposeWaterPressure": true
    }
  ]
}
```

#### Remote Mode Configuration

```json
{
  "accessories": [
    {
      "accessory": "ATAGOne",
      "name": "ATAG Thermostat",
      "mode": "remote",
      "email": "your.email@example.com",
      "password": "yourpassword",
      "jarPath": "/usr/local/lib/node_modules/homebridge-atag-one/atag-one.jar",
      "pollInterval": 60
    }
  ]
}
```

## Configuration Options

### Required Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `accessory` | Must be "ATAGOne" | `"ATAGOne"` |
| `name` | Display name in HomeKit | `"Living Room Thermostat"` |
| `mode` | Connection mode | `"local"` or `"remote"` |

### Mode-Specific Settings

#### Local Mode
| Setting | Description | Example |
|---------|-------------|---------|
| `host` | IP address of ATAG thermostat | `"192.168.1.20"` |

#### Remote Mode
| Setting | Description | Example |
|---------|-------------|---------|
| `email` | ATAG portal email | `"user@example.com"` |
| `password` | ATAG portal password | `"yourpassword"` |

### Optional Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `jarPath` | `/usr/local/lib/node_modules/homebridge-atag-one/atag-one.jar` | Path to ATAG JAR file |
| `javaPath` | `java` | Path to Java executable |
| `pollInterval` | `60` | Update interval (seconds) |
| `timeout` | `30` | Command timeout (seconds) |
| `minTemp` | `5` | Minimum temperature setting |
| `maxTemp` | `30` | Maximum temperature setting |
| `temperatureDisplayUnits` | `0` | 0=Celsius, 1=Fahrenheit |
| `exposeOutsideTemperature` | `false` | Add outside temperature sensor |
| `exposeDHWTemperature` | `false` | Add hot water temperature sensor |
| `exposeWaterPressure` | `false` | Add water pressure sensor |

## HomeKit Integration

### Main Thermostat Service

The plugin exposes a standard HomeKit thermostat with:

- **Current Temperature**: Real-time room temperature
- **Target Temperature**: Adjustable target temperature (5-30°C)
- **Heating State**: Current heating status (Off/Heating)
- **Mode Control**: Off/Heat/Auto modes

### Additional Sensors (Optional)

- **Outside Temperature**: Separate temperature sensor for outdoor temperature
- **Hot Water Temperature**: Monitor domestic hot water temperature
- **Water Pressure**: Leak sensor that alerts on low water pressure

### Siri Commands

- *"Set the living room to 21 degrees"*
- *"What's the temperature in the living room?"*
- *"Turn off the heating"*
- *"What's the outside temperature?"*

## Troubleshooting

### Common Issues

#### 1. Java Not Found
```bash
# Check Java installation
java -version

# Install Java if missing
sudo apt install default-jre
```

#### 2. JAR File Not Found
- Verify the `jarPath` setting points to the correct location
- Download the JAR file from the GitHub releases page
- Check file permissions

#### 3. Connection Timeouts
- For local mode: verify the IP address and network connectivity
- For remote mode: check email/password credentials
- Increase the `timeout` setting
- Check firewall settings

#### 4. Authentication Failed (Remote Mode)
- Verify ATAG portal credentials
- Try logging into the ATAG portal manually
- Check for special characters in password

### Enable Debug Logging

Add to your Homebridge config:

```json
{
  "bridge": {
    "name": "Homebridge",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },
  "accessories": [...],
  "platforms": [...],
  "debug": true
}
```

Or set environment variable:
```bash
DEBUG=* homebridge
```

### Log Locations

- **Homebridge logs**: Usually in `/var/lib/homebridge/homebridge.log`
- **System logs**: Check `journalctl -u homebridge`

## Performance Tips

- **Use local mode** when possible for better performance and reliability
- **Don't set poll interval too low** (minimum 10 seconds recommended)
- **Monitor system resources** if running multiple accessories

## Security Considerations

- **
