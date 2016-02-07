/* 
 * Return UA information
 */

import _ from 'underscore';
export default (function() {
    var userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.indexOf('chrome') != -1) return 'chrome';
    if (userAgent.indexOf('firefox') != -1) return 'firefox';
    else return 'unknown';
});
