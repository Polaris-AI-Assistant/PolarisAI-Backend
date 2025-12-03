const { testRedisConnection } = require('./utils/redisClient');

(async () => {
    console.log('Testing Redis connection...');
    const result = await testRedisConnection();
    console.log('Test result:', result);
    process.exit(result.success ? 0 : 1);
})();
