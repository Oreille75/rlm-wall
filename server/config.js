var base_url = 'http://rlm-wall.xxx.com';

var twitter = {
  consumer_key: 'xxxxxxxxxxxxxxxxxxxxxxxxx',
  consumer_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  token: 'xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  token_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
};

var instagram = {
  client_id: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  client_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
};

var mongodb = 'mongodb://localhost/RlmWall';

if (process.env.NODE_ENV === 'home') {
  base_url = 'http://xxx.xxx.com:8080';
  twitter = {
    consumer_key: 'xxxxxxxxxxxxxxxxxxxxxxxxx',
    consumer_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    token: 'xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    token_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  };
  instagram = {
    client_id: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    client_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  };
}

if (process.env.NODE_ENV === 'test') {
  base_url = 'http://rlm-wall-preprod.xxx.com';
  twitter = {
    consumer_key: 'xxxxxxxxxxxxxxxxxxxxxxxxx',
    consumer_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    token: 'xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    token_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  };
  instagram = {
    client_id: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    client_secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  };
  mongodb = 'mongodb://localhost/RlmWallTest';
}

module.exports = {
  base_url: base_url,
  twitter: twitter,
  instagram: instagram,
  mongodb: mongodb,
  names: {
    twitter: 'RLM_Team',
    facebook: 'ricardsa.livemusic',
    instagram: 'ricard_sa_live',
    _instagram_id: '24864527'
  }
};
