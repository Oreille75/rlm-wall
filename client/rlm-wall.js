/*jshint multistr: true */

var fs = require('fs');

var _ = require('underscore'),
    $ = require('jquery'),
    Backbone = require('backbone');

Backbone.$ = $;
   
require('./vendor/jquery.transit');

var Marionette = require('backbone.marionette'),
    io = require('socket.io-client'),

    common = require('./common'),
    Message = common.Message,
    MessageCollection = common.MessageCollection,
    MessageView = common.MessageView,
    Globals = common.Globals,

    flip = require('./flip'),
    FlipCounterModel = flip.FlipCounterModel,
    FlipCounterView = flip.FlipCounterView;

var SocialWallColumnView = Marionette.CollectionView.extend({
  tagName: 'div',
  className: 'col',
  template: _.template(''),
  childView: MessageView,

  childViewOptions: function(model, index) {
    return {
      hashtag: this.options.parentView.options.hashtag
    };
  },

  onAddChild: function(childView) {
    childView.$el
      .css('opacity', 0)
      .transition({
        opacity: 1, 
        scale: 1.1
      }, 150)
      .transition({
        scale: 1
      }, 200);
  },

  onBeforeRemoveChild: function(childView) {
    this.addTopSpace(childView.$el.outerHeight(true));
  },

  onRemoveChild: function(childView) {
  },

  addTopSpace: function(space) {
    this.$el.css('padding-top',
                 (parseInt(this.$el.css('padding-top')) + space) + 'px');
  }

});

var SocialWallView = Backbone.Marionette.LayoutView.extend({
  tagName: 'div',
  className: 'messages',
  template: _.template('<div class="messages-col col0"></div>' +
                       '<div class="messages-col col1"></div>'),
  regions: {
    col0: '.col0',
    col1: '.col1'
  },
  events: {
  },
  collectionEvents: {
    'add': 'start'
  },
  scrollSpeed: 160,

  initialize: function(options) {
    this.scrolling = false;
    this.scrollId = 0;
    this.paused = false;
    this.displaying = false;
  },

  onBeforeShow: function() {
    this.displayedMessages = [
      new MessageCollection(),
      new MessageCollection()
    ];

    this.columnViews = [
      new SocialWallColumnView({
        collection: this.displayedMessages[0],
        parentView: this
      }),
      new SocialWallColumnView({
        collection: this.displayedMessages[1],
        parentView: this
      })
    ];

    this.col0.show(this.columnViews[0]);
    this.col1.show(this.columnViews[1]);
  },

  start: function() {
    if (!this.scrolling && !this.paused && this.collection.length) {
      this.displayMessage(this.collection.at(0));
    }
    if (!this.scrolling && this.displaying && this.collection.length === 0) {
      this.displaying = false;
      this.trigger('displayEnd');
    }
  },

  displayMessage: function(message) {
    this.displaying = true;
    this.collection.remove(message);
    if (this.displayedMessages[0].get(message) ||
        this.displayedMessages[1].get(message)) {
      this.start();
      return;
    }
    var i = ((this.col0.currentView.$el.outerHeight() >
              this.col1.currentView.$el.outerHeight()) ? 1 : 0);
    this.displayedMessages[i].add(message);
    this.scrollToEnd();
    this.trigger('displayMessage', message);
  },

  checkExpired: function() {
    var parentHeight = this.$el.parent().outerHeight(true);
    _.each([this.col0, this.col1], function(col, index) {
      col.currentView.children.each(function(child) {
        var colView = col.currentView,
            colHeight = col.$el.outerHeight(true);
        var childBottom = 
              child.$el.position().top + 
              child.$el.outerHeight(true);
        if (parentHeight - colHeight + childBottom < 0) {
          col.currentView.collection.remove(child.model);
        }
      }, this);
    }, this);

    var p0 = parseInt(this.columnViews[0].$el.css('padding-top')),
        p1 = parseInt(this.columnViews[1].$el.css('padding-top')),
        free;

    if (p0 > 0 && p1 > 0) {
      free = Math.min(p0, p1);
      this.columnViews[0].addTopSpace(-free);
      this.columnViews[1].addTopSpace(-free);
      this.$el.css('y', this.$el.position().top + free);
    }
    
  },

  scrollToEnd: function(immediate) {
    var parentHeight = this.$el.parent().outerHeight(true),
        thisHeight = this.$el.outerHeight(true),
        oldTop = -this.$el.position().top,
        newTop = thisHeight - parentHeight,
        scroll = (newTop - oldTop),
        speed = (immediate || scroll < 0) ? 
          200 : scroll * 1760 * (1 / (this.getOption('scrollSpeed') + 1));
    this.scrollId++;
    this.scrolling = true;
    this.paused = false;
    this.$el
      .clearQueue()
      .transition({
        y: -newTop
      }, speed, 'linear', _.bind(this.afterScroll, this, this.scrollId));
  },
  
  afterScroll: function(scrollId) {
    if (scrollId !== this.scrollId) {
      return;
    }
    if (this.paused) {
      return;
    }
    
    this.scrolling = false;
    this.checkExpired();
    this.start();
  },

  pause: function() {
    if (!this.paused) {
      this.paused = true;
      this.$el.clearQueue();
      this.$el.css('transition', '');
      this.scrolling = false;
    }
  },

  resume: function() {
    this.paused = false;
    this.scrollToEnd(true);
    /*
    if (this.collection.length !== 0) {
      this.scrollToEnd(true);
    }
    else {
      this.trigger('displayEnd');
    }
    */
  },

  removeMessage: function(message) {
    for (var i = 0; i <= 1; i++) {
      this.displayedMessages[i].remove(message);
    }
  },

  onWindowResize: function() {
    if (this.paused) {
      return;
    }
    this.scrollToEnd(true);
  }

});

