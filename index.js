var mongoose = require('mongoose'),
    extend = require('extend'),
    counterSchema,
    Counter;

exports.initialize = function (connection) {
    counterSchema = new mongoose.Schema({
        model: {
            type: String,
            require: true
        },
        field: {
            type: String,
            require: true
        },
        c: {
            type: Number,
            default: 0
        }
    });
    counterSchema.index({ field: 1, model: 1 }, { unique: true, required: true, index: -1 });
    Counter = connection.model('mai-id-counters', counterSchema);
};

exports.plugin = function (schema, options) {
    if (!counterSchema || !Counter) throw new Error("mongoose-auto-increment has not been initialized.");

    var settings = {
            model: null,
            field: '_id',
            startAt: 0,
            incrementBy: 1,
            incrementOnUpdate: false
        },
        fields = {},
        ready = false;

    switch (typeof(options)) {
        case 'string':
            settings.model = options;
            break;
        case 'object':
            extend(settings, options);
            break;
    }

    fields[settings.field] = {
        type: Number,
        unique: true,
        require: true
    };
    schema.add(fields);

    Counter.findOne(
        { model: settings.model, field: settings.field },
        function (err, res) {
            if (!res) {
                var counter = new Counter({ model: settings.model, field: settings.field, c: settings.startAt });
                counter.save(function () {
                    ready = true;
                });
            }
            else
                ready = true;
        }
    );

    schema.methods.nextAutoIncrement = function () {
        if (typeof this[settings.field] === 'undefined') {
            return settings.startAt;
        }
        return this[settings.field] + settings.incrementBy;
    };

    schema.pre('save', function (next) {
        var doc = this;
        if (typeof(doc[settings.field]) !== 'number' || settings.incrementOnUpdate) {
            (function save() {
                if (ready) {
                    Counter.collection.findAndModify(
                        { model: settings.model, field: settings.field },
                        null,
                        { $inc: { c: settings.incrementBy } },
                        { new: true, upsert: true },
                        function (err, res) {
                            if (err) return next(err);
                            doc[settings.field] = res.c - 1;
                            next();
                        }
                    );
                }
                else
                    setTimeout(save, 5);
            })();
        }
        else
            next();
    });
};
