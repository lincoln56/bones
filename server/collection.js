var Backbone = require('./backbone');
var _ = require('underscore');

module.exports = Backbone.Collection;

Backbone.Collection.toString = function() {
    return '<Collection ' + this.title + '>';
};

Backbone.Collection.register = function(app) {
    // Add the collection if it's not a server-only collection.
    this.files.forEach(function(filename) {
        if (!(/\.server\.bones$/).test(filename) && app.assets) {
            app.assets.models.push(filename);
        }
    });

    app.models[this.title] = this;
};

Backbone.Collection.prototype.toString = function() {
    return '[Collection ' + this.constructor.title + ']';
};

Backbone.Collection.prototype.access = function(req, res) {
    if (this.model) {
        var model = new this.model();
        return model.access(req, res);
    }
    return this;
};