var ZoomView = Backbone.Marionette.ItemView.extend({
  template: _.template(''),
  winTemplate: _.template(
    fs.readFileSync(__dirname + '/templates/win.html', 'utf8')
  ),
  collectionEvents: {
    'add': 'start'
  },
  timerZoom: 3,
  timerWin: 3,
  msgWin: '',

  initialize: function(options) {
    this.displaying = false;
    this.paused = false;
    this.timer = null;
  },

  start: function() {
    if (this.displaying || this.paused || !this.collection.length) {
      return;
    }
    this.current = this.collection.at(0);
    this.collection.remove(this.current);
    this.displaying = true;
    this.displayMessageZoom();
  },

  displayMessageZoom: function() {
    var messageView = new MessageView({model: this.current});
    messageView.render();
    this.$el.html(messageView.$el);
    this.resizeFigures();
    var next = (this.current.get('special') === 'win' ?
                this.displayMessageWin : this.displayEnd);
    this.timer =
      _.delay(_.bind(next, this), this.getOption('timerZoom') * 1000);
  },
  
  displayMessageWin: function() {
    var values = this.current.toJSON();
    values.msg_win = _.map(
      this.getOption('msgWin').split('\n'), 
      function(line) { return '<p>' + line + '</p>'; }
    ).join('').replace('{{user}}', 
                       '<span class="user">' + values.user + '</span>');
    var winHtml = this.winTemplate(values);
    this.$el.html(winHtml);
    this.timer = 
      _.delay(_.bind(this.displayEnd, this), this.getOption('timerWin') * 1000);
  },

  displayEnd: function() {
    this.timer = null;
    this.displaying = false;
    if (this.collection.length) {
      this.start();
    }
    else {
      this.trigger('displayEnd');
    }
  },

  initialMessage: function(message) {
    if (this.displaying || this.collection.length) {
      return;
    }
    var messageView = new MessageView({model: message});
    messageView.render();
    this.$el.html(messageView.$el);
    this.resizeFigures();
  },
  
  pause: function() {
    this.paused = true;
    /*
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    */
  },

  resume: function() {
    this.paused = false;
    this.start();
  },

  resizeFigures: function() {
    var w = this.$el.width(), 
        h = this.$el.height(),
        d = Math.floor(Math.min(Math.floor(w/2), h) * 0.8);
    this.$el.find('figure').width(d).height(d);
  },

  onWindowResize: function() {
    this.resizeFigures();
  }

});

var app = new Marionette.Application();

app.globals = new Globals();

app.messages = new MessageCollection();
app.messages.comparator = MessageCollection.comparators.dateAsc;

