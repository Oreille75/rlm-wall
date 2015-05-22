var _ = require('underscore'),
    $ = require('jquery'),
    Backbone = require('backbone'),
    Marionette = require('backbone.marionette'),
    dateFormat = require('dateformat');

var Stat = Backbone.Model.extend({
  constructor: function() {
    Backbone.Model.apply(this, arguments);
    var d = new Date(this.get('min_date'));
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    this.set('date', d, {silent: true});
    this.set('date_ts', d.getTime());
    this.set('date_str', dateFormat(d, 'dd/mm HH:MM'));
  }
});

var StatCollection = Backbone.Collection.extend({
  model: Stat,
  url: '/api/stats',
  comparator: function(stat) {
    return -stat.get('date_ts');
  }
});

var StatRowView = Marionette.ItemView.extend({
  tagName: 'tr',
  template: _.template(
    '<td><%= date_str %></td>' +
    '<td><%= discarded %></td>' +
    '<td><%= twitter %></td>' +
    '<td><%= instagram %></td>' +
    '<td><%= total %></td>' +
    '<td>' +
      '<a href="#" class="go">' +
      '<span class="fa fa-fw fa-step-backward"></span></a>' +
      '&nbsp;<span class="fa fa-fw cmd-status"></span>' +
    '</td>'
  ),
  ui: {
    go: 'td a.go',
    cmdStatus: 'td span.cmd-status'
  },
  events: {
    'click @ui.go': 'onGo'
  },

  onGo: function(event) {
    event.preventDefault();
    this.trigger('stat:go');
  }

});

var StatTableView = Marionette.CompositeView.extend({
  tagName: 'table',
  className: 'stats table table-striped',
  template: _.template(
    '<thead>' +
    '<tr>' +
    '<th>Date</th>' +
    '<th><span class="fa fa-times"></span></th>' +
    '<th><span class="fa fa-twitter"></span></th>' +
    '<th><span class="fa fa-instagram"></span></th>' +
    '<th>Total</th>' +
    '<th>' +
      '<a href="#" class="go">' +
      '<span class="fa fa-fw fa-fast-forward"></span></a>' +
      '&nbsp;<span class="fa fa-fw cmd-status"></span>' +
    '</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody class="data"></tbody>'
  ),
  ui: { 
    go: 'th a.go',
    cmdStatus: 'th span.cmd-status'
  },
  events: {
    'click @ui.go': 'onGoLast'
  },
  childEvents: {
    'stat:go': 'onGo'
  },
  childView: StatRowView,
  childViewContainer: 'tbody.data',

  onGo: function(child) {
    this.$el.find('span.cmd-status').removeClass('fa-check');
    child.ui.cmdStatus.addClass('fa-spin fa-spinner');
    $.post('/api/go', {
      date: child.model.get('date')
    }).then(function() {
      child.ui.cmdStatus
        .removeClass('fa-spin fa-spinner')
        .addClass('fa-check');
    });
  },

  onGoLast: function() {
    this.$el.find('span.cmd-status').removeClass('fa-check');
    this.ui.cmdStatus.addClass('fa-spin fa-spinner');
    $.post('/api/go', {
      last: true
    }).then(_.bind(function() {
      this.ui.cmdStatus
        .removeClass('fa-spin fa-spinner')
        .addClass('fa-check');
    }, this));
  }

});

/*
require('d3');
require('nvd3');

var d3 = window.d3,
    nv = window.nv;

var StatGraphView = null;

if (d3 && nv) {
  StatGraphView = Marionette.ItemView.extend({
    tagName: 'div',
    className: 'stats graph',
    template: _.template('<svg></svg>'),
    ui: {
      'svg': 'svg'
    },
    collectionEvents: {
      'add': 'itemAdded'
    },
    
    timeFormat: d3.time.format.multi([
      ['%H:%M', function(d) { return (d.getHours() % 6); }],
      ['%H:%M', function(d) { return d.getHours(); }],
      ['%d/%m %H:%M', function(d) { return true; }]
    ]),

    initialize: function() {
      // window.debug = this;
    },

    itemAdded: function(item) {
    },

    onRender: function() {
    },

    onAttach: function() {

      this.$el.height('300px');

      this.data = [
        { key: 'Twitter', values: [] },
        { key: 'Instagram', values: [] }
      ];
      this.collection.each(_.bind(function(item) {
        var date_ts = item.get('date_ts'),
            twitter = item.get('twitter'),
            instagram = item.get('instagram');
        if (twitter === 0) { twitter = null; }
        if (instagram === 0) { instagram = null; }
        this.data[0].values.unshift({ x: date_ts, y: twitter });
        this.data[1].values.unshift({ x: date_ts, y: instagram });
      }, this));


      this.chart = nv.models.stackedAreaChart()
        .xScale(d3.time.scale())
        .color(['#2f6abc', '#e95d0f'])
        // .interpolate('monotone')
        .useInteractiveGuideline(true)
      // .showControls(false)
        .duration(0)
      
      ;

      this.chart.xAxis
        .showMaxMin(false)
        .tickPadding(10)
        .tickFormat(_.bind(function(d) {
          return this.timeFormat(new Date(d)); 
        }, this))
      ;

      this.chart.yAxis
        .showMaxMin(false)
      ;

      d3.select(this.ui.svg[0])
        .datum(this.data)
        .transition()
        .call(this.chart);

      $(window).on('resize', _.debounce(
        _.bind(this.chart.update, this.chart), 150
      ));
      
    },

    onDomRefresh: function() {
      // nv.utils.windowResize(this.chart.update);

    }

  });
}
*/

module.exports = {
  Stat: Stat,
  StatCollection: StatCollection,
  StatTableView: StatTableView,
  // StatGraphView: StatGraphView,
  StatView: StatTableView
};
