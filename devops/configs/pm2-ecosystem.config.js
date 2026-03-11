module.exports = {
  apps: [
    {
      name: "resume-backend",       // PM2 process name
      script: "./server.js",         // Entry point of your Node backend

      // How the app runs
      instances: 1,
      exec_mode: "fork",             // Or "cluster" if you want multi-core

      // Environment variables used in production
      env: {
        NODE_ENV: "production",
        PORT: 8080
      },

      // Optional advanced settings
      watch: false,                  // Disable file watching on server
      max_memory_restart: "300M",    // Auto-restart if memory limit exceeded
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    }
  ]
};