app.zoomQueue = new MessageCollection();
app.zoomQueue.comparator = MessageCollection.comparators.dateAsc;

app.counters = {
  facebook: new FlipCounterModel(),
  twitter: new FlipCounterModel(),
  instagram: new FlipCounterModel()
};

app.addRegions({
  fbCountRegion: '.counter.facebook .digits',
  twCountRegion: '.counter.twitter .digits',
  igCountRegion: '.counter.instagram .digits',
  messagesRegion: '#messages',
  zoomRegion: '#zoom',
  homeRegion: '#home'
});

app.socialWallView = new SocialWallView({
  collection: app.messages,
  hashtag: '',
  scrollSpeed: 100
});
app.messagesRegion.show(app.socialWallView);

app.zoomView = new ZoomView({
  collection: app.zoomQueue,
  winMsg: ''
});
app.zoomRegion.show(app.zoomView);

app.zoomRegion.$el.css({ opacity: 0 });
app.homeRegion.$el.css({ opacity: 0 });

var homeContent = $('body > footer h2').html() + '<span class="win"></span>';
app.homeRegion.$el.html('<div class="inner"><h1>' + 
                        homeContent + '</h1></div>');

app.fbCountRegion.show(new FlipCounterView({ model: app.counters.facebook }));
app.twCountRegion.show(new FlipCounterView({ model: app.counters.twitter }));
app.igCountRegion.show(new FlipCounterView({ model: app.counters.instagram }));

