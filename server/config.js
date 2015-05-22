var base_url = 'https://rlm-wall.cleverapps.io';

var twitter = {
  consumer_key: 'OvaZRnqJ5xmdrpswpU6J1AFba',
  consumer_secret: '9iE0SqWfmaUHXNsMwOOMV7dxEiBzZoxVSbkr3qRRK5DaLyAs5L',
  token: '87213969-XzMckTpAKddabSh8tmv08nVd8nAeCgsue9DGh0cwG',
  token_secret: '7qRppSf4zIZtLjKHzqSUqknYTyoZ0A5U7oX32ydz3c6to'
};

var instagram = {
  client_id: '75ccfa63082d43d7bae7178ae3f1d4ad',
  client_secret: '5c91a8d198f748fcb97302a5585cfca5'
};

var mongodb = 'b07idcxfob8ynqa.mongodb.clvrcld.net';

if (process.env.NODE_ENV === 'home') {
  base_url = 'https://rlmio.herokuapp.com/';
  twitter = {
    consumer_key: 'OvaZRnqJ5xmdrpswpU6J1AFba',
    consumer_secret: '9iE0SqWfmaUHXNsMwOOMV7dxEiBzZoxVSbkr3qRRK5DaLyAs5L',
    token: '87213969-XzMckTpAKddabSh8tmv08nVd8nAeCgsue9DGh0cwG',
    token_secret: '7qRppSf4zIZtLjKHzqSUqknYTyoZ0A5U7oX32ydz3c6to'
  };
  instagram = {
    client_id: '75ccfa63082d43d7bae7178ae3f1d4ad',
    client_secret: '5c91a8d198f748fcb97302a5585cfca5'
  };
}

if (process.env.NODE_ENV === 'test') {
  base_url = 'http://rlm-wall-preprod.xxx.com';
  twitter = {
    consumer_key: 'OvaZRnqJ5xmdrpswpU6J1AFba',
    consumer_secret: '9iE0SqWfmaUHXNsMwOOMV7dxEiBzZoxVSbkr3qRRK5DaLyAs5L',
    token: '87213969-XzMckTpAKddabSh8tmv08nVd8nAeCgsue9DGh0cwG',
    token_secret: '7qRppSf4zIZtLjKHzqSUqknYTyoZ0A5U7oX32ydz3c6to'
  };
  instagram = {
    client_id: '75ccfa63082d43d7bae7178ae3f1d4ad',
    client_secret: '5c91a8d198f748fcb97302a5585cfca5'
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
