var fs = require('fs');

var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    Marionette = require('backbone.marionette');

var Globals = Backbone.Model.extend({
  idAttribute: "_id",
  defaults: {
    tag: '',
    running: false,
    track_twitter: true,
    track_instagram: true,
    moderate: true,
    scroll_speed: 0,
    screen: '',
    timer_home: 10,
    timer_zoom: 10,
    timer_win: 10,
    msg_win_home: '',
    msg_win_scr: '',
    blocked: '',
    followers: {}
  },
  url: '/api/globals'
});

var Message = Backbone.Model.extend({
  idAttribute: "_id",
  defaults: {
    message_id: null,
    date: null,
    ts: null,
    type: null,
    validated: null,
    discarded: null,
    special: '',
    img: null,
    txt: null,
    user: null,
    user_img: null
  },
  urlRoot: '/api/admin-messages',

  action: function(action) {
    var set = {};
    if (action === 'discard') {
      set.discarded = true;
      set.validated = false;
      set.special = '';
    }
    if (action === 'undo-discard') {
      set.discarded = false;
      set.validated = false;
      set.special = '';
    }
    else if (action === 'validate') {
      set.discarded = false;
      set.validated = true;
      set.special = '';
    }
    else if (action === 'zoom' || action === 'win') {
      set.discarded = false;
      set.validated = true;
      set.special = action;
    }
    this.set(set);
    this.save(set, {patch: true});
  }

});

var MessageCollection = Backbone.Collection.extend({
  model: Message,
  url: '/api/messages',

  sync: function(method, collection, options) {
    if (method === 'read') {
      return $.getJSON(collection.url)
        .done(function(data) {
          options.success(data);
        })
        .fail(function(data) {
          options.error();
        });
    }
    else {
      console.error('not supported');
      options.error();
    }
    return null;
  },

  more: function() {
    if (this.length === 0) {
      return this.fetch();
    }
    else {
      var last = this.at(this.length - 1);
      return $.getJSON(this.url, {
        before_id: last.get('_id')
        // before_date: last.get('date')
      })
      .done(_.bind(function(data) {
        this.add(data);
      }, this))
      .fail(function(data) {
        console.log('fail', data);
      });
    }
  }

});

MessageCollection.comparators = {
  dateAsc: function(message) {
    return message.get('ts');
  },
  dateDesc: function(message) {
    return -message.get('ts');
  }
};

var MessageView = Marionette.ItemView.extend({
  tagName: 'div',
  className: 'message',
  hashtag: 'hashtag',
  template: _.template(
    fs.readFileSync(__dirname + '/templates/message.html', 'utf8')
  ),

  onBeforeRender: function() {
    this.$el.addClass(this.model.get('type'));
    this.$el.attr('data-id', this.model.get('_id'));
    if (this.model.get('img')) {
      this.$el.addClass('has-figure');
    }
  },

  templateHelpers: function() {
    var view = this;
    return {
      userImage: function(className) {
        return '<img' +
          (className ? ' class="' + className + '"' : '') +
          ' src="' + this.user_img + '">';
      },
      image: function() {
        if (!this.img) { return ''; }
        return '<div class="embed-responsive embed-responsive-1by1"><figure class="embed-responsive-item" style="background-image: url(' + this.img + ')"></div>';
      },
      imageLow: function() {
        if (!this.img_low) { return ''; }
        return '<div class="embed-responsive embed-responsive-1by1"><figure class="embed-responsive-item" style="background-image: url(' + this.img_low + ')"></div>';
      },
      contentMsg: function() {
        return (this.img != null ? this.image() : this.text());
      },
      contentUser: function() {
        return (this.img != null ? '<p>' + this.text() + '</p>' : '');
      },
      text: function() {
        var text = String(this.txt),
            hashtag = view.getOption('hashtag'),
            hashtagRe = new RegExp('#' + hashtag, 'i');
        text = text.replace(/\s*http(s?):\/\/t.co\/[^/ ]*/g, '');
        text = text.replace(/(#\S+)/g, function(match, p1) {
          var hclass = 'hashtag';
          if (p1.match(hashtagRe)) {
            p1 = '#' + hashtag;
            hclass += ' self';
          }
          if (p1.length > 20) {
            p1 = p1.substr(0, 20) + '...';
          }
          return '<span class="' + hclass + '">' + p1 + '</span>';
        });
        text = text.replace(/(@\S+)/g, '<span class="buddy">$1</span>');
        return text;
      }
    };
  }

});

module.exports = {
  Message: Message,
  MessageCollection: MessageCollection,
  MessageView: MessageView,
  Globals: Globals
};
