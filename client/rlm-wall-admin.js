var fs = require('fs');

var _ = require('underscore'),
    $ = require('jquery'),
    Backbone = require('backbone');

Backbone.$ = $;

var Marionette = require('backbone.marionette'),
    io = require('socket.io-client'),
    dateFormat = require('dateformat'),
    common = require('./common'),
    stats = require('./admin-stats'),
    Message = common.Message,
    MessageCollection = common.MessageCollection,
    MessageView = common.MessageView,
    Globals = common.Globals;

var $w = $(window),
    $d = $(document);

var MessageAdminView = MessageView.extend({
  tagName: 'div',
  className: 'media message-admin',
  template: _.template(
    fs.readFileSync(__dirname+'/templates/admin-message.html', 'utf8')
  ),
  events: {
    'click .media-footer button': 'onActionClick'
  },
  modelEvents: {
    'change:discarded': 'onModelChange',
    'change:special': 'onModelChange'
  },

  onBeforeRender: function() {
    this.$el.addClass(this.model.get('type'));
    this.$el.attr('data-id', this.model.get('_id'));
    if (this.model.get('validated')) {
      this.$el.attr('data-v', this.model.get('special') || 'on');
    }

    if (this.model.get('discarded')) {
      this.$el.addClass('discarded');
    }
    else {
      this.$el.removeClass('discarded');
    }

  },

  onModelChange: function() {
    this.render();
  },

  templateHelpers: function() {
    var actionTemplate = 
          _.template('<button type="button" href="#<%= action %>"' +
                     ' class="btn btn-action <%= action %>">' +
                     '<span class="fa fa-fw fa-<%= icon %>"></span>' +
                     '</button>');

    return _.extend(MessageView.prototype.templateHelpers.call(this), {
      date: function() {
        return dateFormat(new Date(this.ts), "dd/mm HH:MM:ss");
      },
      mediaBody: function() {
        var image = this.imageLow();
        if (image) {
          return ('<div class="row">' +
                  '<div class="col-sm-8"><p>' + this.text() + '</p></div>' +
                  '<div class="col-sm-4">' + image + '</div>'+
                  '</div>');
        }
        else {
          return ('<div class="row">' +
                  '<div class="col-sm-12">' + this.text() + '</div>' +
                  '</div>');
        }
      },
      actions: function() {
        var actions;
        if (this.discarded) {
          actions = [
            { action: 'undo-discard', icon: 'undo' }
          ];
        }
        else {
          actions = [
            { action: 'discard', icon: 'times' },
            { action: 'validate', icon: 'check' },
            { action: 'zoom', icon: 'star' },
            { action: 'win', icon: 'trophy' }
          ];
        }
        var ret = '';
        _.each(actions, function(a) {
          ret += actionTemplate(a);
        });
        return ret;
      }
    });
  },

  onActionClick: function(event) {
    var href = $(event.currentTarget).attr('href').replace('#', '');
    this.model.action(href);
  }

});

var MessageAdminCollectionView = Marionette.CompositeView.extend({
  tagName: 'div',
  className: 'messages',
  ui: {
    messages: 'section',
    header: 'header',
    footer: 'footer',
    more: 'footer .more'
  },
  events: {
    'click @ui.more': 'onMore'
  },
  template: _.template(
    fs.readFileSync(__dirname + '/templates/admin-messages.html', 'utf8')
  ),
  childView: MessageAdminView,
  childViewContainer: 'section.messages',

  initialize: function() {
    this.listenTo(this, 'layout:scroll', this.onScroll);
    this.moreRunning = false;
  },
  
  onRender: function() {
    if (this.collection.length) {
      this.ui.more.show();
    }
    else {
      this.ui.more.hide();
    }
  },

  onMore: function() {
    this.moreRunning = true;
    this.ui.more.prop('disabled', true);
    this.ui.more.addClass('running');
    this.collection.more()
      .done(_.bind(function(data) {
        this.ui.more.removeClass('running');
        this.moreRunning = false;
        if (data.length === 0) {
          this.ui.more.hide();
        }
        else {
          this.ui.more.prop('disabled', false);
        }
      }, this))
      .fail(function() {
        this.moreRunning = false;
        this.ui.more.prop('disabled', false);
        this.ui.more.removeClass('running');
      });
  },

  onScroll: function(s) {
    if (!this.moreRunning && s.bottom < 300) {
      this.onMore();
    }
  }

});

