// ═══════════════════════════════════════════════════════════════════════════
// PM2 Process Configuration for Neuraline EMR Backend
//
// This file is used by PM2 to manage the NestJS backend process.
// It handles auto-restart, log rotation, and cluster mode.
//
// Usage:
//   cd /opt/neuraline/backend
//   pm2 start ecosystem.config.js
//   pm2 restart ecosystem.config.js --update-env  # after code changes
//   pm2 logs neuraline-backend                    # view logs
//   pm2 status                                    # check status
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: 'neuraline-backend',
      script: 'dist/main.js',
      cwd: '/opt/neuraline/backend',
      instances: 1,            // t3.micro = 1 vCPU — single instance is correct
      exec_mode: 'fork',       // use 'cluster' + instances: 'max' on larger EC2
      autorestart: true,
      watch: false,            // don't watch files in production (PM2 restarts on deploy)
      max_memory_restart: '800M',  // t3.micro has 1GB RAM — restart if backend uses too much
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        NODE_EXTRA_CA_CERTS: '/opt/neuraline/rds-ca-bundle.pem',
      },
      env_file: '.env',        // PM2 loads .env from this file
      error_file: '/var/log/neuraline/backend-error.log',
      out_file: '/var/log/neuraline/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,      // give NestJS 5s to gracefully shut down
      listen_timeout: 10000,   // wait 10s for backend to start listening
      restart_delay: 3000,     // wait 3s between restarts (avoid crash loops)
      // HIPAA: Don't log request bodies (may contain PHI)
      log_type: 'json',
    },
  ],
};
