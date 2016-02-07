import parse from './core/parse';
import stl from './core/stl';
import Manager from './core/manager';
import underscore from 'underscore';
import uuid from 'node-uuid';

var Nyaplot = {};

Nyaplot.core = {};
Nyaplot.core.parse = parse;

Nyaplot.STL = stl;
Nyaplot.Manager = Manager;
Nyaplot.uuid = uuid;
Nyaplot._ = underscore;

export default Nyaplot;
