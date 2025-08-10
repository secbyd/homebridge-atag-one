#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PLUGIN_DIR = __dirname;
const JAR_PATH = path.join(PLUGIN_DIR, 'atag-one.jar');
const GITHUB_API_URL = 'https://api.github.com/repos/kozmoz/atag-one-api/releases/latest';

console.log('🏠 ATAG One Homebridge Plugin Post-Install Setup');
console.log('================================================\n');

// Check if Java is installed
function checkJava() {
  console.log('☕ Checking Java installation...');
  
  try {
    const javaVersion = execSync('java -version 2>&1', { encoding: 'utf8' });
    console.log('✅ Java is installed');
    console.log(`   Version: ${javaVersion.split('\n')[0]}\n`);
    return true;
  } catch (error) {
    console.log('❌ Java is not installed or not in PATH');
    console.log('   Please install Java Runtime Environment:');
    console.log('   - Ubuntu/Debian: sudo apt install default-jre');
    console.log('   - CentOS/RHEL: sudo yum install java-11-openjdk');
    console.log('   - macOS: brew install openjdk');
    console.log('   - Or download from: https://www.oracle.com/java/technologies/downloads/\n');
    return false;
  }
}

// Download the ATAG One JAR file
function downloadATAGJar() {
  return new Promise((resolve, reject) => {
    console.log('📦 Downloading ATAG One API JAR file...');
    
    // First get the latest release info
    https.get(GITHUB_API_URL, {
      headers: {
        'User-Agent': 'homebridge-atag-one-installer'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const jarAsset = release.assets.find(asset => asset.name === 'atag-one.jar');
          
          if (!jarAsset) {
            throw new Error('atag-one.jar not found in latest release');
          }
          
          console.log(`   Latest version: ${release.tag_name}`);
          console.log(`   Downloading from: ${jarAsset.browser_download_url}`);
          
          // Download the JAR file
          const file = fs.createWriteStream(JAR_PATH);
          
          https.get(jarAsset.browser_download_url, (response) => {
            response.pipe(file);
            
            file.on('finish', () => {
              file.close();
              console.log('✅ ATAG One JAR downloaded successfully');
              console.log(`   Saved to: ${JAR_PATH}\n`);
              resolve();
            });
          }).on('error', (err) => {
            fs.unlink(JAR_PATH, () => {}); // Delete the file on error
            reject(err);
          });
          
        } catch (error) {
          reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch release info: ${error.message}`));
    });
  });
}

// Test the ATAG JAR file
function testATAGJar() {
  console.log('🔧 Testing ATAG One API...');
  
  try {
    // Test that the JAR file can be executed
    const output = execSync(`java -jar "${JAR_PATH}" --help 2>&1 || true`, { 
      encoding: 'utf8',
      timeout: 10000 
    });
    
    if (output.includes('Usage:') || output.includes('ATAG')) {
      console.log('✅ ATAG One API is working correctly\n');
      return true;
    } else {
      console.log('⚠️  ATAG One API may not be working correctly');
      console.log('   This might be normal if no --help option is available\n');
      return true; // Don't fail the installation for this
    }
  } catch (error) {
    console.log('❌ Failed to test ATAG One API');
    console.log(`   Error: ${error.message}\n`);
    return false;
  }
}

// Create example configuration
function createExampleConfig() {
  const exampleConfig = {
    "accessories": [
      {
        "accessory": "ATAGOne",
        "name": "ATAG Thermostat",
        "mode": "local",
        "host": "192.168.1.20",
        "jarPath": JAR_PATH,
        "pollInterval": 60,
        "exposeOutsideTemperature": true,
        "exposeDHWTemperature": false,
        "exposeWaterPressure": false
      }
    ]
  };
  
  const configPath = path.join(PLUGIN_DIR, 'example-config.json');
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2));
    console.log('📝 Example configuration created');
    console.log(`   Location: ${configPath}\n`);
  } catch (error) {
    console.log('⚠️  Failed to create example configuration');
    console.log(`   Error: ${error.message}\n`);
  }
}

// Display setup instructions
function displayInstructions() {
  console.log('🎉 Installation completed!\n');
  console.log('Next steps:');
  console.log('1. Configure the plugin in Homebridge Config UI or your config.json');
  console.log('2. Set the correct IP address of your ATAG thermostat');
  console.log('3. Or configure remote mode with your ATAG portal credentials');
  console.log('4. Restart Homebridge\n');
  
  console.log('Configuration options:');
  console.log(`- JAR Path: ${JAR_PATH}`);
  console.log('- Mode: "local" (recommended) or "remote"');
  console.log('- Host: Your ATAG thermostat IP address (for local mode)');
  console.log('- Email/Password: ATAG portal credentials (for remote mode)\n');
  
  console.log('Testing connection:');
  console.log(`java -jar "${JAR_PATH}" -d YOUR_ATAG_IP`);
  console.log('or');
  console.log(`java -jar "${JAR_PATH}" -r -e your@email.com -p password\n`);
  
  console.log('For support and documentation:');
  console.log('https://github.com/your-username/homebridge-atag-one\n');
}

// Main installation process
async function main() {
  try {
    // Step 1: Check Java
    const javaInstalled = checkJava();
    
    // Step 2: Download JAR if it doesn't exist
    if (!fs.existsSync(JAR_PATH)) {
      await downloadATAGJar();
    } else {
      console.log('📦 ATAG One JAR already exists, skipping download\n');
    }
    
    // Step 3: Test JAR if Java is available
    if (javaInstalled) {
      testATAGJar();
    }
    
    // Step 4: Create example configuration
    createExampleConfig();
    
    // Step 5: Display instructions
    displayInstructions();
    
    process.exit(0);
    
  } catch (error) {
    console.log('❌ Installation failed');
    console.log(`   Error: ${error.message}\n`);
    console.log('Manual installation steps:');
    console.log('1. Download atag-one.jar from: https://github.com/kozmoz/atag-one-api/releases');
    console.log(`2. Place it at: ${JAR_PATH}`);
    console.log('3. Install Java if not already installed');
    console.log('4. Configure the plugin with the correct JAR path\n');
    
    process.exit(1);
  }
}

// Run the installation
if (require.main === module) {
  main();
}