app.addInitializer(function(options) {
  var waitHome = false,
      timerHome = 3,
      timerHomeId = null,
      init = false,
      screen = '';

  this.zoomView.pause();
  
  this.on('globals', function(globals) {
    this.globals.set(globals);
    if (globals.followers) {
      this.trigger('followers', globals.followers);
    }
  });

  this.listenTo(this.globals, 'change:scroll_speed', function() {
    this.socialWallView.options.scrollSpeed = this.globals.get('scroll_speed');
    this.socialWallView.onWindowResize();
  });

  this.listenTo(this.globals, 'change:tag', function() {
    this.socialWallView.options.hashtag = this.globals.get('tag');
  });

  this.listenTo(this.globals, 'change:msg_win_home', function() {
    this.homeRegion.$el
      .find('span.win')
      .html(this.globals.get('msg_win_home'));
  });

  this.listenTo(this.globals, 'change', function() {
    this.zoomView.timerZoom = this.globals.get('timer_zoom');
    this.zoomView.timerWin = this.globals.get('timer_win');
    this.zoomView.msgWin = this.globals.get('msg_win_scr');
    timerHome = this.globals.get('timer_home');
  });

  this.listenTo(this.globals, 'change:screen', function() {
    screen = this.globals.get('screen');
    waitHome = false;
    if (timerHomeId) {
      timerHomeId = null;
      clearTimeout(timerHomeId);
    }
    if (!init) {
      app.zoomRegion.$el.stop().css({ opacity: 1 });
      app.homeRegion.$el.stop().css({ opacity: 1 });
      init = true;
    }
    if (screen === 'wall') {
      this.zoomRegion.$el.stop().fadeOut('slow');
      this.homeRegion.$el.stop().fadeOut('slow');
      this.socialWallView.resume();
      this.zoomView.pause();
    }
    if (screen === 'zoom') {
      this.zoomRegion.$el.stop().fadeIn(0);
      this.homeRegion.$el.stop().fadeOut('slow');
      this.socialWallView.pause();
      this.zoomView.resume();
    }
    if (screen === 'home') {
      this.zoomRegion.$el.stop().fadeOut('slow');
      this.homeRegion.$el.stop().fadeIn('slow');
      this.socialWallView.pause();
      this.zoomView.pause();
    }
    if (screen === 'auto') {
      if (this.zoomQueue.length) {
        this.zoomRegion.$el.stop().fadeIn(0);
        this.socialWallView.pause();
        this.zoomView.resume();
      }
      else if (this.messages.length) {
        this.zoomRegion.$el.stop().fadeOut('slow');
        this.homeRegion.$el.stop().fadeOut('slow');
        this.socialWallView.resume();
        this.zoomView.pause();
      }
      else {
        this.zoomRegion.$el.stop().fadeOut('slow');
        this.homeRegion.$el.stop().fadeIn('slow');
        this.socialWallView.pause();
        this.zoomView.pause();
      }
    }
  });

  this.on('message', function(message) {
    var m = new Message(message),
        special = m.get('special');
    if (m.get('discarded')) {
      return;
    }
    if (screen === 'auto') {
      if (special !== '') {
        this.homeRegion.$el.stop().fadeOut(0);
        this.zoomRegion.$el.stop().fadeIn(0);
        this.socialWallView.pause();
        this.zoomView.resume();
      }
      else {
        if (!waitHome && this.homeRegion.$el.is(':visible')) {
          this.homeRegion.$el.stop().fadeOut('slow');
          this.socialWallView.resume();
        }
      }
    }
    if (special !== '') {
      this.zoomQueue.add(m);
    }
    this.messages.add(m);
  });

  this.on('remove-message', function(id) {
    this.messages.remove(id);
    this.messagesRegion.currentView.removeMessage(id);
  });

  this.on('followers', function(followers) {
    if (followers.facebook !== null) {
      this.counters.facebook.set('value', followers.facebook);
    }
    if (followers.twitter !== null) {
      this.counters.twitter.set('value', followers.twitter);
    }
    if (followers.instagram !== null) {
      this.counters.instagram.set('value', followers.instagram);
    }
  });

  this.on('last-zoom', function(last_zoom) {
    var m = new Message(last_zoom);
    this.zoomView.initialMessage(m);
  });

  this.socialWallView.on('displayMessage', function(message) {
    $('body > footer').addClass('last-' + message.get('type'));
    setTimeout(function() { 
      $('body > footer').removeClass('last-instagram last-twitter');
    }, 2000);
  });

  $(window).on('resize', _.debounce(_.bind(function() {
    this.socialWallView.onWindowResize();
    this.zoomView.onWindowResize();
  }, this), 150));

  this.zoomView.on('displayEnd', _.bind(function() {
    if (screen === 'auto') {
      this.zoomRegion.$el.stop().fadeOut('slow');
      this.socialWallView.resume();
    }
  }, this));

  this.socialWallView.on('displayEnd', _.bind(function() {
    var self = this;
    if (screen === 'auto') {
      if (waitHome) {
        return;
      }
      if (timerHomeId !== null) {
        clearTimeout(timerHomeId);
        timerHomeId = null;
      }
      timerHomeId = _.delay(function() {
        timerHomeId = null;
        if (self.messages.length === 0) {
          // console.log('displayEnd - back to home.');
          self.homeRegion.$el.stop().fadeIn('slow');
          waitHome = true;
          _.delay(function() {
            // console.log('displayEnd - ready.');
            waitHome = false;
          }, timerHome * 1000);
        }
      }, timerHome * 1000);
    }
  }, this));

});

app.on('start', function() {

  var socket = io.connect();

  socket.on('connect', function() {
    socket.emit('client-handshake', {});
  });
  socket.on('reload', function() {
    window.location.reload();
  });
  socket.on('globals', function(globals) {
    app.trigger('globals', globals);
  });
  socket.on('message', function(message) {
    app.trigger('message', message);
  });
  socket.on('remove-message', function(id) {
    app.trigger('remove-message', id);
  });
  socket.on('followers', function(followers) {
    app.trigger('followers', followers);
  });
  socket.on('messages', function(messages) {
    app.messages.set([]);
    _.each(messages.reverse(), function(message) {
      message.special = '';
      app.trigger('message', message);
    });
  });
  socket.on('last-zooms', function(last_zooms) {
    if (_.isArray(last_zooms) && last_zooms.length) {
      app.trigger('last-zoom', last_zooms[0]);
    }
  });
});

// Fonts preload
$('body').append('\
<div id="font-preload" style="opacity: 0">\
  <span class="fa fa-twitter"></span>\
  <span class="fa fa-instagram"></span>\
  <span style="font-family: \'Futura Heavy\'">Futura Heavy</span>\
  <span style="font-family: \'Futura\'">Futura</span>\
</div>');

$(window).on('load', function() {
  $('#font-preload').remove();
  app.start();
});

window.app = app;
