const dgram = require('dgram');

class LoggerService {
  constructor(logstashHost = process.env.LOGSTASH_HOST || 'localhost', logstashPort = process.env.LOGSTASH_PORT || 5000) {
    this.logstashHost = logstashHost;
    this.logstashPort = logstashPort;
    this.client = dgram.createSocket('udp4');
    console.log(`🔌 Logger initialized - sending logs to ${this.logstashHost}:${this.logstashPort}`);
  }

  sendLog(eventType, userId, username, description, metadata = {}, priority = 'low') {
    const logData = {
      timestamp: new Date().toISOString(),
      eventType,
      userId: userId.toString(),
      username,
      description,
      priority,
      metadata
    };

    const message = JSON.stringify(logData);
    console.log('📤 Sending to Logstash:', logData);
    
    this.client.send(message, 0, message.length, this.logstashPort, this.logstashHost, (err) => {
      if (err) {
        console.error(`❌ Log send error to ${this.logstashHost}:${this.logstashPort}:`, err.message);
        // Fallback: log to console if Logstash fails
        console.log('📝 [FALLBACK LOG]', logData);
      } else {
        console.log('✅ Log sent to Logstash:', eventType);
      }
    });
  }

  async login(userId, username, device, ip) {
    this.sendLog('LOGIN', userId, username, 'User logged in', { device, ip }, 'low');
  }

  async postCreated(userId, username, postId) {
    this.sendLog('POST_CREATED', userId, username, 'User created a post', { postId }, 'low');
  }

  async commentAdded(userId, username, postId, commentId) {
    this.sendLog('COMMENT_ADDED', userId, username, 'User added a comment', { postId, commentId }, 'low');
  }

  async likeAdded(userId, username, postId) {
    this.sendLog('LIKE_ADDED', userId, username, 'User liked a post', { postId }, 'low');
  }

  async userFollows(followerId, followerUsername, followingId) {
    this.sendLog('USER_FOLLOWS', followerId, followerUsername, 'User followed someone', { followingId }, 'low');
  }

  async userFollowedBy(userId, username, followerId) {
    this.sendLog('SOMEONE_FOLLOWS_YOU', userId, username, 'User was followed', { followerId }, 'low');
  }
}

module.exports = new LoggerService();