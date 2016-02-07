var Nyaplot = (function (_,uuid,colorbrewer) {
  'use strict';

  _ = 'default' in _ ? _['default'] : _;
  uuid = 'default' in uuid ? uuid['default'] : uuid;
  colorbrewer = 'default' in colorbrewer ? colorbrewer['default'] : colorbrewer;

  var Manager = {
      data_frames: {},
      panes: []
  };

  // add a data source (DataFrame) by name
  Manager.addData = function (name, df) {
      var entry = {};
      entry[name] = df;
      _.extend(this.data_frames, entry);
  };

  // Fetch a data source by name
  Manager.getData = function (name) {
      return this.data_frames[name];
  };

  // Add a pane to the manager
  Manager.addPane = function (pane) {
      this.panes.push(pane);
  };

  // Update and redraw the panes
  Manager.update = function (uuid) {
      if (arguments.length > 0) {
          var entries = _.filter(this.panes, function (entry) {
              return entry.uuid == uuid;
          });
          _.each(entries, function (entry) {
              entry.pane.update();
          });
      } else {
          _.each(this.panes, function (entry) {
              entry.pane.update();
          });
      }
  };

  function SimpleLegend(data, _options) {
      var options = {
          title: '',
          width: 150,
          height: 22,
          title_height: 15,
          mode: 'normal'
      };
      if (arguments.length > 1) _.extend(options, _options);

      this.model = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "g"));
      this.options = options;
      this.data = data;

      return this;
  }

  SimpleLegend.prototype.width = function () {
      return this.options.width;
  };

  SimpleLegend.prototype.height = function () {
      return this.options.height * this.data.length;
  };

  // Create dom object independent form pane or context and return it. called by each diagram.o
  SimpleLegend.prototype.getDomObject = function () {
      var model = this.model;
      var options = this.options;

      model.append("text").attr("x", 12).attr("y", options.height).attr("font-size", "14").text(options.title);

      var entries = this.model.selectAll("g").data(this.data).enter().append("g");

      var circle = entries.append("circle").attr("cx", "8").attr("cy", function (d, i) {
          return options.height * (i + 1);
      }).attr("r", "6").attr("stroke", function (d) {
          return d.color;
      }).attr("stroke-width", "2").attr("fill", function (d) {
          return d.color;
      }).attr("fill-opacity", function (d) {
          return d.mode == 'off' ? 0 : 1;
      });

      switch (options.mode) {
          case 'normal':
              circle.on("click", function (d) {
                  if (!(!d['on'] && !d['off'])) {
                      var el = d3.select(this);
                      if (el.attr("fill-opacity") == 1) {
                          el.attr("fill-opacity", 0);
                          d.off();
                      } else {
                          el.attr("fill-opacity", 1);
                          d.on();
                      };
                  }
              });
              break;
          case 'radio':
              circle.on("click", function (d) {
                  var el = d3.select(this);
                  if (el.attr("fill-opacity") == 0) {
                      var thisObj = this;
                      circle.filter(function (d) {
                          return this != thisObj && !(!d['on'] && !d['off']);
                      }).attr("fill-opacity", 0);
                      el.attr("fill-opacity", 1);
                      d.on();
                  }
              });
              break;
      }

      circle.style("cursor", function (d) {
          if (d['on'] == undefined && d['off'] == undefined) return "default";else return "pointer";
      });

      entries.append("text").attr("x", "18").attr("y", function (d, i) {
          return options.height * (i + 1) + 4;
      }).attr("font-size", "12").text(function (d) {
          return d.label;
      });

      return model;
  };

  function Bar(parent, scales, df_id, _options) {
      var options = {
          value: null,
          x: null,
          y: null,
          width: 0.9,
          color: null,
          hover: true,
          tooltip_contents: null,
          tooltip: null,
          legend: true
      };
      if (arguments.length > 3) _.extend(options, _options);

      var df = Manager.getData(df_id);

      var color_scale;
      if (options.color == null) color_scale = d3.scale.category20b();else color_scale = d3.scale.ordinal().range(options.color);
      this.color_scale = color_scale;

      var model = parent.append("g");

      var legend_data = [],
          labels;

      if (options.value != null) {
          var column_value = df.column(options.value);
          labels = _.uniq(column_value);
      } else labels = df.column(options.x);

      _.each(labels, function (label) {
          legend_data.push({
              label: label,
              color: color_scale(label)
          });
      });

      this.model = model;
      this.scales = scales;
      this.options = options;
      this.legend_data = legend_data;
      this.df = df;
      this.df_id = df_id;
      this.uuid = options.uuid;

      return this;
  }

  // fetch data and update dom object. called by pane which this chart belongs to.
  Bar.prototype.update = function () {
      var data;
      if (this.options.value !== null) {
          var column_value = this.df.columnWithFilters(this.uuid, this.options.value);
          var raw = this.countData(column_value);
          data = this.processData(raw.x, raw.y, this.options);
      } else {
          var column_x = this.df.columnWithFilters(this.uuid, this.options.x);
          var column_y = this.df.columnWithFilters(this.uuid, this.options.y);
          data = this.processData(column_x, column_y, this.options);
      }

      var rects = this.model.selectAll("rect").data(data);
      rects.enter().append("rect").attr("height", 0).attr("y", this.scales.get(0, 0).y);

      this.updateModels(rects, this.scales, this.options);
  };

  // process data as:
  //     x: [1,2,3,...], y: [4,5,6,...] -> [{x: 1, y: 4},{x: 2, y: 5},...]
  Bar.prototype.processData = function (x, y, options) {
      return _.map(_.zip(x, y), function (d, i) {
          return {
              x: d[0],
              y: d[1]
          };
      });
  };

  // update dom object
  Bar.prototype.updateModels = function (selector, scales, options) {
      var color_scale = this.color_scale;

      var onMouse = function onMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d3.rgb(color_scale(d.x)).darker(1);
          });
          var id = d3.select(this).attr("id");
          options.tooltip.addToYAxis(id, this.__data__.y);
          options.tooltip.update();
      };

      var outMouse = function outMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return color_scale(d.x);
          });
          var id = d3.select(this).attr("id");
          options.tooltip.reset();
      };

      var width = scales.raw.x.rangeBand() * options.width;
      var padding = scales.raw.x.rangeBand() * ((1 - options.width) / 2);

      selector.attr("x", function (d) {
          return scales.get(d.x, d.y).x + padding;
      }).attr("width", width).attr("fill", function (d) {
          return color_scale(d.x);
      }).transition().duration(200).attr("y", function (d) {
          return scales.get(d.x, d.y).y;
      }).attr("height", function (d) {
          return scales.get(0, 0).y - scales.get(0, d.y).y;
      }).attr("id", uuid.v4());

      if (options.hover) selector.on("mouseover", onMouse).on("mouseout", outMouse);
  };

  // return legend object based on data prepared by initializer
  Bar.prototype.getLegend = function () {
      var legend = new SimpleLegend(this.options.legend ? this.legend_data : {});
      return legend;
  };

  // count unique value. called when 'value' option was specified insead of 'x' and 'y'
  Bar.prototype.countData = function (values) {
      var hash = {};
      _.each(values, function (val) {
          hash[val] = hash[val] || 0;
          hash[val] += 1;
      });
      return {
          x: _.keys(hash),
          y: _.values(hash)
      };
  };

  // not implemented yet.
  Bar.prototype.checkSelectedData = function (ranges) {
      return;
  };

  function Filter(parent, scales, callback, _options) {
      var options = {
          opacity: 0.125,
          color: 'gray'
      };
      if (arguments.length > 2) _.extend(options, _options);

      var brushed = function brushed() {
          var ranges = {
              x: brush.empty() ? scales.domain().x : brush.extent(),
              y: scales.domain().y
          };
          callback(ranges);
      };

      var brush = d3.svg.brush().x(scales.raw.x).on("brushend", brushed);

      var model = parent.append("g");
      var height = d3.max(scales.range().y) - d3.min(scales.range().y);
      var y = d3.min(scales.range().y);

      model.call(brush).selectAll("rect").attr("y", y).attr("height", height).style("fill-opacity", options.opacity).style("fill", options.color).style("shape-rendering", "crispEdges");

      return this;
  }

  function Histogram(parent, scales, df_id, _options) {
      var options = {
          title: 'histogram',
          value: null,
          bin_num: 20,
          width: 0.9,
          color: 'steelblue',
          stroke_color: 'black',
          stroke_width: 1,
          hover: true,
          tooltip: null,
          legend: true
      };
      if (arguments.length > 3) _.extend(options, _options);

      var df = Manager.getData(df_id);
      var model = parent.append("g");

      this.scales = scales;
      this.legends = [{
          label: options.title,
          color: options.color
      }];
      this.options = options;
      this.model = model;
      this.df = df;
      this.uuid = options.uuid;

      return this;
  }

  // fetch data and update dom object. called by pane which this chart belongs to.
  Histogram.prototype.update = function () {
      var column_value = this.df.columnWithFilters(this.uuid, this.options.value);
      var data = this.processData(column_value, this.options);

      var models = this.model.selectAll("rect").data(data);
      models.enter().append("rect").attr("height", 0).attr("y", this.scales.get(0, 0).y);
      this.updateModels(models, this.scales, this.options);
  };

  // pre-process data using function embeded in d3.js.
  Histogram.prototype.processData = function (column, options) {
      return d3.layout.histogram().bins(this.scales.raw.x.ticks(options.bin_num))(column);
  };

  // update SVG dom nodes based on pre-processed data.
  Histogram.prototype.updateModels = function (selector, scales, options) {
      var onMouse = function onMouse() {
          d3.select(this).transition().duration(200).attr("fill", d3.rgb(options.color).darker(1));
          var id = d3.select(this).attr("id");
          options.tooltip.addToYAxis(id, this.__data__.y, 3);
          options.tooltip.update();
      };

      var outMouse = function outMouse() {
          d3.select(this).transition().duration(200).attr("fill", options.color);
          var id = d3.select(this).attr("id");
          options.tooltip.reset();
      };

      selector.attr("x", function (d) {
          return scales.get(d.x, 0).x;
      }).attr("width", function (d) {
          return scales.get(d.dx, 0).x - scales.get(0, 0).x;
      }).attr("fill", options.color).attr("stroke", options.stroke_color).attr("stroke-width", options.stroke_width).transition().duration(200).attr("y", function (d) {
          return scales.get(0, d.y).y;
      }).attr("height", function (d) {
          return scales.get(0, 0).y - scales.get(0, d.y).y;
      }).attr("id", uuid.v4());

      if (options.hover) selector.on("mouseover", onMouse).on("mouseout", outMouse);
  };

  // return legend object.
  Histogram.prototype.getLegend = function () {
      var legend = new SimpleLegend(this.options.legend ? this.legend_data : {});
      return legend;
  };

  // answer to callback coming from filter.
  Histogram.prototype.checkSelectedData = function (ranges) {
      var label_value = this.options.value;
      var filter = function filter(row) {
          var val = row[label_value];
          if (val > ranges.x[0] && val < ranges.x[1]) return true;else return false;
      };
      this.df.addFilter(this.uuid, filter, ['self']);
      Manager.update();
  };

  function Scatter(parent, scales, df_id, _options) {
      var options = {
          title: 'scatter',
          x: null,
          y: null,
          fill_by: null,
          shape_by: null,
          size_by: null,
          color: ['#4682B4', '#000000'],
          shape: ['circle', 'triangle-up', 'diamond', 'square', 'triangle-down', 'cross'],
          size: [100, 1000],
          stroke_color: 'black',
          stroke_width: 1,
          hover: true,
          tooltip_contents: [],
          tooltip: null,
          legend: true
      };
      if (arguments.length > 3) _.extend(options, _options);

      this.scales = scales;
      var df = Manager.getData(df_id);
      var model = parent.append("g");

      this.legend_data = function (thisObj) {
          var on = function on() {
              thisObj.render = true;
              thisObj.update();
          };

          var off = function off() {
              thisObj.render = false;
              thisObj.update();
          };
          return [{
              label: options.title,
              color: options.color,
              on: on,
              off: off
          }];
      }(this);

      this.render = true;
      this.options = options;
      this.model = model;
      this.df = df;
      this.uuid = options.uuid;

      return this;
  }

  // fetch data and update dom object. called by pane which this chart belongs to.
  Scatter.prototype.update = function () {
      var data = this.processData(this.options);
      this.options.tooltip.reset();
      if (this.render) {
          var shapes = this.model.selectAll("path").data(data);
          shapes.enter().append("path");
          this.updateModels(shapes, this.scales, this.options);
      } else {
          this.model.selectAll("path").remove();
      }
  };

  // pre-process data like: [{x: 1, y: 2, fill: '#000', size: 20, shape: 'triangle-up'}, {},...,{}]
  Scatter.prototype.processData = function (options) {
      var df = this.df;
      var labels = ['x', 'y', 'fill', 'size', 'shape'];
      var columns = _.map(['x', 'y'], function (label) {
          return df.column(options[label]);
      });
      var length = columns[0].length;

      _.each([{
          column: 'fill_by',
          val: 'color'
      }, {
          column: 'size_by',
          val: 'size'
      }, {
          column: 'shape_by',
          val: 'shape'
      }], function (info) {
          if (options[info.column]) {
              var scale = df.scale(options[info.column], options[info.val]);
              columns.push(_.map(df.column(options[info.column]), function (val) {
                  return scale(val);
              }));
          } else {
              columns.push(_.map(_.range(1, length + 1, 1), function (d) {
                  if (_.isArray(options[info.val])) return options[info.val][0];else return options[info.val];
              }));
          }
      });
      /*
              this.optional_scales = _.reduce([{column: 'fill_by', val: 'color'}, {column: 'size_by', val: 'size'}, {column: 'shape_by', val: 'shape'}], function(memo, info){
                  if(options[info.column]){
                      var scale = df.scale(options[info.column], options[info.val]);
                      columns.push(_.map(df.column(options[info.column]), function(val){return scale(val);}));
                      memo[info.val] = scale;
                  }else{
                      columns.push(_.map(_.range(1, length+1, 1), function(d){
                          if(_.isArray(options[info.val]))return options[info.val][0];
                          else return options[info.val];
                      }));
                      memo[info.val] = d3.scale.ordinal().range(columns.last[0]);
                  }
              }, {});*/

      if (options.tooltip_contents.length > 0) {
          var tt_arr = df.getPartialDf(options.tooltip_contents);
          labels.push('tt');
          columns.push(tt_arr);
      }

      return _.map(_.zip.apply(null, columns), function (d) {
          return _.reduce(d, function (memo, val, i) {
              memo[labels[i]] = val;
              return memo;
          }, {});
      });
  };

  // update SVG dom nodes based on pre-processed data.
  Scatter.prototype.updateModels = function (selector, scales, options) {
      var id = this.uuid;

      var onMouse = function onMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d3.rgb(d.fill).darker(1);
          });
          options.tooltip.addToXAxis(id, this.__data__.x, 3);
          options.tooltip.addToYAxis(id, this.__data__.y, 3);
          if (options.tooltip_contents.length > 0) {
              options.tooltip.add(id, this.__data__.x, this.__data__.y, 'top', this.__data__.tt);
          }
          options.tooltip.update();
      };

      var outMouse = function outMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d.fill;
          });
          options.tooltip.reset();
      };

      selector.attr("transform", function (d) {
          return "translate(" + scales.get(d.x, d.y).x + "," + scales.get(d.x, d.y).y + ")";
      }).attr("fill", function (d) {
          return d.fill;
      }).attr("stroke", options.stroke_color).attr("stroke-width", options.stroke_width).transition().duration(200).attr("d", d3.svg.symbol().type(function (d) {
          return d.shape;
      }).size(function (d) {
          return d.size;
      }));

      if (options.hover) selector.on("mouseover", onMouse).on("mouseout", outMouse);
  };

  // return legend object.
  Scatter.prototype.getLegend = function () {
      /*
      var opt_data = this.optional_scales, color='';
      var defaults = _.map([{name: 'color', default: '#fff'}, {name: 'shape', default: 'shape'}, {name: 'size', default: 30}], function(info){
          if(opt_data[info.name].range().length == 1)return opt_data[info.name].range()[0];
          else return info.default;
      });
      // color
      switch(opt_data['color'].range().length){
       }
       // size
      */

      var legend = new SimpleLegend(this.options.legend ? this.legend_data : {});
      return legend;
  };

  // answer to callback coming from filter.
  Scatter.prototype.checkSelectedData = function (ranges) {
      return;
  };

  function Line(parent, scales, df_id, _options) {
      var options = {
          title: 'line',
          x: null,
          y: null,
          color: 'steelblue',
          fill_by: null,
          stroke_width: 2,
          legend: true
      };
      if (arguments.length > 3) _.extend(options, _options);

      this.scales = scales;
      var df = Manager.getData(df_id);
      var model = parent.append("g");

      this.legend_data = function (thisObj) {
          var on = function on() {
              thisObj.render = true;
              thisObj.update();
          };

          var off = function off() {
              thisObj.render = false;
              thisObj.update();
          };
          return [{
              label: options.title,
              color: options.color,
              on: on,
              off: off
          }];
      }(this);

      this.render = true;
      this.options = options;
      this.model = model;
      this.df = df;
      this.df_id = df_id;

      return this;
  }

  // fetch data and update dom object. called by pane which this chart belongs to.
  Line.prototype.update = function () {
      if (this.render) {
          var data = this.processData(this.df.column(this.options.x), this.df.column(this.options.y), this.options);
          this.model.selectAll("path").remove();
          var path = this.model.append("path").datum(data);

          this.updateModels(path, this.scales, this.options);
      } else {
          this.model.selectAll("path").remove();
      }
  };

  // pre-process data like: x: [1,3,..,3], y: [2,3,..,4] -> [{x: 1, y: 2}, ... ,{}]
  Line.prototype.processData = function (x_arr, y_arr, options) {
      var df = this.df,
          length = x_arr.length;
      /*
      var color_arr = (function(column, colors){
          if(options['fill_by']){
              var scale = df.scale(options[column], options[colors]);
              return _.map(df.column(options[column]), function(val){return scale(val);});
          }else{
              return _.map(_.range(1, length+1, 1), function(d){
                  if(_.isArray(options[colors]))return options[colors][0];
                  else return options[colors];
              });
          }
      })('fill_by', 'color');*/
      return _.map(_.zip(x_arr, y_arr), function (d) {
          return {
              x: d[0],
              y: d[1]
          };
      });
  };

  // update SVG dom nodes based on pre-processed data.
  Line.prototype.updateModels = function (selector, scales, options) {
      var onMouse = function onMouse() {
          d3.select(this).transition().duration(200).attr("fill", d3.rgb(options.color).darker(1));
      };

      var outMouse = function outMouse() {
          d3.select(this).transition().duration(200).attr("fill", options.color);
      };

      var line = d3.svg.line().x(function (d) {
          return scales.get(d.x, d.y).x;
      }).y(function (d) {
          return scales.get(d.x, d.y).y;
      });

      selector.attr("d", line).attr("stroke", options.color).attr("stroke-width", options.stroke_width).attr("fill", "none");
  };

  // return legend object.
  Line.prototype.getLegend = function () {
      var legend = new SimpleLegend(this.options.legend ? this.legend_data : []);
      return legend;
  };

  // answer to callback coming from filter.
  Line.prototype.checkSelectedData = function (ranges) {
      return;
  };

  var l_1 = 0.7;
  var l_2 = 1.5;
  var EPS = 1.0e-20;
  var count = 0;
  var COUNT_LIMIT = 2000;
  function calcCenter(vector) {
      var center = [];
      _.each(_.zip.apply(null, vector), function (arr, i) {
          center[i] = 0;
          _.each(arr, function (val) {
              center[i] += val;
          });
          center[i] = center[i] / arr.length;
      });
      return center;
  }

  function rec(params, func) {
      params = _.sortBy(params, function (p) {
          return func(p);
      });
      var n = params.length;
      var val_num = params[0].length;
      var p_h = params[n - 1];
      var p_g = params[n - 2];
      var p_l = params[0];
      var p_c = calcCenter(params.concat().splice(0, n - 1));
      var p_r = [];
      for (var i = 0; i < val_num; i++) {
          p_r[i] = 2 * p_c[i] - p_h[i];
      }if (func(p_r) >= func(p_h)) {
          // reduction
          for (var i = 0; i < val_num; i++) {
              params[n - 1][i] = (1 - l_1) * p_h[i] + l_1 * p_r[i];
          }
      } else if (func(p_r) < (func(p_l) + (l_2 - 1) * func(p_h)) / l_2) {
          // expand
          var p_e = [];
          for (var i = 0; i < val_num; i++) {
              p_e[i] = l_2 * p_r[i] - (l_2 - 1) * p_h[i];
          }if (func(p_e) <= func(p_r)) params[n - 1] = p_e;else params[n - 1] = p_r;
      } else {
          params[n - 1] = p_r;
      }

      if (func(params[n - 1]) >= func(p_g)) {
          // reduction all
          _.each(params, function (p, i) {
              for (var j = 0; j < val_num; j++) {
                  params[i][j] = 0.5 * (p[j] + p_l[j]);
              }
          });
      }
      var sum = 0;
      _.each(params, function (p) {
          sum += Math.pow(func(p) - func(p_l), 2);
      });

      if (sum < EPS) return params[n - 1];else {
          count++;
          if (count > COUNT_LIMIT) return params[n - 1];
          return rec(params, func);
      }
  }

  function simplex(params, func) {
      var k = 1;
      var n = params.length;
      var p_default = [params];
      _.each(_.range(n), function (i) {
          var p = params.concat();
          p[i] += k;
          p_default.push(p);
      });
      return rec(p_default, func);
  }

  function Venn(parent, scales, df_id, _options) {
      var options = {
          category: null,
          count: null,
          color: null,
          stroke_color: '#000',
          stroke_width: 1,
          opacity: 0.7,
          hover: false,
          area_names: ['VENN1', 'VENN2', 'VENN3'],
          filter_control: false
      };
      if (arguments.length > 3) _.extend(options, _options);

      var df = Manager.getData(df_id);
      var model = parent.append("g");

      var column_category = df.column(options.category);
      var categories = _.uniq(column_category);
      var color_scale;

      if (options.color == null) color_scale = d3.scale.category20().domain(options.area_names);else color_scale = d3.scale.ordinal().range(options.color).domain(options.area_names);
      this.color_scale = color_scale;

      var legend_data = [];
      var selected_category = [[categories[0]], [categories[1]], [categories[2]]];

      var update = this.update,
          tellUpdate = this.tellUpdate;
      var thisObj = this;

      for (var i = 0; i < 3; i++) {
          var entry = [];
          entry.push({
              label: options.area_names[i],
              color: color_scale(options.area_names[i])
          });
          _.each(categories, function (category) {
              var venn_id = i;
              var on = function on() {
                  selected_category[venn_id].push(category);
                  update.call(thisObj);
                  tellUpdate.call(thisObj);
              };
              var off = function off() {
                  var pos = selected_category[venn_id].indexOf(category);
                  selected_category[venn_id].splice(pos, 1);
                  update.call(thisObj);
                  tellUpdate.call(thisObj);
              };
              var mode = category == selected_category[i] ? 'on' : 'off';
              entry.push({
                  label: category,
                  color: 'black',
                  mode: mode,
                  on: on,
                  off: off
              });
          });
          legend_data.push(new SimpleLegend(entry));
      }

      var filter_mode = 'all';
      if (options.filter_control) {
          var entry = [];
          var modes = ['all', 'overlapping', 'non-overlapping'];
          var default_mode = filter_mode;

          entry.push({
              label: 'Filter',
              color: 'gray'
          });
          _.each(modes, function (mode) {
              var on = function on() {
                  thisObj.filter_mode = mode;
                  update.call(thisObj);
                  tellUpdate.call(thisObj);
              };
              var on_off = mode == default_mode ? 'on' : 'off';
              entry.push({
                  label: mode,
                  color: 'black',
                  on: on,
                  off: function off() {},
                  mode: on_off
              });
          });
          legend_data.push(new SimpleLegend(entry, {
              mode: 'radio'
          }));
      }

      this.selected_category = selected_category;
      this.filter_mode = filter_mode;
      this.legend_data = legend_data;
      this.options = options;
      this.scales = scales;
      this.model = model;
      this.df_id = df_id;
      this.df = df;
      this.uuid = options.uuid;

      this.tellUpdate();

      return this;
  }

  // X->x, Y->y scales given by pane is useless when creating venn diagram, so create new scale consists of x, y, and r.
  Venn.prototype.getScales = function (data, scales) {
      var r_w = _.max(scales.range().x) - _.min(scales.range().x);
      var r_h = _.max(scales.range().y) - _.min(scales.range().y);
      var d_x = {
          min: function () {
              var min_d = _.min(data.pos, function (d) {
                  return d.x - d.r;
              });
              return min_d.x - min_d.r;
          }(),
          max: function () {
              var max_d = _.max(data.pos, function (d) {
                  return d.x + d.r;
              });
              return max_d.x + max_d.r;
          }()
      };
      var d_y = {
          min: function () {
              var min_d = _.min(data.pos, function (d) {
                  return d.y - d.r;
              });
              return min_d.y - min_d.r;
          }(),
          max: function () {
              var max_d = _.max(data.pos, function (d) {
                  return d.y + d.r;
              });
              return max_d.y + max_d.r;
          }()
      };
      var d_w = d_x.max - d_x.min;
      var d_h = d_y.max - d_y.min;

      var scale = 0;
      if (r_w / r_h > d_w / d_h) {
          scale = d_h / r_h;
          var new_d_w = scale * r_w;
          d_x.min -= (new_d_w - d_w) / 2;
          d_x.max += (new_d_w - d_w) / 2;
      } else {
          scale = d_w / r_w;
          var new_d_h = scale * r_h;
          d_h.min -= (new_d_h - d_h) / 2;
          d_h.max += (new_d_h - d_h) / 2;
      }
      var new_scales = {};
      new_scales.x = d3.scale.linear().range(scales.range().x).domain([d_x.min, d_x.max]);
      new_scales.y = d3.scale.linear().range(scales.range().y).domain([d_y.min, d_y.max]);
      new_scales.r = d3.scale.linear().range([0, 100]).domain([0, 100 * scale]);
      return new_scales;
  };

  // fetch data and update dom objects.
  Venn.prototype.update = function () {
      var column_count = this.df.columnWithFilters(this.uuid, this.options.count);
      var column_category = this.df.columnWithFilters(this.uuid, this.options.category);

      var data = this.processData(column_category, column_count, this.selected_category);
      var scales = this.getScales(data, this.scales);
      var circles = this.model.selectAll("circle").data(data.pos);
      var texts = this.model.selectAll("text").data(data.labels);

      if (circles[0][0] == undefined) circles = circles.enter().append("circle");
      if (texts[0][0] == undefined) texts = texts.enter().append("text");

      this.counted_items = data.counted_items;
      this.updateModels(circles, scales, this.options);
      this.updateLabels(texts, scales, this.options);
  };

  // Calculate overlapping areas at first, and then decide center point of each circle with simplex module.
  Venn.prototype.processData = function (category_column, count_column, selected_category) {
      // decide overlapping areas
      var items = function () {
          var table = [];
          var counted_items = function () {
              var hash = {};
              _.each(_.zip(category_column, count_column), function (arr) {
                  if (hash[arr[1]] == undefined) hash[arr[1]] = {};
                  _.each(selected_category, function (category, i) {
                      if (category.indexOf(arr[0]) != -1) hash[arr[1]][i] = true;
                  });
              });
              return hash;
          }();

          var count_common = function count_common(items) {
              var cnt = 0;
              _.each(_.values(counted_items), function (values, key) {
                  if (!_.some(items, function (item) {
                      return !(item in values);
                  })) cnt++;
              });
              return cnt;
          };

          for (var i = 0; i < 3; i++) {
              table[i] = [];
              table[i][i] = count_common([i]);
              for (var j = i + 1; j < 3; j++) {
                  var num = count_common([i, j]);
                  table[i][j] = num;
              }
          }
          return {
              table: table,
              counted_items: counted_items
          };
      }();
      var table = items.table;
      var counted_items = items.counted_items;

      // decide radius of each circle
      var r = _.map(table, function (row, i) {
          return Math.sqrt(table[i][i] / (2 * Math.PI));
      });

      // function for minimizing loss of overlapping (values: x1,y1,x1,y1...)
      var evaluation = function evaluation(values) {
          var loss = 0;
          for (var i = 0; i < values.length; i += 2) {
              for (var j = i + 2; j < values.length; j += 2) {
                  var x1 = values[i],
                      y1 = values[i + 1],
                      x2 = values[j],
                      y2 = values[j + 1];
                  var r1 = r[i / 2],
                      r2 = r[j / 2];
                  var d = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
                  var S = 0;
                  if (d > r1 + r2) S = 0;else {
                      _.each([[r1, r2], [r2, r1]], function (r_arr) {
                          var theta = Math.acos((r_arr[1] * r_arr[1] - r_arr[0] * r_arr[0] + d * d) / (2 * r_arr[1] * d));
                          var s = r_arr[i] * r_arr[i] * theta - 1 / 2 * r_arr[1] * r_arr[1] * Math.sin(theta * 2);
                          S += s;
                      });
                  }
                  loss += Math.pow(table[i / 2][j / 2] - S, 2);
              }
          }
          return loss;
      };

      // decide initial paramaters
      var init_params = function () {
          var params = [];
          var set_num = table[0].length;
          var max_area = _.max(table, function (arr, i) {
              // calc the sum of overlapping area
              var result = 0;
              for (var j = 0; j < i; j++) {
                  result += table[j][i];
              }for (var j = i + 1; j < arr.length; j++) {
                  result += table[i][j];
              }return result;
          });
          var center_i = set_num - max_area.length;
          params[center_i * 2] = 0; // x
          params[center_i * 2 + 1] = 0; // y
          var rad = 0,
              rad_interval = Math.PI / (1.5 * (set_num - 1));
          for (var i = 0; i < set_num; i++) {
              if (i != center_i) {
                  var d = r[center_i] + r[i] / 2;
                  params[i * 2] = d * Math.sin(rad);
                  params[i * 2 + 1] = d * Math.cos(rad);
                  rad += rad_interval;
              }
          }
          return params;
      }();

      // decide coordinates using Simplex method
      var params = simplex(init_params, evaluation);
      var pos = [],
          labels = [];
      for (var i = 0; i < params.length; i += 2) {
          pos.push({
              x: params[i],
              y: params[i + 1],
              r: r[i / 2],
              id: i
          });
      }for (var i = 0; i < 3; i++) {
          labels.push({
              x: params[i * 2],
              y: params[i * 2 + 1],
              val: table[i][i]
          });
          for (var j = i + 1; j < 3; j++) {
              var x = (params[i * 2] + params[j * 2]) / 2;
              var y = (params[i * 2 + 1] + params[j * 2 + 1]) / 2;
              labels.push({
                  x: x,
                  y: y,
                  val: table[i][j]
              });
          }
      }

      return {
          pos: pos,
          labels: labels,
          counted_items: counted_items
      };
  };

  // update dom objects according to pre-processed data.
  Venn.prototype.updateModels = function (selector, scales, options) {
      var color_scale = this.color_scale;
      var area_names = this.options.area_names;

      selector.attr("cx", function (d) {
          return scales.x(d.x);
      }).attr("cy", function (d) {
          return scales.y(d.y);
      }).attr("stroke", options.stroke_color).attr("stroke-width", options.stroke_width).attr("fill", function (d) {
          return color_scale(area_names[d.id]);
      }).attr("fill-opacity", options.opacity).transition().duration(500).attr("r", function (d) {
          return scales.r(d.r);
      });

      if (options.hover) {
          var onMouse = function onMouse() {
              d3.select(this).transition().duration(200).attr("fill", function (d) {
                  return d3.rgb(color_scale(area_names[d.id])).darker(1);
              });
          };

          var outMouse = function outMouse() {
              d3.select(this).transition().duration(200).attr("fill", function (d) {
                  return color_scale(area_names[d.id]);
              });
          };

          selector.on("mouseover", onMouse).on("mouseout", outMouse);
      }
  };

  // update labels placed the center point between each pair of circle.
  Venn.prototype.updateLabels = function (selector, scales, options) {
      selector.attr("x", function (d) {
          return scales.x(d.x);
      }).attr("y", function (d) {
          return scales.y(d.y);
      }).attr("text-anchor", "middle").text(function (d) {
          return String(d.val);
      });
  };

  // return legend object.
  Venn.prototype.getLegend = function () {
      return this.legend_data;
  };

  // tell update to Manager when venn recieved change from filter controller.
  Venn.prototype.tellUpdate = function () {
      var rows = [],
          selected_category = this.selected_category;
      var counted_items = this.counted_items;
      var filter_mode = this.filter_mode;
      var category_num = this.options.category;
      var count_num = this.options.count;
      var filter = {
          'all': function all(row) {
              // check if this row in in any area (VENN1, VENN2, VENN3,...)
              return _.some(selected_category, function (categories) {
                  if (categories.indexOf(row[category_num]) != -1) return true;else return false;
              });
          },
          'overlapping': function overlapping(row) {
              if (!_.some(selected_category, function (categories) {
                  if (categories.indexOf(row[category_num]) != -1) return true;else return false;
              })) return false;

              for (var i = 0; i < 3; i++) {
                  for (var j = i + 1; j < 3; j++) {
                      if (counted_items[row[count_num]][i] && counted_items[row[count_num]][j]) return true;
                  }
              }
              return false;
          },
          'non-overlapping': function nonOverlapping(row) {
              if (!_.some(selected_category, function (categories) {
                  if (categories.indexOf(row[category_num]) != -1) return true;else return false;
              })) return false;

              for (var i = 0; i < 3; i++) {
                  for (var j = i + 1; j < 3; j++) {
                      if (counted_items[row[count_num]][i] && counted_items[row[count_num]][j]) return false;
                  }
              }
              return true;
          }
      }[filter_mode];
      this.df.addFilter(this.uuid, filter, ['self']);
      Manager.update();
  };

  function Venn$1(parent, scales, df_id, _options) {
      var options = {
          category: null,
          count: null,
          color: null,
          stroke_color: '#000',
          stroke_width: 1,
          opacity: 0.7,
          hover: false
      };
      if (arguments.length > 3) _.extend(options, _options);

      this.getScales = function (data, scales) {
          var r_w = _.max(scales.x.range()) - _.min(scales.x.range());
          var r_h = _.max(scales.y.range()) - _.min(scales.y.range());
          var d_x = {
              min: function () {
                  var min_d = _.min(data.pos, function (d) {
                      return d.x - d.r;
                  });
                  return min_d.x - min_d.r;
              }(),
              max: function () {
                  var max_d = _.max(data.pos, function (d) {
                      return d.x + d.r;
                  });
                  return max_d.x + max_d.r;
              }()
          };
          var d_y = {
              min: function () {
                  var min_d = _.min(data.pos, function (d) {
                      return d.y - d.r;
                  });
                  return min_d.y - min_d.r;
              }(),
              max: function () {
                  var max_d = _.max(data.pos, function (d) {
                      return d.y + d.r;
                  });
                  return max_d.y + max_d.r;
              }()
          };
          var d_w = d_x.max - d_x.min;
          var d_h = d_y.max - d_y.min;

          var scale = 0;
          if (r_w / r_h > d_w / d_h) {
              scale = d_h / r_h;
              var new_d_w = scale * r_w;
              d_x.min -= (new_d_w - d_w) / 2;
              d_x.max += (new_d_w - d_w) / 2;
          } else {
              scale = d_w / r_w;
              var new_d_h = scale * r_h;
              d_h.min -= (new_d_h - d_h) / 2;
              d_h.max += (new_d_h - d_h) / 2;
          }
          var new_scales = {};
          new_scales.x = d3.scale.linear().range(scales.x.range()).domain([d_x.min, d_x.max]);
          new_scales.y = d3.scale.linear().range(scales.y.range()).domain([d_y.min, d_y.max]);
          new_scales.r = d3.scale.linear().range([0, 100]).domain([0, 100 * scale]);
          return new_scales;
      };

      var df = Manager.getData(df_id);
      var data = this.processData(df.column(options.category), df.column(options.count));
      var new_scales = this.getScales(data, scales);

      var model = parent.append("g");

      var circles = model.selectAll("circle").data(data.pos).enter().append("circle");

      var texts = model.selectAll("text").data(data.labels).enter().append("text");

      if (options.color == null) this.color_scale = d3.scale.category20();else this.color_scale = d3.scale.ordinal().range(options.color);
      var color_scale = this.color_scale;

      this.updateModels(circles, new_scales, options);
      this.updateLabels(texts, new_scales, options);

      var legends = [];
      _.each(data.pos, function (d) {
          legends.push({
              label: d.name,
              color: color_scale(d.name)
          });
      });

      this.legends = legends;
      this.scales = scales;
      this.options = options;
      this.model = model;
      this.df = df;
      this.df_id = df_id;

      return this;
  }

  Venn$1.prototype.processData = function (category_column, count_column) {
      var categories = _.uniq(category_column);

      // decide overlapping areas
      var table = function () {
          var table = [];
          var counted_items = function () {
              var hash = {};
              _.each(_.zip(category_column, count_column), function (arr) {
                  if (hash[arr[1]] == undefined) hash[arr[1]] = {};
                  hash[arr[1]][arr[0]] = true;
              });
              return _.values(hash);
          }();

          var count_common = function count_common(items) {
              var cnt = 0;
              _.each(counted_items, function (values, key) {
                  if (!_.some(items, function (item) {
                      return !(item in values);
                  })) cnt++;
              });
              return cnt;
          };

          for (var i = 0; i < categories.length; i++) {
              table[i] = [];
              table[i][i] = count_common([categories[i]]);
              for (var j = i + 1; j < categories.length; j++) {
                  var num = count_common([categories[i], categories[j]]);
                  table[i][j] = num;
              }
          }
          return table;
      }();

      // decide radius of each circle
      var r = _.map(table, function (row, i) {
          return Math.sqrt(table[i][i] / (2 * Math.PI));
      });

      // function for minimizing loss of overlapping (values: x1,y1,x1,y1...)
      var evaluation = function evaluation(values) {
          var loss = 0;
          for (var i = 0; i < values.length; i += 2) {
              for (var j = i + 2; j < values.length; j += 2) {
                  var x1 = values[i],
                      y1 = values[i + 1],
                      x2 = values[j],
                      y2 = values[j + 1];
                  var r1 = r[i / 2],
                      r2 = r[j / 2];
                  var d = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
                  var S = 0;
                  if (d > r1 + r2) S = 0;else {
                      _.each([[r1, r2], [r2, r1]], function (r_arr) {
                          var theta = Math.acos((r_arr[1] * r_arr[1] - r_arr[0] * r_arr[0] + d * d) / (2 * r_arr[1] * d));
                          var s = r_arr[i] * r_arr[i] * theta - 1 / 2 * r_arr[1] * r_arr[1] * Math.sin(theta * 2);
                          S += s;
                      });
                  }
                  loss += Math.pow(table[i / 2][j / 2] - S, 2);
              }
          }
          return loss;
      };

      // decide initial paramaters
      var init_params = function () {
          var params = [];
          var set_num = table[0].length;
          var max_area = _.max(table, function (arr, i) {
              // calc the sum of overlapping area
              var result = 0;
              for (var j = 0; j < i; j++) {
                  result += table[j][i];
              }for (var j = i + 1; j < arr.length; j++) {
                  result += table[i][j];
              }return result;
          });
          var center_i = set_num - max_area.length;
          params[center_i * 2] = 0; // x
          params[center_i * 2 + 1] = 0; // y
          var rad = 0,
              rad_interval = Math.PI / (1.5 * (set_num - 1));
          for (var i = 0; i < set_num; i++) {
              if (i != center_i) {
                  var d = r[center_i] + r[i] / 2;
                  params[i * 2] = d * Math.sin(rad);
                  params[i * 2 + 1] = d * Math.cos(rad);
                  rad += rad_interval;
              }
          }
          return params;
      }();

      // decide coordinates using Simplex method
      var params = simplex(init_params, evaluation);
      var pos = [],
          labels = [];
      for (var i = 0; i < params.length; i += 2) {
          pos.push({
              x: params[i],
              y: params[i + 1],
              r: r[i / 2],
              name: categories[i / 2]
          });
      }for (var i = 0; i < categories.length; i++) {
          labels.push({
              x: params[i * 2],
              y: params[i * 2 + 1],
              val: table[i][i]
          });
          for (var j = i + 1; j < categories.length; j++) {
              var x = (params[i * 2] + params[j * 2]) / 2;
              var y = (params[i * 2 + 1] + params[j * 2 + 1]) / 2;
              labels.push({
                  x: x,
                  y: y,
                  val: table[i][j]
              });
          }
      }

      return {
          pos: pos,
          labels: labels
      };
  };

  Venn$1.prototype.updateModels = function (selector, scales, options) {
      var color_scale = this.color_scale;
      var onMouse = function onMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d3.rgb(color_scale(d.name)).darker(1);
          });
      };

      var outMouse = function outMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return color_scale(d.name);
          });
      };

      selector.attr("cx", function (d) {
          return scales.x(d.x);
      }).attr("cy", function (d) {
          return scales.y(d.y);
      }).attr("stroke", options.stroke_color).attr("stroke-width", options.stroke_width).attr("fill", function (d) {
          return color_scale(d.name);
      }).attr("fill-opacity", options.opacity).transition().duration(500).attr("r", function (d) {
          return scales.r(d.r);
      });

      if (options.hover) selector.on("mouseover", onMouse).on("mouseout", outMouse);
  };

  Venn$1.prototype.updateLabels = function (selector, scales, options) {
      selector.attr("x", function (d) {
          return scales.x(d.x);
      }).attr("y", function (d) {
          return scales.y(d.y);
      }).attr("text-anchor", "middle").text(function (d) {
          return String(d.val);
      });
  };

  Venn$1.prototype.selected = function (data, row_nums) {
      var selected_count = this.df.pickUpCells(this.options.count, row_nums);
      var selected_category = this.df.pickUpCells(this.options.category, row_nums);
      var data = this.processData(selected_category, selected_count, this.options);
      var scales = this.getScales(data, this.scales);

      var circles = this.model.selectAll("circle").data(data.pos);
      var texts = this.model.selectAll("text").data(data.labels);
      this.updateModels(circles, scales, this.options);
      this.updateLabels(texts, scales, this.options);
  };

  Venn$1.prototype.update = function () {};

  Venn$1.prototype.checkSelectedData = function (ranges) {};

  function Box(parent, scales, df_id, _options) {
      var options = {
          title: '',
          value: [],
          width: 0.9,
          color: null,
          stroke_color: 'black',
          stroke_width: 1,
          outlier_r: 3,
          tooltip_contents: [],
          tooltip: null
      };
      if (arguments.length > 3) _.extend(options, _options);

      var model = parent.append("g");
      var df = Manager.getData(df_id);

      var color_scale;
      if (options.color == null) {
          color_scale = d3.scale.category20b();
      } else {
          color_scale = d3.scale.ordinal().range(options.color);
      }

      this.model = model;
      this.scales = scales;
      this.options = options;
      this.df = df;
      this.color_scale = color_scale;
      this.uuid = options.uuid;

      return this;
  }

  // fetch data and update dom object. called by pane which this chart belongs to.
  Box.prototype.update = function () {
      var uuid = this.uuid;
      var processData = this.processData;
      var df = this.df;
      var data = [];
      _.each(this.options.value, function (column_name) {
          var column = df.columnWithFilters(uuid, column_name);
          data.push(_.extend(processData(column), {
              x: column_name
          }));
      });

      var boxes = this.model.selectAll("g").data(data);
      boxes.enter().append("g");

      this.updateModels(boxes, this.scales, this.options);
  };

  // convert raw data into style information for box
  Box.prototype.processData = function (column) {
      var getMed = function getMed(arr) {
          var n = arr.length;
          return n % 2 == 1 ? arr[Math.floor(n / 2)] : (arr[n / 2] + arr[n / 2 + 1]) / 2;
      };

      var arr = _.sortBy(column);
      var med = getMed(arr);
      var q1 = getMed(arr.slice(0, arr.length / 2 - 1));
      var q3 = getMed(arr.slice(arr.length % 2 == 0 ? arr.length / 2 : arr.length / 2 + 1, arr.length - 1));
      var h = q3 - q1;
      var max = _.max(arr) - q3 > 1.5 * h ? q3 + 1.5 * h : _.max(arr);
      var min = q1 - _.min(arr) > 1.5 * h ? q1 - 1.5 * h : _.min(arr);
      var outlier = _.filter(arr, function (d) {
          return d > max || d < min;
      });

      return {
          med: med,
          q1: q1,
          q3: q3,
          max: max,
          min: min,
          outlier: outlier
      };
  };

  // update SVG dom nodes based on data
  Box.prototype.updateModels = function (selector, scales, options) {
      var width = scales.raw.x.rangeBand() * options.width;
      var padding = scales.raw.x.rangeBand() * ((1 - options.width) / 2);
      var color_scale = this.color_scale;

      var onMouse = function onMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d3.rgb(color_scale(d.x)).darker(1);
          });
          var id = d3.select(this).attr("id");

          options.tooltip.addToYAxis(id, this.__data__.min, 3);
          options.tooltip.addToYAxis(id, this.__data__.q1, 3);
          options.tooltip.addToYAxis(id, this.__data__.med, 3);
          options.tooltip.addToYAxis(id, this.__data__.q3, 3);
          options.tooltip.addToYAxis(id, this.__data__.max, 3);
          options.tooltip.update();
      };

      var outMouse = function outMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d3.rgb(color_scale(d.x));
          });
          var id = d3.select(this).attr("id");
          options.tooltip.reset();
      };

      selector.append("line").attr("x1", function (d) {
          return scales.get(d.x, 0).x + width / 2 + padding;
      }).attr("y1", function (d) {
          return scales.get(d.x, d.max).y;
      }).attr("x2", function (d) {
          return scales.get(d.x, 0).x + width / 2 + padding;
      }).attr("y2", function (d) {
          return scales.get(d.x, d.min).y;
      }).attr("stroke", options.stroke_color);

      selector.append("rect").attr("x", function (d) {
          return scales.get(d.x, 0).x + padding;
      }).attr("y", function (d) {
          return scales.get(d.x, d.q3).y;
      }).attr("height", function (d) {
          return scales.get(d.x, d.q1).y - scales.get(d.x, d.q3).y;
      }).attr("width", width).attr("fill", function (d) {
          return color_scale(d.x);
      }).attr("stroke", options.stroke_color).attr("id", uuid.v4()).on("mouseover", onMouse).on("mouseout", outMouse);

      // median line
      selector.append("line").attr("x1", function (d) {
          return scales.get(d.x, 0).x + padding;
      }).attr("y1", function (d) {
          return scales.get(d.x, d.med).y;
      }).attr("x2", function (d) {
          return scales.get(d.x, 0).x + width + padding;
      }).attr("y2", function (d) {
          return scales.get(d.x, d.med).y;
      }).attr("stroke", options.stroke_color);

      selector.append("g").each(function (d, i) {
          d3.select(this).selectAll("circle").data(d.outlier).enter().append("circle").attr("cx", function (d1) {
              return scales.get(d.x, 0).x + width / 2 + padding;
          }).attr("cy", function (d1) {
              return scales.get(d.x, d1).y;
          }).attr("r", options.outlier_r);
      });
  };

  // return legend object based on data prepared by initializer
  Box.prototype.getLegend = function () {
      return new SimpleLegend(this.legend_data);
  };

  // answer to callback coming from filter. not implemented yet.
  Box.prototype.checkSelectedData = function (ranges) {
      return;
  };

  function ColorBar(color_scale, _options) {
      var options = {
          width: 150,
          height: 200
      };
      if (arguments.length > 1) _.extend(options, _options);

      this.options = options;
      this.model = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "g"));
      this.color_scale = color_scale;
  }

  ColorBar.prototype.width = function () {
      return this.options.width;
  };

  ColorBar.prototype.height = function () {
      return this.options.height;
  };

  // Create dom object independent form pane or context and return it. called by each diagram.o
  ColorBar.prototype.getDomObject = function () {
      var model = this.model;
      var color_scale = this.color_scale;
      var colors = color_scale.range();
      var values = color_scale.domain();

      var height_scale = d3.scale.linear().domain(d3.extent(values)).range([this.options.height, 0]);

      var gradient = model.append("svg:defs").append("svg:linearGradient").attr("id", "gradient").attr("x1", "0%").attr("x2", "0%").attr("y1", "100%").attr("y2", "0%");

      for (var i = 0; i < colors.length; i++) {
          gradient.append("svg:stop").attr("offset", 100 / (colors.length - 1) * i + "%").attr("stop-color", colors[i]);
      }

      var group = model.append("g");

      group.append("svg:rect").attr("y", 10).attr("width", "25").attr("height", this.options.height).style("fill", "url(#gradient)");

      model.append("g").attr("width", "100").attr("height", this.options.height).attr("class", "axis").attr("transform", "translate(25,10)").call(d3.svg.axis().scale(height_scale).orient("right").ticks(5));

      model.selectAll(".axis").selectAll("path").style("fill", "none").style("stroke", "black").style("shape-rendering", "crispEdges");

      model.selectAll(".axis").selectAll("line").style("fill", "none").style("stroke", "black").style("shape-rendering", "crispEdges");

      model.selectAll(".axis").selectAll("text").style("font-family", "san-serif").style("font-size", "11px");

      return model;
  };

  function colorset(name, num) {
      if (arguments.length > 1) return colorbrewer[name][num];
      var nums = _.map(_.keys(colorbrewer[name]), function (key) {
          return _.isFinite(key) ? Number(key) : 0;
      });
      var max_num = _.max(nums);
      return colorbrewer[name][String(max_num)];
  }

  function HeatMap(parent, scales, df_id, _options) {
      var options = {
          title: 'heatmap',
          x: null,
          y: null,
          fill: null,
          width: 1.0,
          height: 1.0,
          color: colorset("RdBu").reverse(),
          stroke_color: "#fff",
          stroke_width: 1,
          hover: true,
          tooltip: null
      };
      if (arguments.length > 3) _.extend(options, _options);

      var df = Manager.getData(df_id);
      var model = parent.append("g");

      this.color_scale = function () {
          var column_fill = df.columnWithFilters(options.uuid, options.fill);
          var min_max = d3.extent(column_fill);
          var domain = d3.range(min_max[0], min_max[1], (min_max[1] - min_max[0]) / options.color.length);
          return d3.scale.linear().range(options.color).domain(domain);
      }();

      this.scales = scales;
      this.options = options;
      this.model = model;
      this.df = df;
      this.uuid = options.uuid;
      return this;
  };

  // fetch data and update dom object. called by pane which this chart belongs to.
  HeatMap.prototype.update = function () {
      var data = this.processData();
      var models = this.model.selectAll("rect").data(data);
      models.each(function () {
          var event = document.createEvent("MouseEvents");
          event.initEvent("mouseout", false, true);
          this.dispatchEvent(event);
      });
      models.enter().append("rect");
      this.updateModels(models, this.options);
  };

  // pre-process data. convert data coorinates to dom coordinates with Scale.
  HeatMap.prototype.processData = function () {
      var column_x = this.df.columnWithFilters(this.uuid, this.options.x);
      var column_y = this.df.columnWithFilters(this.uuid, this.options.y);
      var column_fill = this.df.columnWithFilters(this.uuid, this.options.fill);
      var scales = this.scales;
      var options = this.options;
      var color_scale = this.color_scale;

      return _.map(_.zip(column_x, column_y, column_fill), function (row) {
          var x, y, width, height;
          width = Math.abs(scales.get(options.width, 0).x - scales.get(0, 0).x);
          height = Math.abs(scales.get(0, options.height).y - scales.get(0, 0).y);
          x = scales.get(row[0], 0).x - width / 2;
          y = scales.get(0, row[1]).y - height / 2;
          return {
              x: x,
              y: y,
              width: width,
              height: height,
              fill: color_scale(row[2]),
              x_raw: row[0],
              y_raw: row[1]
          };
      });
  };

  // update SVG dom nodes based on pre-processed data.
  HeatMap.prototype.updateModels = function (selector, options) {
      var id = this.uuid;
      var onMouse = function onMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d3.rgb(d.fill).darker(1);
          });
          options.tooltip.addToXAxis(id, this.__data__.x_raw, 3);
          options.tooltip.addToYAxis(id, this.__data__.y_raw, 3);
          options.tooltip.update();
      };

      var outMouse = function outMouse() {
          d3.select(this).transition().duration(200).attr("fill", function (d) {
              return d.fill;
          });
          options.tooltip.reset();
      };

      selector.attr("x", function (d) {
          return d.x;
      }).attr("width", function (d) {
          return d.width;
      }).attr("y", function (d) {
          return d.y;
      }).attr("height", function (d) {
          return d.height;
      }).attr("fill", function (d) {
          return d.fill;
      }).attr("stroke", options.stroke_color).attr("stroke-width", options.stroke_width);

      if (options.hover) selector.on("mouseover", onMouse).on("mouseout", outMouse);
  };

  // return legend object.
  HeatMap.prototype.getLegend = function () {
      return new ColorBar(this.color_scale);
  };

  // answer to callback coming from filter. not implemented yet.
  HeatMap.prototype.checkSelectedData = function (ranges) {
      return;
  };

  function Vectors(parent, scales, df_id, _options) {
      var options = {
          title: 'vectors',
          x: null,
          y: null,
          dx: null,
          dy: null,
          fill_by: null,
          color: ['steelblue', '#000000'],
          stroke_color: '#000',
          stroke_width: 2,
          hover: true,
          tooltip: null
      };
      if (arguments.length > 3) _.extend(options, _options);

      this.scales = scales;
      var df = Manager.getData(df_id);
      var model = parent.append("g");

      this.legend_data = function (thisObj) {
          var on = function on() {
              thisObj.render = true;
              thisObj.update();
          };

          var off = function off() {
              thisObj.render = false;
              thisObj.update();
          };
          return [{
              label: options.title,
              color: options.color,
              on: on,
              off: off
          }];
      }(this);

      this.render = true;
      this.options = options;
      this.model = model;
      this.df = df;
      this.uuid = options.uuid;

      return this;
  }

  // fetch data and update dom object. called by pane which this chart belongs to.
  Vectors.prototype.update = function () {
      var data = this.processData(this.options);
      this.options.tooltip.reset();
      if (this.render) {
          var shapes = this.model.selectAll("line").data(data);
          shapes.enter().append("line");
          this.updateModels(shapes, this.scales, this.options);
      } else {
          this.model.selectAll("line").remove();
      }
  };

  // pre-process data like: [{x: 1, y: 2, dx: 0.1, dy: 0.2, fill:'#000'}, {},...,{}]
  Vectors.prototype.processData = function (options) {
      var df = this.df;
      var labels = ['x', 'y', 'dx', 'dy', 'fill'];
      var columns = _.map(['x', 'y', 'dx', 'dy'], function (label) {
          return df.column(options[label]);
      });
      var length = columns[0].length;

      _.each([{
          column: 'fill_by',
          val: 'color'
      }], function (info) {
          if (options[info.column]) {
              var scale = df.scale(options[info.column], options[info.val]);
              columns.push(_.map(df.column(options[info.column]), function (val) {
                  return scale(val);
              }));
          } else {
              columns.push(_.map(_.range(1, length + 1, 1), function (d) {
                  if (_.isArray(options[info.val])) return options[info.val][0];else return options[info.val];
              }));
          }
      });

      return _.map(_.zip.apply(null, columns), function (d) {
          return _.reduce(d, function (memo, val, i) {
              memo[labels[i]] = val;
              return memo;
          }, {});
      });
  };

  // update SVG dom nodes based on pre-processed data.
  Vectors.prototype.updateModels = function (selector, scales, options) {
      selector.attr({
          'x1': function x1(d) {
              return scales.get(d.x, d.y).x;
          },
          'x2': function x2(d) {
              return scales.get(d.x + d.dx, d.y + d.dy).x;
          },
          'y1': function y1(d) {
              return scales.get(d.x, d.y).y;
          },
          'y2': function y2(d) {
              return scales.get(d.x + d.dx, d.y + d.dy).y;
          },
          'stroke': function stroke(d) {
              return d.fill;
          },
          'stroke-width': options.stroke_width
      });
  };

  // return legend object.
  Vectors.prototype.getLegend = function () {
      return new SimpleLegend(this.legend_data);
  };

  // answer to callback coming from filter.
  Vectors.prototype.checkSelectedData = function (ranges) {
      return;
  };

  var diagrams = {};

  diagrams.bar = Bar;
  diagrams.histogram = Histogram;
  diagrams.scatter = Scatter;
  diagrams.line = Line;
  diagrams.venn = Venn;
  diagrams.multiple_venn = Venn$1;
  diagrams.box = Box;
  diagrams.heatmap = HeatMap;
  diagrams.vectors = Vectors;

  // Add diagrams. Called by other extensions
  diagrams.add = function (name, diagram) {
    diagrams[name] = diagram;
  };

  function LegendArea(parent, _options) {
      var options = {
          width: 200,
          height: 300,
          margin: {
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
          },
          fill_color: 'none',
          stroke_color: '#000',
          stroke_width: 0
      };
      if (arguments.length > 1) _.extend(options, _options);

      var model = parent.append("g");

      model.append("rect").attr("width", options.width).attr("height", options.height).attr("x", 0).attr("y", 0).attr("fill", options.fill_color).attr("stroke", options.stroke_color).attr("stroke-width", options.stroke_width);

      this.model = model;
      this.options = options;
      this.seek = {
          x: options.margin.left,
          y: options.margin.top,
          width: 0
      };

      return this;
  }

  // Add a new legend to this area
  LegendArea.prototype.add = function (legend) {
      var legend_area = this.model.append("g").attr("transform", "translate(" + this.seek.x + "," + this.seek.y + ")");
      var dom = legend.getDomObject();
      legend_area[0][0].appendChild(dom[0][0]);

      // calculate coordinates to place the new legend (too simple algorism!)
      if (this.seek.y + legend.height() > this.options.height) {
          this.seek.x += this.seek.width;
          this.seek.y = this.options.margin.top;
      } else {
          this.seek.width = _.max([this.seek.width, legend.width()]);
          this.seek.y += legend.height();
      }
  };

  var ua = (function () {
      var userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.indexOf('chrome') != -1) return 'chrome';
      if (userAgent.indexOf('firefox') != -1) return 'firefox';else return 'unknown';
  })

  function Tooltip(parent, scales, _options) {
      var options = {
          bg_color: "#333",
          stroke_color: "#000",
          stroke_width: 1,
          text_color: "#fff",
          context_width: 0,
          context_height: 0,
          context_margin: {
              top: 0,
              left: 0,
              bottom: 0,
              right: 0
          },
          arrow_width: 10,
          arrow_height: 10,
          tooltip_margin: {
              top: 2,
              left: 5,
              bottom: 2,
              right: 5
          },
          font: "Helvetica, Arial, sans-serif",
          font_size: "1em"
      };
      if (arguments.length > 1) _.extend(options, _options);

      var model = parent.append("g");

      this.scales = scales;
      this.options = options;
      this.lists = [];
      this.model = model;

      return this;
  }

  // add small tool-tip to context area
  Tooltip.prototype.add = function (id, x, y, pos, contents) {
      var str = _.map(contents, function (v, k) {
          return String(k) + ":" + String(v);
      });
      this.lists.push({
          id: id,
          x: x,
          y: y,
          pos: pos,
          contents: str
      });
  };

  // add small tool-tip to x-axis
  Tooltip.prototype.addToXAxis = function (id, x, round) {
      if (arguments.length > 2) {
          var pow10 = Math.pow(10, round);
          x = Math.round(x * pow10) / pow10;
      }
      this.lists.push({
          id: id,
          x: x,
          y: "bottom",
          pos: 'bottom',
          contents: String(x)
      });
  };

  // add small tool-tip to y-axis
  Tooltip.prototype.addToYAxis = function (id, y, round) {
      if (arguments.length > 2) {
          var pow10 = Math.pow(10, round);
          y = Math.round(y * pow10) / pow10;
      }
      this.lists.push({
          id: id,
          x: "left",
          y: y,
          pos: 'right',
          contents: String(y)
      });
  };

  // remove all exsistng tool-tips
  Tooltip.prototype.reset = function () {
      this.lists = [];
      this.update();
  };

  // calcurate position, height and width of tool-tip, then update dom objects
  Tooltip.prototype.update = function () {
      var style = this.processData(this.lists);
      var model = this.model.selectAll("g").data(style);
      this.updateModels(model);
  };

  // generate dom objects for new tool-tips, and delete old ones
  Tooltip.prototype.updateModels = function (model) {
      model.exit().remove();
      var options = this.options;

      (function (enters, options) {
          var lineFunc = d3.svg.line().x(function (d) {
              return d.x;
          }).y(function (d) {
              return d.y;
          }).interpolate("linear");

          enters.append("path").attr("d", function (d) {
              return lineFunc(d.shape);
          }).attr("stroke", options.stroke_color).attr("fill", options.bg_color);
          //.atrr("stroke-width", options.stroke_width)

          enters.each(function () {
              var dom;
              if (_.isArray(this.__data__.text)) {
                  var texts = this.__data__.text;
                  var x = this.__data__.text_x;
                  var y = this.__data__.text_y;
                  var data = _.map(_.zip(texts, y), function (row) {
                      return {
                          text: row[0],
                          y: row[1]
                      };
                  });
                  dom = d3.select(this).append("g").selectAll("text").data(data).enter().append("text").text(function (d) {
                      return d.text;
                  }).attr("x", function (d) {
                      return x;
                  }).attr("y", function (d) {
                      return d.y;
                  });
              } else {
                  dom = d3.select(this).append("text").text(function (d) {
                      return d.text;
                  }).attr("x", function (d) {
                      return d.text_x;
                  }).attr("y", function (d) {
                      return d.text_y;
                  });
              }
              dom.attr("text-anchor", "middle").attr("fill", "#ffffff").attr("font-size", options.font_size).style("font-family", options.font);

              // Fix for chrome's Issue 143990
              // https://code.google.com/p/chromium/issues/detail?colspec=ID20Pri20Feature20Status20Modified20Mstone%20OS&sort=-modified&id=143990
              switch (ua()) {
                  case 'chrome':
                      dom.attr("dominant-baseline", "middle").attr("baseline-shift", "50%");
                      break;
                  default:
                      dom.attr("dominant-baseline", "text-after-edge");
                      break;
              }
          });

          enters.attr("transform", function (d) {
              return "translate(" + d.tip_x + "," + d.tip_y + ")";
          });
      })(model.enter().append("g"), this.options);
  };

  // calcurate height and width that are necessary for rendering the tool-tip
  Tooltip.prototype.processData = function (lists) {
      var options = this.options;

      // calcurate shape and center point of tool-tip
      var calcPoints = function calcPoints(pos, width, height) {
          var arr_w = options.arrow_width;
          var arr_h = options.arrow_height;
          var tt_w = width;
          var tt_h = height;
          var points = {
              'top': [{
                  x: 0,
                  y: 0
              }, {
                  x: arr_w / 2,
                  y: -arr_h
              }, {
                  x: tt_w / 2,
                  y: -arr_h
              }, {
                  x: tt_w / 2,
                  y: -arr_h - tt_h
              }, {
                  x: -tt_w / 2,
                  y: -arr_h - tt_h
              }, {
                  x: -tt_w / 2,
                  y: -arr_h
              }, {
                  x: -arr_w / 2,
                  y: -arr_h
              }, {
                  x: 0,
                  y: 0
              }],
              'right': [{
                  x: 0,
                  y: 0
              }, {
                  x: -arr_w,
                  y: -arr_h / 2
              }, {
                  x: -arr_w,
                  y: -tt_h / 2
              }, {
                  x: -arr_w - tt_w,
                  y: -tt_h / 2
              }, {
                  x: -arr_w - tt_w,
                  y: tt_h / 2
              }, {
                  x: -arr_w,
                  y: tt_h / 2
              }, {
                  x: -arr_w,
                  y: arr_h / 2
              }, {
                  x: 0,
                  y: 0
              }]
          };
          points['bottom'] = _.map(points['top'], function (p) {
              return {
                  x: p.x,
                  y: -p.y
              };
          });
          points['left'] = _.map(points['right'], function (p) {
              return {
                  x: -p.x,
                  y: p.y
              };
          });

          var center = function (p) {
              var result = {};
              switch (pos) {
                  case 'top':
                  case 'bottom':
                      result = {
                          x: 0,
                          y: (p[2].y + p[3].y) / 2
                      };
                      break;
                  case 'right':
                  case 'left':
                      result = {
                          x: (p[2].x + p[3].x) / 2,
                          y: 0
                      };
                      break;
              }
              return result;
          }(points[pos]);

          return {
              shape: points[pos],
              text: center
          };
      };

      var margin = this.options.tooltip_margin;
      var context_height = this.options.context_height;
      var scales = this.scales;
      var model = this.model;

      var calcText = function calcText(text, size) {
          var dom = model.append("text").text(text).attr("font-size", size).style("font-family", options.font);
          var text_width = dom[0][0].getBBox().width;
          var text_height = dom[0][0].getBBox().height;
          dom.remove();
          return {
              w: text_width,
              h: text_height
          };
      };

      return _.map(lists, function (list) {
          var text_num = _.isArray(list.contents) ? list.contents.length : 1;
          var str = _.isArray(list.contents) ? _.max(list.contents, function (d) {
              return d.length;
          }) : list.contents;

          var text_size = calcText(str, options.font_size);
          var tip_width = text_size.w + margin.left + margin.right;
          var tip_height = (text_size.h + margin.top + margin.bottom) * text_num;

          var point = scales.get(list.x, list.y);
          var tip_x = list.x == "left" ? 0 : point.x;
          var tip_y = list.y == "bottom" ? context_height : point.y;

          var points = calcPoints(list.pos, tip_width, tip_height);

          var text_y;
          if (_.isArray(list.contents)) {
              var len = list.contents.length;
              text_y = _.map(list.contents, function (str, i) {
                  return points.text.y - text_size.h / 2 * (len - 2) + text_size.h * i;
              });
          } else {
              text_y = points.text.y + text_size.h / 2;
          }

          return {
              shape: points.shape,
              tip_x: tip_x,
              tip_y: tip_y,
              text_x: points.text.x,
              text_y: text_y,
              text: list.contents
          };
      });
  };

  function Pane(parent, scale, Axis, _options) {
      var options = {
          width: 700,
          height: 500,
          margin: {
              top: 30,
              bottom: 80,
              left: 80,
              right: 30
          },
          xrange: [0, 0],
          yrange: [0, 0],
          x_label: 'X',
          y_label: 'Y',
          rotate_x_label: 0,
          rotate_y_label: 0,
          zoom: false,
          grid: true,
          zoom_range: [0.5, 5],
          bg_color: '#eee',
          grid_color: '#fff',
          legend: false,
          legend_position: 'right',
          legend_width: 150,
          legend_height: 300,
          legend_stroke_color: '#000',
          legend_stroke_width: 0,
          font: "Helvetica, Arial, sans-serif",
          x_scale: 'linear',
          y_scale: 'linear',
          scale_extra_options: {},
          axis_extra_options: {}
      };
      if (arguments.length > 1) _.extend(options, _options);

      this.uuid = uuid.v4();

      var model = parent.append("svg").attr("width", options.width).attr("height", options.height);

      var areas = function () {
          var areas = {};
          areas.plot_x = options.margin.left;
          areas.plot_y = options.margin.top;
          areas.plot_width = options.width - options.margin.left - options.margin.right;
          areas.plot_height = options.height - options.margin.top - options.margin.bottom;

          if (options.legend) {
              switch (options.legend_position) {
                  case 'top':
                      areas.plot_width -= options.legend_width;
                      areas.plot_y += options.legend_height;
                      areas.legend_x = (options.width - options.legend_width) / 2;
                      areas.legend_y = options.margin.top;
                      break;

                  case 'bottom':
                      areas.plot_height -= options.legend_height;
                      areas.legend_x = (options.width - options.legend_width) / 2;
                      areas.legend_y = options.margin.top + options.height;
                      break;

                  case 'left':
                      areas.plot_x += options.legend_width;
                      areas.plot_width -= options.legend_width;
                      areas.legend_x = options.margin.left;
                      areas.legend_y = options.margin.top;
                      break;

                  case 'right':
                      areas.plot_width -= options.legend_width;
                      areas.legend_x = areas.plot_width + options.margin.left;
                      areas.legend_y = options.margin.top;
                      break;

                  case _.isArray(options.legend_position):
                      areas.legend_x = options.width * options.legend_position[0];
                      areas.legend_y = options.height * options.legend_position[1];
                      break;
              }
          }
          return areas;
      }();

      var scales = function () {
          var domains = {
              x: options.xrange,
              y: options.yrange
          };
          var ranges = {
              x: [0, areas.plot_width],
              y: [areas.plot_height, 0]
          };
          return new scale(domains, ranges, {
              x: options.x_scale,
              y: options.y_scale,
              extra: options.scale_extra_options
          });
      }();

      // add background
      model.append("g").attr("transform", "translate(" + areas.plot_x + "," + areas.plot_y + ")").append("rect").attr("x", 0).attr("y", 0).attr("width", areas.plot_width).attr("height", areas.plot_height).attr("fill", options.bg_color).style("z-index", 1);

      var axis = new Axis(model.select("g"), scales, {
          width: areas.plot_width,
          height: areas.plot_height,
          margin: options.margin,
          grid: options.grid,
          zoom: options.zoom,
          zoom_range: options.zoom_range,
          x_label: options.x_label,
          y_label: options.y_label,
          rotate_x_label: options.rotate_x_label,
          rotate_y_label: options.rotate_y_label,
          stroke_color: options.grid_color,
          pane_uuid: this.uuid,
          z_index: 100,
          extra: options.axis_extra_options
      });

      // add context
      model.select("g").append("g").attr("class", "context").append("clipPath").attr("id", this.uuid + "clip_context").append("rect").attr("x", 0).attr("y", 0).attr("width", areas.plot_width).attr("height", areas.plot_height);

      model.select(".context").attr("clip-path", "url(#" + this.uuid + 'clip_context' + ")");

      model.select("g").append("rect").attr("x", -1).attr("y", -1).attr("width", areas.plot_width + 2).attr("height", areas.plot_height + 2).attr("fill", "none").attr("stroke", "#666").attr("stroke-width", 1).style("z-index", 200);

      // add tooltip
      var tooltip = new Tooltip(model.select("g"), scales, {
          font: options.font,
          context_width: areas.plot_width,
          context_height: areas.plot_height,
          context_margin: {
              top: areas.plot_x,
              left: areas.plot_y,
              bottom: options.margin.bottom,
              right: options.margin.right
          }
      });

      // add legend
      if (options.legend) {
          model.append("g").attr("class", "legend_area").attr("transform", "translate(" + areas.legend_x + "," + areas.legend_y + ")");

          this.legend_area = new LegendArea(model.select(".legend_area"), {
              width: options.legend_width,
              height: options.legend_height,
              stroke_color: options.legend_stroke_color,
              stroke_width: options.legend_stroke_width
          });
      }

      this.diagrams = [];
      this.tooltip = tooltip;
      this.context = model.select(".context").append("g").attr("class", "context_child");
      this.model = model;
      this.scales = scales;
      this.options = options;
      this.filter = null;
      return this;
  }

  // Add diagram to pane
  Pane.prototype.addDiagram = function (type, data, options) {
      _.extend(options, {
          uuid: uuid.v4(),
          tooltip: this.tooltip
      });

      var diagram = new diagrams[type](this.context, this.scales, data, options);

      if (this.options.legend) {
          var legend_area = this.legend_area;
          var legend = diagram.getLegend();
          if (_.isArray(legend)) _.each(legend, function (l) {
              legend_area.add(l);
          });else this.legend_area.add(legend);
      }

      this.diagrams.push(diagram);
  };

  // Add filter to pane (usually a gray box on the pane)
  Pane.prototype.addFilter = function (target, options) {
      var diagrams = this.diagrams;
      var callback = function callback(ranges) {
          _.each(diagrams, function (diagram) {
              diagram.checkSelectedData(ranges);
          });
      };
      this.filter = new Filter(this.context, this.scales, callback, options);
  };

  // Update all diagrams belong to the pane
  Pane.prototype.update = function () {
      var font = this.options.font;
      _.each(this.diagrams, function (diagram) {
          diagram.update();
      });

      this.model.selectAll("text").style("font-family", font);
  };

  function Axis(parent, scales, _options) {
      var options = {
          width: 0,
          height: 0,
          margin: {
              top: 0,
              bottom: 0,
              left: 0,
              right: 0
          },
          stroke_color: "#fff",
          stroke_width: 1.0,
          x_label: 'X',
          y_label: 'Y',
          grid: true,
          zoom: false,
          zoom_range: [0.5, 5],
          rotate_x_label: 0,
          rotate_y_label: 0,
          pane_uuid: null,
          z_index: 0
      };
      if (arguments.length > 2) _.extend(options, _options);

      var xAxis = d3.svg.axis().scale(scales.raw.x).orient("bottom");

      var yAxis = d3.svg.axis().scale(scales.raw.y).orient("left");

      parent.append("g").attr("class", "x_axis");

      parent.append("g").attr("class", "y_axis");

      parent.append("text").attr("x", options.width / 2).attr("y", options.height + options.margin.bottom / 1.5).attr("text-anchor", "middle").attr("fill", "rgb(50,50,50)").attr("font-size", 22).text(options.x_label);

      parent.append("text").attr("x", -options.margin.left / 1.5).attr("y", options.height / 2).attr("text-anchor", "middle").attr("fill", "rgb(50,50,50)").attr("font-size", 22).attr("transform", "rotate(-90," + -options.margin.left / 1.5 + ',' + options.height / 2 + ")").text(options.y_label);

      var update = function update() {
          parent.select(".x_axis").call(xAxis);
          parent.select(".y_axis").call(yAxis);

          parent.selectAll(".x_axis, .y_axis").selectAll("path, line").style("z-index", options.z_index).style("fill", "none").style("stroke", options.stroke_color).style("stroke-width", options.stroke_width);

          parent.selectAll(".x_axis, .y_axis").selectAll("text").attr("fill", "rgb(50,50,50)");

          parent.selectAll(".x_axis").attr("transform", "translate(0," + (options.height + 4) + ")");

          parent.selectAll(".y_axis").attr("transform", "translate(-4,0)");

          if (options.rotate_x_label != 0) {
              parent.selectAll(".x_axis").selectAll("text").style("text-anchor", "end").attr("transform", function (d) {
                  return "rotate(" + options.rotate_x_label + ")";
              });
          }

          if (options.rotate_y_label != 0) {
              parent.selectAll(".y_axis").selectAll("text").style("text-anchor", "end").attr("transform", function (d) {
                  return "rotate(" + options.rotate_y_label + ")";
              });
          }

          Manager.update(options.pane_uuid);
      };

      if (options.grid) {
          xAxis.tickSize(-1 * options.height);
          yAxis.tickSize(-1 * options.width);
      }

      if (options.zoom) {
          var zoom = d3.behavior.zoom().x(scales.raw.x).y(scales.raw.y).scaleExtent(options.zoom_range).on("zoom", update);
          parent.call(zoom);
          parent.on("dblclick.zoom", null);
      }

      update();

      this.model = parent;
      return this;
  }

  function Scales(domains, ranges, _options) {
      var options = {
          x: 'linear',
          y: 'linear'
      };
      if (arguments.length > 1) _.extend(options, _options);

      var scales = {};
      _.each(['x', 'y'], function (label) {
          if (_.some(domains[label], function (val) {
              return _.isString(val);
          })) {
              scales[label] = d3.scale.ordinal().domain(domains[label]).rangeBands(ranges[label]);
          } else {
              var scale = d3.scale[options[label]]();
              scales[label] = scale.domain(domains[label]).range(ranges[label]);
          }
      });
      this.scales = scales;
      this.raw = scales;
      return this;
  }

  // convert from data points to svg dom coordiantes like: ['nya', 'hoge'] -> {x: 23, y:56}]
  Scales.prototype.get = function (x, y) {
      return {
          x: this.scales.x(x),
          y: this.scales.y(y)
      };
  };

  // domain: the word unique to d3.js. See the website of d3.js.
  Scales.prototype.domain = function () {
      return {
          x: this.scales.x.domain(),
          y: this.scales.y.domain()
      };
  };

  // range: the word unique to d3.js. See the website of d3.js.
  Scales.prototype.range = function () {
      return {
          x: this.scales.x.range(),
          y: this.scales.y.range()
      };
  };

  var STL = {};
  STL.pane = Pane;
  STL.axis = Axis;
  STL.scale = Scales;

  var Extension = {};
  var buffer = {};

  // load extension
  Extension.load = function (extension_name) {
      if (typeof window[extension_name] == "undefined") return;
      if (typeof window[extension_name]['Nya'] == "undefined") return;

      var ext_info = window[extension_name].Nya;

      _.each(['pane', 'scale', 'axis'], function (component) {
          if (typeof ext_info[component] == "undefined") ext_info[component] = STL[component];
      });

      if (typeof ext_info['diagrams'] != "undefined") {
          _.each(ext_info['diagrams'], function (content, name) {
              diagrams.add(name, content);
          });
      }

      buffer[extension_name] = ext_info;
  };

  Extension.get = function (name) {
      return buffer[name];
  };

  function Dataframe(name, data) {
      // load data from a String containing a URL or
      // use the (raw) data
      if (data instanceof String && /url(.+)/g.test(data)) {
          var url = data.match(/url\((.+)\)/)[1];
          var df = this;
          d3.json(url, function (error, json) {
              df.raw = JSON.parse(json);
          });
          this.raw = {};
      } else this.raw = data;

      // detect the nested column (that should be only one)
      var header = _.keys(data[0]);
      var rows = _.zip.apply(this, _.map(data, function (row, i) {
          return _.toArray(row);
      }));
      var nested = _.filter(rows, function (column) {
          return _.all(column, function (val) {
              return _.isArray(val);
          });
      });
      if (nested.length == 1) {
          this.nested = header[rows.indexOf(nested[0])];
      } else this.nested = false;

      this.filters = {};
      return this;
  }

  // Get a row by index
  Dataframe.prototype.row = function (row_num) {
      return this.raw[row_num];
  };

  // Get a column by label
  Dataframe.prototype.column = function (label) {
      var arr = [];
      var raw = this.raw;
      _.each(raw, function (row) {
          arr.push(row[label]);
      });
      return arr;
  };

  // Get a scale
  Dataframe.prototype.scale = function (column_name, range) {
      if (this.isContinuous(column_name)) {
          var domain = this.columnRange(column_name);
          domain = _.range(domain.min, domain.max + 1, (domain.max - domain.min) / (range.length - 1));
          return d3.scale.linear().domain(domain).range(range);
      } else {
          return d3.scale.ordinal().domain(_.uniq(this.column(column_name))).range(range);
      };
  };

  // Check if the specified column consists of continuous data
  Dataframe.prototype.isContinuous = function (column_name) {
      return _.every(this.column(column_name), function (val) {
          return _.isNumber(val);
      });
  };

  // Add a filter function to the list
  Dataframe.prototype.addFilter = function (self_uuid, func, excepts) {
      this.filters[self_uuid] = {
          func: func,
          excepts: excepts
      };
  };

  // Iterate a column using filters
  Dataframe.prototype.columnWithFilters = function (self_uuid, label) {
      var raw = this.raw.concat();
      _.each(this.filters, function (filter, uuid) {
          if (filter.excepts.indexOf('self') != -1 && uuid == self_uuid) return;
          if (!(self_uuid in filter.excepts)) raw = _.filter(raw, filter.func);
      });
      return _.map(raw, function (row) {
          return row[label];
      });
  };

  // Fetch a value using column label and row number
  Dataframe.prototype.pickUpCells = function (label, row_nums) {
      var column = this.column(label);
      return _.map(row_nums, function (i) {
          return column[i];
      });
  };

  // Fetch partical dataframe as the format like [{a:1, b:2, c:3}, ...,{a:1, b:2, c:3}] using column names
  Dataframe.prototype.getPartialDf = function (column_names) {
      return _.map(this.raw, function (row) {
          return _.reduce(column_names, function (memo, name) {
              memo[name] = row[name];
              return memo;
          }, {});
      });
  };

  // experimental implementation of accessor to nested dataframe.
  Dataframe.prototype.nested_column = function (row_num, name) {
      if (!this.nested) throw "Recieved dataframe is not nested.";
      var df = new Dataframe('', this.row(row_num)[this.nested]);
      return df.column(name);
  };

  // return the range of values in specified column
  Dataframe.prototype.columnRange = function (label) {
      var column = this.column(label);
      return {
          max: d3.max(column, function (val) {
              return val;
          }),
          min: d3.min(column, function (val) {
              return val;
          })
      };
  };

  function parse(model, element_name) {
      var element = d3.select(element_name);

      if (typeof model['extension'] !== "undefined") {
          if (_.isArray(model['extension'])) {
              _.each(model['extension'], function (ex) {
                  Extension.load(ex);
              });
          } else {
              Extension.load(model['extension']);
          }
      }

      parse_model(model, element);
  }

  function parse_model(model, element) {
      _.each(model.data, function (value, name) {
          Manager.addData(name, new Dataframe(name, value));
      });

      _.each(model.panes, function (pane_model) {
          var pane;

          var pane_proto, axis, scale;
          if (typeof pane_model['extension'] !== "undefined") {
              var ext = Extension.get(pane_model['extension']);
              pane_proto = ext.pane;
              axis = ext.axis;
              scale = ext.scale;
          } else {
              pane_proto = STL.pane;
              axis = STL.axis;
              scale = STL.scale;
          }
          pane = new pane_proto(element, scale, axis, pane_model.options);

          var data_list = [];
          _.each(pane_model.diagrams, function (diagram) {
              pane.addDiagram(diagram.type, diagram.data, diagram.options || {});
              data_list.push(diagram.data);
          });

          if (pane_model['filter'] !== undefined) {
              var filter = pane_model.filter;
              pane.addFilter(filter.type, filter.options || {});
          }

          Manager.addPane({
              pane: pane,
              data: data_list,
              uuid: pane.uuid
          });
          Manager.update(pane.uuid);
      });
  };

  var Nyaplot = {};

  Nyaplot.core = {};
  Nyaplot.core.parse = parse;

  Nyaplot.STL = STL;
  Nyaplot.Manager = Manager;
  Nyaplot.uuid = uuid;
  Nyaplot._ = _;

  return Nyaplot;

}(_,uuid,colorbrewer));
//# sourceMappingURL=nyaplot.iife.js.map