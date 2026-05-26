module.exports = {
  apps: [
    {
      name: "robertapp-backend",
      cwd: "./backend",
      script: "dist/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    }
  ]
};
