module.exports = {
  apps: [
    {
      name: 'private-price-bot',
      script: 'dist/index.js',
      node_args: '--max-old-space-size=512',

      // Environment
      env: {
        NODE_ENV: 'production',
      },

      // Restart policy: exponential backoff, max 10 restarts
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',

      // Logs
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // No file watching (deploy via git pull + pm2 restart)
      watch: false,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
