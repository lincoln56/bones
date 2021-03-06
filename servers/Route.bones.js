var path = require('path');
var env = process.env.NODE_ENV || 'development';
var headers = { 'Content-Type': 'application/json' };

server = Bones.Server.extend({});

var options = {
    type: '.js',
    wrapper: Bones.utils.wrapClientFile,
    sort: Bones.utils.sortByLoadOrder
};

// TODO: This should be moved to the initialize method!
server.prototype.assets = {
    vendor: new mirror([
        require.resolve(path.join(__dirname, '../assets/jquery')),
        require.resolve('underscore'),
        require.resolve('backbone')
    ], { type: '.js' }),
    core: new mirror([
        require.resolve(path.join(__dirname, '../shared/utils')),
        require.resolve(path.join(__dirname, '../client/utils')),
        require.resolve(path.join(__dirname, '../shared/backbone')),
        require.resolve(path.join(__dirname, '../client/backbone'))
    ], { type: '.js' }),
    models: new mirror([], options),
    views: new mirror([], options),
    routers: new mirror([], options),
    templates: new mirror([], options)
};

if (env === 'development') {
    server.prototype.assets.core.unshift(require.resolve(path.join(__dirname, '../assets/debug')));
}

// TODO: This should be moved to the initialize method!
server.prototype.assets.all = new mirror([
    server.prototype.assets.vendor,
    server.prototype.assets.core,
    server.prototype.assets.routers,
    server.prototype.assets.models,
    server.prototype.assets.views,
    server.prototype.assets.templates
], { type: '.js' });

// Stores models, views served by this server.
// TODO: This should be moved to the initialize method!
server.prototype.models = {};
server.prototype.views = {};

// Stores instances of routers registered with this server.
// TODO: This should be moved to the initialize method!
server.prototype.routers = {};

server.prototype.initialize = function(app) {
    this.registerComponents(app);
    this.initializeAssets(app);
    this.initializeModels(app);
};

server.prototype.registerComponents = function(app) {
    var components = ['routers', 'models', 'views', 'templates'];
    components.forEach(function(kind) {
        for (var name in app[kind]) {
            app[kind][name].register(this);
        }
    }, this);
};

server.prototype.initializeAssets = function(app) {
    this.get('/assets/bones/vendor.js', this.assets.vendor.handler);
    this.get('/assets/bones/core.js', this.assets.core.handler);
    this.get('/assets/bones/routers.js', this.assets.routers.handler);
    this.get('/assets/bones/models.js', this.assets.models.handler);
    this.get('/assets/bones/views.js', this.assets.views.handler);
    this.get('/assets/bones/templates.js', this.assets.templates.handler);

    this.get('/assets/bones/all.js', this.assets.all.handler);
};

server.prototype.initializeModels = function(app) {
    this.models = app.models;
    _.bindAll(this, 'loadModel', 'accessModel','getModel', 'fillModel', 'saveModel', 'delModel', 'loadCollection', 'accessCollection', 'getCollection');
    this.get('/api/:model/:id', this.loadModel, this.fillModel, this.accessModel, this.getModel);
    this.post('/api/:model', this.loadModel, this.accessModel, this.saveModel);
    this.put('/api/:model/:id', this.loadModel, this.fillModel, this.accessModel, this.saveModel);
    this.del('/api/:model/:id', this.loadModel, this.fillModel, this.accessModel, this.delModel);
    this.get('/api/:collection', this.loadCollection, this.accessCollection, this.getCollection);
};

server.prototype.loadCollection = function(req, res, next) {
    var name = Bones.utils.pluralize(req.params.collection);
    if (name in this.models) {
        // Pass any querystring parameters to the collection.
        req.collection = new this.models[name]([], req.query);
    }
    return next();
};

server.prototype.getCollection = function(req, res, next) {
    if (!req.collection) { return next(); }
    req.collection.fetch({
        success: function(collection, resp) {
            res.send(resp, headers);
        },
        error: function(collection, err) {
            err = err instanceof Object ? err.toString() : err;
            next(new Error.HTTP(err, 500));
        }
    });
};

server.prototype.loadModel = function(req, res, next) {
    var name = req.params.model;
    if (name in this.models) {
        // Pass any querystring parameters to the model.
        req.model = new this.models[name]({ id: req.params.id }, req.query);
    }
    next();
};

/*
 * Check the query should be allowed access to the given model.
 */
server.prototype.accessModel = function(req, res, next) {
    if (!req.model) return next();
    console.log('[debug accessModel] now trying to access: ', req.model);
    if (req.model.access(req, res)) {
        return next();
    } else {
        return next(new Error.HTTP(403));
    }
};

server.prototype.accessCollection = function(req, res, next) {
    if (!req.collection) { return next(); }
    if (req.collection.access(req, res)) {
        return next();
    } else {
        return next(new Error.HTTP(403));
    }
};

server.prototype.getModel = function(req, res, next) {
    if (!req.model) return next();
    res.send(req.model, headers);
};

server.prototype.fillModel = function(req, res, next) {
    if (!req.model) return next();
    req.model.fetch({
        success: function(model, resp) {
            next();
        },
        error: function(model, err) {
            err = err instanceof Object ? err.toString() : err;
            next(new Error.HTTP(err, 404));
        }
    });
};

server.prototype.saveModel = function(req, res, next) {
    if (!req.model) return next();
    req.model.save(req.body, {
        success: function(model, resp) {
            res.send(resp, headers);
        },
        error: function(model, err) {
            err = err instanceof Object ? err.toString() : err;
            next(new Error.HTTP(err, 409));
        }
    });
};

server.prototype.delModel = function(req, res, next) {
    if (!req.model) return next();
    req.model.destroy({
        success: function(model, resp) {
            res.send({}, headers);
        },
        error: function(model, err) {
            err = err instanceof Object ? err.toString() : err;
            next(new Error.HTTP(err, 409));
        }
    });
};
