// PM2 process definition: pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [{
    name: 'genz-hub',
    script: 'src/server.js',
    instances: 1,           // SQLite writer => single instance (scale vertically or move to Postgres)
    exec_mode: 'fork',
    max_memory_restart: '512M',
    env: { NODE_ENV: 'development', PORT: 3000 },
    env_production: { NODE_ENV: 'production', PORT: 3000, DATA_DIR: '/var/lib/genzhub' },
  }],
};
