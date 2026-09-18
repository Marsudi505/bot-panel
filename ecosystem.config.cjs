module.exports = {
  apps: [
    {
      name: 'bot-panel',
      script: 'index.js',
      cwd: '/data/data/com.termux/files/home/bot-panel',
      node_args: [],
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      instances: 1,
      autorestart: true,
      watch: false,
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      restart_delay: 3000,
    },
  ],
};
