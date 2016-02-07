/*
 * Diagrams: Diagrams Factory
 *
 * Diagrams manages all diagrams bundled by Nyaplotjs. Extension registers their own diagrams through this module.
 *
 */

import Bar from './bar';
import Histogram from './histogram';
import Scatter from './scatter';
import Line from './line';
import Venn from './venn';
import Multiple_venn from './multiple_venn';
import Box from './box';
import Heatmap from './heatmap';
import Vectors from './vectors';
var diagrams = {};

diagrams.bar = Bar;
diagrams.histogram = Histogram;
diagrams.scatter = Scatter;
diagrams.line = Line;
diagrams.venn = Venn;
diagrams.multiple_venn = Multiple_venn;
diagrams.box = Box;
diagrams.heatmap = Heatmap;
diagrams.vectors = Vectors;

// Add diagrams. Called by other extensions
diagrams.add = function(name, diagram) {
    diagrams[name] = diagram;
};

export default diagrams;