var ConfigView = Marionette.ItemView.extend({
  tagName: 'div',
  className: 'config',
  ui: {
    inputs: 'input, textarea'
  },
  events: {
    'change': 'onViewChange'
  },
  modelEvents: {
    change: 'onModelChange'
  },
  template: _.template(
    fs.readFileSync(__dirname + '/templates/admin-config.html', 'utf8')
  ),

  templateHelpers: function() {
    return {
      checked: function(attr) {
         return this[attr] ? 'checked="checked"' : '';
      },
      checkbox: function(attr, label) {
        return ('<div class="checkbox">' +
                '<label>' +
                '<input name="' + attr + '" type="checkbox"' +
                (this[attr] ? ' checked="checked"' : '') +
                '> ' + label + '</label></div>');
      },
      textarea_content: function(content) {
        var tagsToReplace = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;'
        };
        function replaceTag(tag) {
          return tagsToReplace[tag] || tag;
        }
        return content.replace(/[&<>]/g, replaceTag);
      }
    };
  },

  bindUIElements: function() {
    _.each(_.keys(this.model.toJSON()), function(k) {
      if (!this.ui.hasOwnProperty(k)) {
        this.ui[k] = '[name=' + k + ']';
      }
    }, this);
    Marionette.ItemView.prototype.bindUIElements.call(this);
  },
  
  onViewChange: function(event) {
    event.stopPropagation();
    var $target = $(event.target);
    var tagName = $target.prop('tagName').toLowerCase(),
        name = $target.attr('name'),
        type,
        set = {};
    if (tagName === 'input') {
      type = $target.attr('type');
      if (type === 'checkbox') {
        set[name] = $target.prop('checked');
      }
      else {
        set[name] = $target.prop('value');
      }
    }
    if (tagName === 'textarea') {
      set[name] = $target.val();
    }
    this.model.set(set);
    this.model.save(set, {patch: true});
  },

  onShow: function() {
    if (this.model.get('running')) {
      this.ui.track_twitter.prop('disabled', true);
      this.ui.track_instagram.prop('disabled', true);
      this.ui.tag.prop('disabled', true);
    }
    else {
      this.ui.track_twitter.prop('disabled', false);
      this.ui.track_instagram.prop('disabled', false);
      this.ui.tag.prop('disabled', false);
    }
  },

  onModelChange: function(event) {
    if (!this._isShown) {
      return;
    }
    _.each(_.keys(event.changed), function(k) {
      var input = this.ui[k], tagName, type;
      if (input && input.length) {
        tagName = input.prop('tagName').toLowerCase();
        if (tagName === 'input') {
          type = input.attr('type');
          if (type === 'checkbox') {
            input.prop('checked', event.changed[k]);
          }
          else if (type === 'radio') {
            input
              .filter('[value="' + event.changed[k] + '"]')
              .prop('checked', true);
          }
          else {
            input.prop('value', event.changed[k]);
          }
        }
        if (tagName === 'textarea') {
          input.val(event.changed[k]);
        }
      }
    }, this);
    if (event.changed.hasOwnProperty('running')) {
      this.onShow();
    }
  }

});

var app = new Marionette.Application();

app.locals = new Backbone.Model({newMessages: 0});

app.globals = new Globals();

app.messages = new MessageCollection();
app.messages.url = '/api/admin-messages';
app.messages.comparator = MessageCollection.comparators.dateDesc;

app.validated = new MessageCollection();
app.validated.comparator =  MessageCollection.comparators.dateDesc;
app.validated.url = '/api/messages';

app.stats = new stats.StatCollection();

