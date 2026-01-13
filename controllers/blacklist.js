'use strict'

const axios = require('axios').default;
const logger = require('../util/logger');
const { BLACKLIST_IGN } = require('../util/config').getConfig();

const BLACKLIST_URL = 'https://raw.githubusercontent.com/The-Forbidden-Trove/character_name_blacklist/main/blacklist.txt';
const BLACKLIST_POE2_URL = 'https://raw.githubusercontent.com/The-Forbidden-Trove/character_name_blacklist/main/blacklist_poe2.txt';

const BLACKLIST_POE2_URLS = [
  BLACKLIST_POE2_URL,
  'https://raw.githubusercontent.com/HelloWorldCH/blacklist-tool/refs/heads/main/blacklist_poe2.txt'
];

const BLACKLIST_UPDATE_INTERVAL = 1800000; // 30 minutes

module.exports = (eventEmitter) => {

  async function getBlacklist() {
    try {
      const isPOE2 = process.env.poe2_mode === 'true';
      logger.debug(`Using ${isPOE2 ? 'poe2' : 'poe1'} mode`);

      let urlsToFetch = [];

      if (isPOE2) {
        urlsToFetch = BLACKLIST_POE2_URLS;
      } else {
        urlsToFetch = [BLACKLIST_URL];
      }

      const responses = await Promise.all(
        urlsToFetch.map(url => axios.get(url).catch(err => ({ error: err })))
      );

      let blacklist = [];

      for (const res of responses) {
        if (res.error) {
          logger.error(`Failed to load blacklist from one URL: ${res.error}`);
          continue;
        }
        const part = res.data.toLowerCase().split('\n');
        blacklist = blacklist.concat(part);
      }

      // เพิ่ม blacklist จาก config ถ้ามี
      if (BLACKLIST_IGN) {
        logger.debug(`BLACKLIST_IGN: ${BLACKLIST_IGN}`);
        blacklist.push(BLACKLIST_IGN.toLowerCase());
      }

      // ทำความสะอาดข้อมูล
      blacklist = blacklist
        .map(x => x.trim())
        .filter(x => x.length > 0)
        .filter((x, idx, self) => self.indexOf(x) === idx); // ลบข้อมูลซ้ำ

      logger.debug(`Final blacklist count: ${blacklist.length}`);

      eventEmitter.emit('app-blacklist-update', blacklist);

    } catch (err) {
      logger.error(`blacklist.js | ${err}`);
      if (err.response) {
        logger.error(`blacklist.js http header | ${JSON.stringify(err.response.headers, null, 2)}`);
        logger.error(`blacklist.js http data   | ${JSON.stringify(err.response.data)}`);
      }
    }
  }

  function getBlacklistLoop() {
    try {
      getBlacklist();
    } finally {
      setTimeout(getBlacklistLoop, BLACKLIST_UPDATE_INTERVAL);
    }
  }

  getBlacklistLoop();
};
