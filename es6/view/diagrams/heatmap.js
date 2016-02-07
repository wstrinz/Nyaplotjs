/*
 * Heatmap: Heatmap or 2D Histogram
 *
 * Heatmap creates rectangles from continuous data. Width and height values should be specified.
 *
 * options:
 *    title        -> String: title of this chart showen on legend
 *    x, y         -> String: column name. Both x and y should be continuous.
 *    width, height-> Float : 0..1, width and height of each rectangle
 *    color        -> Array : color in which bars filled.
 *    stroke_color -> String: stroke color
 *    stroke_width -> Float : stroke width
 *    hover        -> Bool  : set whether pop-up tool-tips when bars are hovered.
 *    tooltip      -> Object: instance of Tooltip. set by pane.
 *
 * example:
 *    http://bl.ocks.org/domitry/eab8723ccb32fd3a6cd8
 */

import _ from 'underscore';
import uuid from 'node-uuid';
import Manager from '../../core/manager';
import Filter from '../components/filter';
import ColorBar from '../components/legend/color_bar';
import colorset from '../../utils/color';

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

    this.color_scale = (function() {
        var column_fill = df.columnWithFilters(options.uuid, options.fill);
        var min_max = d3.extent(column_fill);
        var domain = d3.range(min_max[0], min_max[1], (min_max[1] - min_max[0]) / (options.color.length));
        return d3.scale.linear()
            .range(options.color)
            .domain(domain);
    })();

    this.scales = scales;
    this.options = options;
    this.model = model;
    this.df = df;
    this.uuid = options.uuid;
    return this;
};

// fetch data and update dom object. called by pane which this chart belongs to.
HeatMap.prototype.update = function() {
    var data = this.processData();
    var models = this.model.selectAll("rect").data(data);
    models.each(function() {
        var event = document.createEvent("MouseEvents");
        event.initEvent("mouseout", false, true);
        this.dispatchEvent(event);
    });
    models.enter().append("rect");
    this.updateModels(models, this.options);
};

// pre-process data. convert data coorinates to dom coordinates with Scale.
HeatMap.prototype.processData = function() {
    var column_x = this.df.columnWithFilters(this.uuid, this.options.x);
    var column_y = this.df.columnWithFilters(this.uuid, this.options.y);
    var column_fill = this.df.columnWithFilters(this.uuid, this.options.fill);
    var scales = this.scales;
    var options = this.options;
    var color_scale = this.color_scale;

    return _.map(_.zip(column_x, column_y, column_fill), function(row) {
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
HeatMap.prototype.updateModels = function(selector, options) {
    var id = this.uuid;
    var onMouse = function() {
        d3.select(this).transition()
            .duration(200)
            .attr("fill", function(d) {
                return d3.rgb(d.fill).darker(1);
            });
        options.tooltip.addToXAxis(id, this.__data__.x_raw, 3);
        options.tooltip.addToYAxis(id, this.__data__.y_raw, 3);
        options.tooltip.update();
    };

    var outMouse = function() {
        d3.select(this).transition()
            .duration(200)
            .attr("fill", function(d) {
                return d.fill;
            });
        options.tooltip.reset();
    };

    selector
        .attr("x", function(d) {
            return d.x;
        })
        .attr("width", function(d) {
            return d.width;
        })
        .attr("y", function(d) {
            return d.y;
        })
        .attr("height", function(d) {
            return d.height;
        })
        .attr("fill", function(d) {
            return d.fill;
        })
        .attr("stroke", options.stroke_color)
        .attr("stroke-width", options.stroke_width);

    if (options.hover) selector
        .on("mouseover", onMouse)
        .on("mouseout", outMouse);
};

// return legend object.
HeatMap.prototype.getLegend = function() {
    return new ColorBar(this.color_scale);
};

// answer to callback coming from filter. not implemented yet.
HeatMap.prototype.checkSelectedData = function(ranges) {
    return;
};

export default HeatMap;