app.addRegions({layout: 'body'});

window.app = app;

var AppLayoutView = Marionette.LayoutView.extend({
  regions: {
    main: '.main'
  },
  ui: {
    navItems: 'nav li',
    navLinks: 'nav li > a',
    badge: 'nav .badge'
  },
  events: {
    'click @ui.navLinks': 'onNav'
  },
  template: _.template(
    fs.readFileSync(__dirname + '/templates/admin-layout.html', 'utf8')
  ),

  onShow: function() {

    $(window).on('scroll', _.debounce(_.bind(this.afterScroll, this), 50));

    app.locals.on('change:newMessages', _.bind(function(model) {
      var nm = app.locals.get('newMessages');
      if (nm === 0) {
        this.ui.badge.text('').hide();
      }
      else {
        this.ui.badge.text(nm).show();
      }
    }, this));

  },

  onNav: function(event) {
    event.stopPropagation();
    event.preventDefault();
    var href = $(event.currentTarget).attr('href');
    app.trigger('navigate', href);
  },

  setActiveMenu: function(id) {
    this.ui.navItems.removeClass('active');
    this.ui.navItems.filter('#nav-' + id).addClass('active');
  },

  afterScroll: function(event) {
    if (!this.main.currentView) {
      return;
    }
    var s = $w.scrollTop(), 
        wh = $w.height(), 
        dh = $d.height(), 
        b = dh - s - wh;
    this.main.currentView.trigger('layout:scroll', {
      top: s,
      bottom: b
    });
  }

});

app.pageViews = {
  messages: new MessageAdminCollectionView({ collection: app.messages }),
  validated: new MessageAdminCollectionView({ collection: app.validated }),
  config: new ConfigView({ model: app.globals }),
  stats: new stats.StatView({ collection: app.stats })
};

app.layoutView = new AppLayoutView();

var AppRouter = Marionette.AppRouter.extend({
  routes: {
    '': 'messages',
    'messages': 'messages',
    'validated': 'validated',
    'config': 'config',
    'stats': 'stats'
  },
  onRoute: function(name) {
    app.layoutView.setActiveMenu(name);
    app.layoutView.main.show(app.pageViews[name], { preventDestroy: true });
  }
});

app.router = new AppRouter();

app.addInitializer(function(options) {

  this.on('globals', function(globals) {
    this.globals.set(globals);
  });

  this.on('message', _.bind(function(message) {
    var m = new Message(message);
    if (m.get('validated')) {
      this.validated.add(m, {merge: true});
      this.messages.remove(m);
    }
    else {
      this.validated.remove(m);
      if (this.messages.get(m)) {
        this.messages.add(m, {merge: true});
      }
      else {
        if (!m.get('discarded')) {
          this.locals.set('newMessages', this.locals.get('newMessages') + 1);
        }
      }
    }
  }, this));

  this.on('navigate', _.bind(function(href) {
    var onError = function() {
      window.location.reload();
    };
    var name = href.replace('#', '');
    if (name === 'messages') {
      this.locals.set('newMessages', 0);
      this.messages.fetch({ error: onError });
    }
    if (name === 'validated') {
      this.validated.fetch({ error: onError });
    }
    if (name === 'stats') {
      this.stats.fetch({ error: onError });
    }
    this.router.navigate(href, { trigger: true });
    $w.scrollTop(0);
  }, this));

});

app.on('start', function() {

  var socket = io.connect();

  socket.on('connect', function() {
    socket.emit('admin-handshake', {});
  });

  socket.on('reload', function() {
    window.location.reload();
  });
  
  app.layout.show(app.layoutView);

  socket.on('globals', function(globals) {
    app.trigger('globals', globals);
  });
  
  socket.on('message', function(message) {
    app.trigger('message', message);
  });

  Backbone.history.start({
    pushState: true,
    root: 'admin'
  });

});

$.when(
  app.messages.fetch(),
  app.validated.fetch(),
  app.stats.fetch()
).then(function() {
  app.start();
});
