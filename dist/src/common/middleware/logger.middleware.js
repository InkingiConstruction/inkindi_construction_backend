"use strict";
/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : logger.middleware.ts
 * WHAT THIS FILE DOES : Provides a color-coded global logging system and Express middleware
 * HOW IT DOES IT      : Hooks Express response finishes to calculate duration and prints to console
 * DATA SOURCE         : Express Request and Response telemetry (IP, Method, Path, Status)
 * DATA DESTINATION    : Standard output console (process.stdout)
 * PRINCIPLE APPLIED   : SOLID (Isolated logging middleware)
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.requestLoggerMiddleware = requestLoggerMiddleware;
/**
 * 🧱 CODE BLOCK: Logger Level Utility
 * WHAT IT IS DOING: Defines standard logger levels (info, debug, warn, error) with formatting
 * WHY IT IS HERE  : Centralized debugging tool accessible across the entire application
 * PRINCIPLE       : DRY
 * DATA SOURCE     : User parameters from code calls
 * DATA DESTINATION: Console stream
 */
exports.logger = {
    info: (message, meta) => {
        const timestamp = new Date().toISOString();
        console.log(`\x1b[32m[INFO] [${timestamp}]\x1b[0m ${message}`, meta ? JSON.stringify(meta) : "");
    },
    warn: (message, meta) => {
        const timestamp = new Date().toISOString();
        console.log(`\x1b[33m[WARN] [${timestamp}]\x1b[0m ${message}`, meta ? JSON.stringify(meta) : "");
    },
    error: (message, error) => {
        const timestamp = new Date().toISOString();
        console.log(`\x1b[31m[ERROR] [${timestamp}]\x1b[0m ${message}`, error?.message || error ? JSON.stringify(error) : "");
    },
    debug: (message, meta) => {
        const timestamp = new Date().toISOString();
        console.log(`\x1b[36m[DEBUG] [${timestamp}]\x1b[0m ${message}`, meta ? JSON.stringify(meta) : "");
    }
};
/**
 * ============================================================================
 * 🔧 FUNCTION: requestLoggerMiddleware
 * ============================================================================
 * WHAT IT DOES: Express middleware to measure API response times and log to standard output
 * PARAMETERS:
 *   - req (Request) : Express request object
 *   - res (Response) : Express response object
 *   - next (NextFunction) : Express callback trigger
 * RETURNS: void
 * WHO CALLS IT: Global app.ts
 * PRINCIPLE: SOLID
 * ============================================================================
 */
function requestLoggerMiddleware(req, res, next) {
    const startTime = process.hrtime();
    const { method, originalUrl, ip } = req;
    res.on("finish", () => {
        const durationDiff = process.hrtime(startTime);
        const durationMs = (durationDiff[0] * 1e3 + durationDiff[1] * 1e-6).toFixed(2);
        const status = res.statusCode;
        // Apply color-coding based on HTTP status code ranges
        let statusColor = "\x1b[32m"; // Green
        if (status >= 400 && status < 500) {
            statusColor = "\x1b[33m"; // Yellow
        }
        else if (status >= 500) {
            statusColor = "\x1b[31m"; // Red
        }
        const resetColor = "\x1b[0m";
        const logMsg = `${method} ${originalUrl} ${statusColor}${status}${resetColor} - ${durationMs}ms - IP: ${ip}`;
        exports.logger.info(logMsg);
    });
    next();
}
