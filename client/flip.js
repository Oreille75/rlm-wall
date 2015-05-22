var $ = require('jquery'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    Marionette = require('backbone.marionette');

var FlipCounterModel = Backbone.Model.extend({
  defaults: {
    value: 0
  }
});

var FlipCounterView = Marionette.ItemView.extend({
  template: false,
  tagName: 'div',
  className: 'flip-counter',

  ui: {
    digits: '.flip-digit'
  },

  modelEvents: {
    'change:value': 'onModelValueChanged'
  },

  digitCount: 5,

  onBeforeRender: function() {
    this._value = '';
    var html = '', i, d, l = '0';
    var addItem = function(c) {
      html += 
        '<li class="'+c+'">'+
        '<div class="i">'+
        '<div class="up">'+
        '<div class="shadow"></div>'+
        '<div class="l"><span>'+l+'</span></div>'+
        '</div>'+
        '<div class="down">'+
        '<div class="shadow"></div>'+
        '<div class="l"><span>'+l+'</span></div>'+
        '</div>'+
        '</div>'+
        '</li>';
    };
    for (i = 0; i < this.getOption('digitCount'); i++) {
      html += '<ul class="flip-digit">';
      _.each(['active', 'before'], addItem);
      html += '</ul>';
      this._value += l;
    }
    this.el.innerHTML = html;
  },

  onModelValueChanged: function() {
    var d = this.getOption('digitCount'),
        value = this.model.get('value'),
        v = String(value === null ? '' : value),
        i, digit, new_l, old_l;

    var setDigit = function(_digit, _new_l, _old_l) {
      _digit.find('.before .up .l span').html(_old_l);
      _digit.find('.before .down .l span').html(_old_l);
      _digit.find('.active .up .l span').html(_new_l);
      _digit.find('.active .down .l span').html(_new_l);
      _digit.addClass('play');
    };

    if (v.length > d) {
      v = v.substr(v.length - d);
    }
    if (v.length < d) {
      for (i = v.length; i < d; i++) {
        v = ' ' + v;
      }
    }
    for (i = 0; i < d; i++) {
      digit = this.ui.digits.eq(i);
      new_l = v[i];
      old_l = digit.find('.active .up .l span').html();
      if (new_l !== old_l) {
        // _.delay(setDigit, (d - i) * 25, digit, new_l, old_l);
        setDigit(digit, new_l, old_l);
      }
    }

    this._value = v;

    setTimeout(_.bind(function() {
      this.ui.digits.removeClass('play');
    }, this), 1000);

  }

});

module.exports = {
  FlipCounterModel: FlipCounterModel,
  FlipCounterView: FlipCounterView
};
