#!/usr/bin/env node

/**
 * Setup script to initialize the DEX Order Engine
 * Run with: npm run setup (add this to package.json scripts)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Setting up DEX Order Engine...\n');

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('Creating .env file...');
  fs.copyFileSync('.env.example', '.env');
  console.log('.env file created\n');
} else {
  console.log('.env file already exists\n');
}

// Check if Docker is running
try {
  execSync('docker --version', { stdio: 'ignore' });
  console.log('Docker is installed\n');
} catch (error) {
  console.error('ERROR: Docker is not installed or not in PATH');
  console.error('Please install Docker: https://www.docker.com/get-started\n');
  process.exit(1);
}

// Start Docker containers
console.log('Starting Docker containers (PostgreSQL + Redis)...');
try {
  execSync('docker-compose up -d', { stdio: 'inherit' });
  console.log('Docker containers started\n');
} catch (error) {
  console.error('ERROR: Failed to start Docker containers');
  process.exit(1);
}

// Wait for database to be ready
console.log('Waiting for database to be ready...');
const maxAttempts = 30;
let attempt = 0;
while (attempt < maxAttempts) {
  try {
    execSync('docker exec dex-postgres pg_isready -U postgres', { stdio: 'ignore' });
    console.log('Database is ready\n');
    break;
  } catch (error) {
    attempt++;
    if (attempt === maxAttempts) {
      console.error('ERROR: Database failed to start');
      process.exit(1);
    }
    // Wait 1 second before next attempt
    execSync('sleep 1', { stdio: 'ignore' });
  }
}

// Generate Prisma client
console.log('Generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('Prisma client generated\n');
} catch (error) {
  console.error('ERROR: Failed to generate Prisma client');
  process.exit(1);
}

// Run database migrations
console.log('Running database migrations...');
try {
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
  console.log('Database migrations completed\n');
} catch (error) {
  console.error('ERROR: Failed to run migrations');
  process.exit(1);
}

console.log('Setup complete!\n');
console.log('Next steps:');
console.log('  1. Start the server: npm run dev');
console.log('  2. Test the API: Open Postman and import postman_collection.json');
console.log('  3. Connect via WebSocket: ws://localhost:3000/api/orders/execute?tokenIn=SOL&tokenOut=USDC&amount=1.5&slippage=0.01');
console.log('  4. Run tests: npm test\n');
console.log('See QUICKSTART.md for detailed instructions\n');
