import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Ensure logs directory exists at the root of the project setup
const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json() // Standardize the file log records into strict JSON strings
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Console outputs should pop with exact coloring
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return `[${timestamp}] ${level}: ${stack || message}`;
        })
      )
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'app.log'),
      level: 'info'
    })
  ]
});

export default logger;
