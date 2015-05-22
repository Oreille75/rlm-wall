var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Globals = new Schema({
  tag: { type: String, default: 'nantes', trim: true },
  running: { type: Boolean, default: false },
  track_twitter: { type: Boolean, default: true },
  track_instagram: { type: Boolean, default: true },
  moderate: { type: Boolean, default: true },

  scroll_speed: { type: Number, defaults: 16 },
  screen: { type: String, default: 'auto' },

  timer_home: { type: Number, defaults: 10 },
  timer_zoom: { type: Number, defaults: 10 },
  timer_win: { type: Number, defauts: 10 },

  msg_win_home: {
    type: String, 
    defaults: 'et gagnez votre pass backstage',
    trim: true
  },
  msg_win_scr: {
    type: String,
    defaults: 'Félicitations {{user}}'+
      ' Tu viens de décrocher ton pass backstage !',
    trim: true
  },

  blocked: {
    type: String,
    defaults: '',
    trim: true
  },

  ig_min_tag_id: { type: Number, default: 0 },
  ig_subscription_id: { type: Number, defaults: 0},
  followers: { type: Schema.Types.Mixed }
});

var Message = new Schema({
  message_id: { 
    type: String, 
    index: true, 
    required: true, 
    unique: true, 
    dropDups: true 
  },
  date: { type: Date, default: Date.now, index: true },
  type: { type: String },
  validated: { type: Boolean, default: false, index: true },
  discarded: { type: Boolean, default: false },
  special: { type: String, default: ''},
  data: { type: Schema.Types.Mixed }
});

Message.methods.text_filter = function(txt) {
  var ret = '', i, c;
  if (txt) {
    for (i = 0; i < txt.length; i++) {
      c = txt.charCodeAt(i);
      if (c < 50000 && c !== 9917) {
        ret += txt.charAt(i);
      }
    }
  }
  ret = ret.replace(' !', ' !');
  ret = ret.replace(' :', ' :');
  ret = ret.replace(/\b#/g, ' #');
  ret = ret.replace(/\B#\B/g, '');
  return ret;
};

Message.methods.client_message = function() {
  var m = this.toJSON();
  delete(m.__v);
  if (!m.data) {
    return null;
  }
  if (m.type === 'twitter') {
    m.user = m.data.user ? m.data.user.screen_name : null;
    m.user_img = 
      m.data.user ? 
      m.data.user.profile_image_url.replace('_normal', '_reasonably_small') :
      null;
    m.txt = m.data.text;
    m.img = 
      m.data.entities.media && m.data.entities.media.length > 0 ? 
      m.data.entities.media[0].media_url : null;
    m.img_low =
      m.data.entities.media && m.data.entities.media.length > 0 ? 
      m.data.entities.media[0].media_url + ':small' : null;
  }
  else if (m.type === 'instagram') {
    m.user = m.data.user ? m.data.user.username : null;
    m.user_img = m.data.user ? m.data.user.profile_picture : null;
    m.txt = m.data.caption ? m.data.caption.text : null;
    m.img = m.data.images ? m.data.images.standard_resolution.url : null;
    m.img_low = m.data.images ? m.data.images.low_resolution.url : null;
  }
  delete(m.data);

  m.ts = new Date(m.date).getTime();

  m.txt = this.text_filter(m.txt);
  m.user = this.text_filter(m.user);

  return m;
};

module.exports = {
  Globals: mongoose.model('Globals', Globals),
  Message: mongoose.model('Message', Message)
};
