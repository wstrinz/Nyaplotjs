/*
 * Box: Boxplot
 *
 * This chart is generated from 'value' columns. Box calculates median and other parameters and create box plot using rect and line.
 * Each box is placed in the position on x-axis, corresponds to column name.
 *
 * options:
 *    title        -> String: title of this chart showen on legend
 *    value        -> Array : Array of String (column name)
 *    width        -> Float : 0..1, width of each box
 *    color        -> Array : color in which bars filled.
 *    stroke_color -> String: stroke color
 *    stroke_width -> Float : stroke width
 *    outlier_r    -> Float : radius of outliers
 *    tooltip      -> Object: instance of Tooltip. set by pane.
 *
 * example:
 *    http://bl.ocks.org/domitry/5a89296dfb23f0ea2ffd
 */


import _ from 'underscore';
import uuid from 'node-uuid';
import Manager from '../../core/manager';
import Filter from '../components/filter';
import SimpleLegend from '../components/legend/simple_legend';

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
Box.prototype.update = function() {
    var uuid = this.uuid;
    var processData = this.processData;
    var df = this.df;
    var data = [];
    _.each(this.options.value, function(column_name) {
        var column = df.columnWithFilters(uuid, column_name);
        data.push(_.extend(processData(column), {
            x: column_name
        }));
    });

    var boxes = this.model.selectAll("g").data(data);
    boxes.enter()
        .append("g");

    this.updateModels(boxes, this.scales, this.options);
};

// convert raw data into style information for box
Box.prototype.processData = function(column) {
    var getMed = function(arr) {
        var n = arr.length;
        return (n % 2 == 1 ? arr[Math.floor(n / 2)] : (arr[n / 2] + arr[n / 2 + 1]) / 2);
    };

    var arr = _.sortBy(column);
    var med = getMed(arr);
    var q1 = getMed(arr.slice(0, arr.length / 2 - 1));
    var q3 = getMed(arr.slice((arr.length % 2 == 0 ? arr.length / 2 : arr.length / 2 + 1), arr.length - 1));
    var h = q3 - q1;
    var max = (_.max(arr) - q3 > 1.5 * h ? q3 + 1.5 * h : _.max(arr));
    var min = (q1 - _.min(arr) > 1.5 * h ? q1 - 1.5 * h : _.min(arr));
    var outlier = _.filter(arr, function(d) {
        return (d > max || d < min);
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
Box.prototype.updateModels = function(selector, scales, options) {
    var width = scales.raw.x.rangeBand() * options.width;
    var padding = scales.raw.x.rangeBand() * ((1 - options.width) / 2);
    var color_scale = this.color_scale;

    var onMouse = function() {
        d3.select(this).transition()
            .duration(200)
            .attr("fill", function(d) {
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

    var outMouse = function() {
        d3.select(this).transition()
            .duration(200)
            .attr("fill", function(d) {
                return d3.rgb(color_scale(d.x));
            });
        var id = d3.select(this).attr("id");
        options.tooltip.reset();
    };

    selector
        .append("line")
        .attr("x1", function(d) {
            return scales.get(d.x, 0).x + width / 2 + padding;
        })
        .attr("y1", function(d) {
            return scales.get(d.x, d.max).y;
        })
        .attr("x2", function(d) {
            return scales.get(d.x, 0).x + width / 2 + padding;
        })
        .attr("y2", function(d) {
            return scales.get(d.x, d.min).y;
        })
        .attr("stroke", options.stroke_color);

    selector
        .append("rect")
        .attr("x", function(d) {
            return scales.get(d.x, 0).x + padding;
        })
        .attr("y", function(d) {
            return scales.get(d.x, d.q3).y;
        })
        .attr("height", function(d) {
            return scales.get(d.x, d.q1).y - scales.get(d.x, d.q3).y;
        })
        .attr("width", width)
        .attr("fill", function(d) {
            return color_scale(d.x);
        })
        .attr("stroke", options.stroke_color)
        .attr("id", uuid.v4())
        .on("mouseover", onMouse)
        .on("mouseout", outMouse);

    // median line
    selector
        .append("line")
        .attr("x1", function(d) {
            return scales.get(d.x, 0).x + padding;
        })
        .attr("y1", function(d) {
            return scales.get(d.x, d.med).y;
        })
        .attr("x2", function(d) {
            return scales.get(d.x, 0).x + width + padding;
        })
        .attr("y2", function(d) {
            return scales.get(d.x, d.med).y;
        })
        .attr("stroke", options.stroke_color);

    selector
        .append("g")
        .each(function(d, i) {
            d3.select(this)
                .selectAll("circle")
                .data(d.outlier)
                .enter()
                .append("circle")
                .attr("cx", function(d1) {
                    return scales.get(d.x, 0).x + width / 2 + padding;
                })
                .attr("cy", function(d1) {
                    return scales.get(d.x, d1).y;
                })
                .attr("r", options.outlier_r);
        });
};

// return legend object based on data prepared by initializer
Box.prototype.getLegend = function() {
    return new SimpleLegend(this.legend_data);
};

// answer to callback coming from filter. not implemented yet.
Box.prototype.checkSelectedData = function(ranges) {
    return;
};

export default Box;
